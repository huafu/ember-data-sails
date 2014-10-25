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
   * Set this or subscribePath to `null` will disable this feature
   * @since 0.0.11
   * @property subscribeMethod
   * @type String
   */
  subscribeMethod:         'POST',
  /**
   * The path to send a request over the socket to update/setup subscriptions
   * Set this or subscribeMethod to `null` will disable this feature
   * @since 0.0.11
   * @property subscribePath
   * @type String
   */
  subscribePath:           '/socket/subscribe',

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
   * Whether we should subscribe to a given model or not
   * By default it subscribe to any model, tho it's better to optimize by setting up a filter here
   * so that it does not ask the server for subscription on unneeded stuff
   *
   * @since 0.0.11
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



  // TO BE REMOVED =========


  /**
   * As well as doing the same as its super method, schedule subscription for each record's socket
   * message that are in created payloads if we are not coming from the socket
   *
   * @since 0.0.11
   * @method _newPayload
   * @private
   */
  _newPayload: function (store, type, record, _onRecordFound) {
    var res, handler, self = this;
    // override the existing handler if any with our subscription scheduler
    handler = function (type, record) {
      this._scheduleRecordSubscribe(type, record);
      if (_onRecordFound) {
        _onRecordFound(type, record);
      }
    };
    // call the super with our handler
    res = this._super(store, type, record, handler);
    // listen to the socket evens if not done already
    Ember.keys(res).map(function (model) {
      self._listenToSocket(Ember.String.singularize(model));
    });
    Ember.run.once(this, '_subscribeScheduled');
    return res;
  },

  /**
   * Schedule a record subscription if we are not coming from the socket and we have a subscription
   * method and path
   *
   * @since 0.0.11
   * @param {subclass of DS.Model} type
   * @param {Object} recordJson
   * @private
   */
  _scheduleRecordSubscribe: function (type, recordJson) {
    var opt = this.getProperties('subscribeMethod', 'subscribePath'), key;
    if (this._fromSocket) {
      // do nothing, if we are coming from the socket we must have been subscribed already
    }
    else if (opt.subscribeMethod && opt.subscribePath && this.shouldSubscribe(type, recordJson)) {
      // we are not coming from the socket, schedule a subscribe
      if (!this._scheduledSubscriptions) {
        this._scheduledSubscriptions = {};
      }
      // use an object and keys so that we don't have duplicate IDs
      key = Ember.String.camelize(type.typeKey);
      if (!this._scheduledSubscriptions[key]) {
        this._scheduledSubscriptions[key] = {};
      }
      this._scheduledSubscriptions[key]['' + recordJson.id] = 0;
    }
  },

  /**
   * Ask the API to subscribe
   *
   * @since 0.0.11
   * @private
   */
  _subscribeScheduled: function () {
    var opt = this.getProperties('subscribeMethod', 'subscribePath'), data, self = this;
    if (this._scheduledSubscriptions && opt.subscribeMethod && opt.subscribePath) {
      // grab and delete our scheduled subscriptions
      data = this._scheduledSubscriptions;
      this._scheduledSubscriptions = null;
      // the IDs are the keys so that set both the same will not duplicate them, we need to reduce them
      for (var k in data) {
        data[k] = Ember.keys(data[k]);
      }
      this.notice('asking the API to subscribe to some records of %@ model(s)'.fmt(Ember.keys(data).join(', ')));
      // ask the API to subscribe to those records
      this.get('sailsSocket').request(
        opt.subscribeMethod.toLowerCase(), opt.subscribePath, data
      )
        .then(function (result) {
          self.notice('subscription successful, result: '.fmt(result));
        })
        .catch(function (jwr) {
          self.warn('error when trying to subscribe', jwr);
        });
    }
  },

  /**
   * Same as `_newPayload`, but set a flag so that we know it's coming from the socket and not a push
   * or pushPayload...
   * @since 0.0.11
   * @method _newPayloadFromSocket
   * @private
   */
  _newPayloadFromSocket: function (store, type, record, _onRecordFound) {
    var res, old = this._fromSocket;
    this._fromSocket = true;
    res = this._newPayload.apply(this, arguments);
    this._fromSocket = old;
    return res;
  }
});
