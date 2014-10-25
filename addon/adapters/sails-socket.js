import DS from 'ember-data';
import Ember from 'ember';
import SailsBaseAdapter from 'ember-data-sails/adapters/sails-base';

/**
 * Adapter for SailsJS sockets
 *
 * @since 0.0.1
 * @class SailsSocketAdapter
 * @extends SailsBaseAdapter
 * @constructor
 */
export default SailsBaseAdapter.extend({
  /**
   * Holds the scheduled subscriptions
   * @since 0.0.11
   * @property _scheduledSubscriptions
   * @type Object
   */
  _scheduledSubscriptions: null,
  /**
   * The method used when sending a request over the socket to update/setup subscriptions
   * Set this or subscribeEndpoint to `null` will disable this feature
   * @since 0.0.11
   * @property subscribeMethod
   * @type String
   */
  subscribeMethod:         'POST',
  /**
   * The path to send a request over the socket to update/setup subscriptions
   * Set this or subscribeMethod to `null` will disable this feature
   * @since 0.0.11
   * @property subscribeEndpoint
   * @type String
   */
  subscribeEndpoint:       '/socket/subscribe',

  /**
   * @since 0.0.1
   * @method init
   * @inheritDoc
   */
  init: function () {
    this._super();
    this.get('sailsSocket').on('didConnect', this, 'fetchCSRFToken', true);
  },

  /**
   * Send a message over the socket
   *
   * @since 0.0.1
   * @method ajax
   * @param {String} url The HTTP URL to fake
   * @param {String} method The HTTP method to fake
   * @param {Object} data The data to send
   * @return {Ember.RSVP.Promise} A promise resolving to the result or an error
   */
  ajax: function (url, method, data) {
    method = method.toLowerCase();
    var self = this, run;
    run = function () {
      return self.get('sailsSocket').request(method, url, data).then(function (response) {
        self.info('socket %@ request on %@: SUCCESS'.fmt(method, url));
        self.debug('  → request:', data);
        self.debug('  ← response:', response);
        if (self.isErrorObject(response)) {
          if (response.errors) {
            return Ember.RSVP.reject(new DS.InvalidError(self.formatError(response)));
          }
          return Ember.RSVP.reject(response);
        }
        // TODO: flag the response as coming from the socket so that the serializer can trigger our
        // TODO: gotNewPayload and we can detect if not coming from the socket
        return response;
      }).catch(function (error) {
        self.warn('socket %@ request on %@: ERROR'.fmt(method, url));
        self.info('  → request:', data);
        self.info('  ← error:', error);
        return Ember.RSVP.reject(error);
      });
    };
    if (method !== 'get') {
      return this.fetchCSRFToken().then(function () {
        self.checkCSRF(data);
        return run();
      });
    }
    else {
      return run();
    }
  },

  /**
   * @since 0.0.11
   * @method buildURL
   * @inheritDoc
   */
  buildURL: function (type, id, record) {
    this._listenToSocket(type);
    return this._super.apply(this, arguments);
  },

  /**
   * Whether we should subscribe to a given model or not
   * By default it subscribe to any model, tho it's better to optimize by setting up a filter here
   * so that it does not ask the server for subscription on unneeded stuff
   *
   * @since 0.0.11
   * @method shouldSubscribe
   * @param {subclass of DS.Model} type The type of the record
   * @param {Object} recordJson The json of the record (DO NOT ALTER IT!)
   * @returns {Boolean} If `false` then the record isn't subscribed for, else it is
   */
  shouldSubscribe: function (type, recordJson) {
    return true;
  },

  /**
   * Fetches the CSRF token
   *
   * @since 0.0.4
   * @method _fetchCSRFToken
   * @return {Ember.RSVP.Promise} Returns the promise resolving the CSRF token
   * @private
   */
  _fetchCSRFToken: function () {
    return this.get('sailsSocket').request('get', '/csrfToken').then(function (tokenObject) {
      return tokenObject._csrf;
    });
  },

  /**
   * Handle a created record message
   *
   * @since 0.0.1
   * @method _handleSocketRecordCreated
   * @param {DS.Store} store The store to be used
   * @param {subclass of DS.Model} type The type to push
   * @param {Object} message The message received
   * @private
   */
  _handleSocketRecordCreated: function (store, type, message) {
    var record = message.data;
    if (!record.id && message.id) {
      record.id = message.id;
    }
    store.pushPayload(type, record);
  },

  /**
   * Handle a updated record message
   *
   * @since 0.0.1
   * @method _handleSocketRecordUpdated
   * @param {DS.Store} store The store to be used
   * @param {subclass of DS.Model} type The type to push
   * @param {Object} message The message received
   * @private
   */
  _handleSocketRecordUpdated: Ember.aliasMethod('_handleSocketRecordCreated'),

  /**
   * Handle a destroyed record message
   *
   * @since 0.0.1
   * @method _handleSocketRecordDeleted
   * @param {DS.Store} store The store to be used
   * @param {subclass of DS.Model} type The type to push
   * @param {Object} message The message received
   * @private
   */
  _handleSocketRecordDeleted: function (store, type, message) {
    var record = store.getById(type.typeKey, message.id);
    if (record && typeof record.get('dirtyType') === 'undefined') {
      record.unloadRecord();
    }
  },

  /**
   * Listen to socket message for a given model
   *
   * @since 0.0.1
   * @method _listenToSocket
   * @param {String} model The model name to listen for events
   * @private
   */
  _listenToSocket: function (model) {
    var store, type;
    var eventName = Ember.String.camelize(model).toLowerCase();
    var socket = this.get('sailsSocket');
    if (socket.listenFor(eventName, true)) {
      this.notice('setting up adapter to listen for `%@` messages'.fmt(model));
      store = this.container.lookup('store:main');
      type = store.modelFor(model);
      socket.on(eventName + '.created', Ember.run.bind(this, '_handleSocketRecordCreated', store, type));
      socket.on(eventName + '.updated', Ember.run.bind(this, '_handleSocketRecordUpdated', store, type));
      socket.on(eventName + '.destroyed', Ember.run.bind(this, '_handleSocketRecordDeleted', store, type));
    }
  },

  /**
   * Schedule a record subscription
   *
   * @since 0.0.11
   * @method _scheduleSubscribe
   * @param {subclass of DS.Model} type
   * @param {String|Number} id
   * @private
   */
  _scheduleSubscribe: function (type, id) {
    var opt, key;
    opt = this.getProperties('subscribeMethod', 'subscribeEndpoint');
    if (opt.subscribeMethod && opt.subscribeEndpoint && id && this.shouldSubscribe(type, id)) {
      if (!this._scheduledSubscriptions) {
        this._scheduledSubscriptions = {};
      }
      // use an object and keys so that we don't have duplicate IDs
      key = Ember.String.camelize(type.typeKey);
      if (!this._scheduledSubscriptions[key]) {
        this._scheduledSubscriptions[key] = {};
      }
      id = '' + id;
      if (!this._scheduledSubscriptions[key][id]) {
        this._scheduledSubscriptions[key][id] = 0;
        Ember.run.debounce(this, '_subscribeScheduled', 50);
      }
    }
  },

  /**
   * Ask the API to subscribe
   *
   * @since 0.0.11
   * @method _subscribeScheduled
   * @private
   */
  _subscribeScheduled: function () {
    var data, payload, k, self = this,
      opt = this.getProperties('subscribeMethod', 'subscribeEndpoint');
    if (this._scheduledSubscriptions) {
      // grab and delete our scheduled subscriptions
      data = this._scheduledSubscriptions;
      this._scheduledSubscriptions = null;
      payload = {};
      // the IDs are the keys so that set both the same will not duplicate them, we need to reduce them
      for (k in data) {
        payload[k] = Object.keys(data[k]);
        this._listenToSocket(k);
      }
      self.debug('asking the API to subscribe to some records of type %@'.fmt(Ember.keys(data).join(', ')));
      // ask the API to subscribe to those records
      this.fetchCSRFToken().then(function () {
        self.checkCSRF(payload);
        self.get('sailsSocket').request(opt.subscribeMethod, opt.subscribeEndpoint, payload)
          .then(function (result) {
            self.debug('subscription successful, result:', result);
          })
          .catch(function (jwr) {
            self.warn('error when trying to subscribe to some model(s)');
          });
      });
    }
  }
});
