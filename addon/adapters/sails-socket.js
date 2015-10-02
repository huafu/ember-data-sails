import Ember from 'ember';
import SailsBaseAdapter from './sails-base';

var EmberString = Ember.String;
var fmt = EmberString.fmt;
var camelize = EmberString.camelize;
var pluralize = EmberString.pluralize;
var run = Ember.run;
var bind = run.bind;
var debounce = run.debounce;

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
    this.sailsSocket.on('didConnect', this, 'fetchCSRFToken', true);
  },

  /**
   * Sends a request over the socket
   *
   * @since 0.0.11
   * @method _request
   * @param {Object} out
   * @param {String} url
   * @param {String} method
   * @param {Object} options
   * @returns {Ember.RSVP.Promise}
   * @private
   */
  _request: function (out, url, method, options) {
    out.protocol = 'socket';
    return this.sailsSocket.request(method, url, options.data);
  },

  /**
   * @since 0.0.11
   * @method buildURL
   * @inheritDoc
   */
  buildURL: function (type, id, record) {
    return this._super(type, id, record);
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
  shouldSubscribe: function (/*type, recordJson*/) {
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
    return this.sailsSocket.request('get', this.get('csrfTokenPath').replace(/^\/?/, '/'))
      .then(function (tokenObject) {
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
    var record = message.data, payload = {};
    if (!record.id && message.id) {
      record.id = message.id;
    }
    payload[pluralize(camelize(type.modelName))] = [record];
    store.pushPayload(type, payload);
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
    var record = store.getById(type.modelName, message.id);
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
    var eventName = camelize(model).toLowerCase();
    var socket = this.sailsSocket;
    if (socket.listenFor(eventName, true)) {
      this.notice(fmt('setting up adapter to listen for `%@` messages', model));
      store = this.container.lookup('store:main');
      type = store.modelFor(model);
      socket.on(eventName + '.created', bind(this, '_handleSocketRecordCreated', store, type));
      socket.on(eventName + '.updated', bind(this, '_handleSocketRecordUpdated', store, type));
      socket.on(eventName + '.destroyed', bind(this, '_handleSocketRecordDeleted', store, type));
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
      key = camelize(type.modelName);
      if (!this._scheduledSubscriptions[key]) {
        this._scheduledSubscriptions[key] = {};
      }
      id = '' + id;
      if (!this._scheduledSubscriptions[key][id]) {
        this._scheduledSubscriptions[key][id] = 0;
        debounce(this, '_subscribeScheduled', 50);
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
      self.debug(fmt('asking the API to subscribe to some records of type %@', Ember.keys(data).join(', ')));
      // ask the API to subscribe to those records
      this.fetchCSRFToken().then(function () {
        self.checkCSRF(payload);
        self.get('sailsSocket').request(opt.subscribeMethod, opt.subscribeEndpoint, payload)
          .then(function (result) {
            self.debug('subscription successful, result:', result);
          })
          .catch(function (/* jwr */) {
            self.warn('error when trying to subscribe to some model(s)');
          });
      });
    }
  }
});
