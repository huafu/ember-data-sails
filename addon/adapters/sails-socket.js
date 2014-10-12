/*global io*/
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
   * Holds the descriptors for each event listened on the socket
   * @since 0.0.1
   * @property _socketListeners
   * @type Object<Object>
   * @private
   */
  _socketListeners: null,

  /**
   * @since 0.0.1
   * @inheritDoc
   */
  init: function () {
    this._super();
    this._socketListeners = {};
    this.fetchCsrfToken();
    this.socketAddListener('connect', this._handleSocketConnect);
  },

  /**
   * @since 0.0.1
   * @inheritDoc
   */
  destroy: function () {
    Ember.keys(this._socketListeners).map(this.socketRemoveListener, this);
    this._super();
  },

  /**
   * Adds an event listener to the socket with some meta
   *
   * @since 0.0.1
   * @method socketAddListener
   * @param {String} event The event to listen to
   * @param {Function|String} callback The method to be called (will be bound on the adapter)
   * @param {mixed} [metadata] SOme metadata to store and get passed over the callback
   * @param (Boolean} [autoReAttach] Whether to re-attach the listener after a reconnection
   * @chainable
   */
  socketAddListener: function (event, callback, metadata, autoReAttach) {
    var def = this._socketListeners[event];
    if (def) {
      this._log('info', 'already listening for ' + event, def);
      return;
    }
    callback = typeof callback === 'string' ? this[callback] : callback;
    def = this._socketListeners[event] = {data: metadata, event: event, autoReAttach: !!autoReAttach};
    def.callback = callback.bind(this, def);
    io.socket.addListener(event, def.callback);
    this._log('debug', 'listening for ' + event, def);
    return this;
  },

  /**
   * Remove an event listener and stop listening for that even on the socket
   *
   * @since 0.0.1
   * @method socketRemoveListener
   * @param {String} event The event to stop listening for
   * @chainable
   */
  socketRemoveListener: function (event) {
    var def = this._socketListeners[event];
    if (!def) {
      this._log('info', 'not listening for ' + event + ' yet');
      return;
    }
    delete this._socketListeners[event];
    io.socket.removeListener(event, def.callback);
    this._log('debug', 'stop listening for ' + event, def);
    return this;
  },

  /**
   * Re-attach all listeners on the socket
   *
   * @since 0.0.1
   * @method socketRebindListeners
   * @chainable
   */
  socketRebindListeners: function () {
    var meta;
    for (var event in this._socketListeners) {
      meta = this._socketListeners[event];
      if (meta.autoReAttach) {
        try {
          io.socket.removeListener(event, meta.callback);
        }
        catch (e) {
          // noop
        }
        io.socket.addListener(event, meta.callback);
        this._log('info', 're-attached listener for ' + event, meta);
      }
    }
    return this;
  },

  /**
   * Finds whether the socket is listening for an event or not
   *
   * @since 0.0.1
   * @method socketIsListening
   * @param {String} event The event to test
   * @returns {Boolean} Returns `true` if we're listening for that event, else `false`
   */
  socketIsListening: function (event) {
    return !!this._socketListeners[event];
  },

  /**
   * @since 0.0.1
   * @method ajax
   * @inheritDoc
   */
  ajax: function (url, method, data) {
    return this.socket(url, method, data);
  },

  /**
   * Send a message over the socket
   *
   * @since 0.0.1
   * @method socket
   * @param {String} url The HTTP URL to fake
   * @param {String} method The HTTP method to fake
   * @param {Object} data The data to send
   * @returns {Ember.RSVP.Promise} A promise resolving to the result or an error
   */
  socket: function (url, method, data) {
    method = method.toLowerCase();
    var self = this, req = data;
    if (method !== 'get') {
      this.checkCSRF(data);
    }
    return new Ember.RSVP.Promise(function (resolve, reject) {
      io.socket[method](url, data, function (data) {
        var res = data, cb = reject, level = 'warning';
        if (self.isErrorObject(data)) {
          if (data.errors) {
            level = 'error';
            res = new DS.InvalidError(self.formatError(data));
          }
        }
        else {
          cb = resolve;
          level = 'info';
        }
        self._log(level, 'socket request: ' + method + ' ' + url, {request: req, response: data});
        cb(res);
      });
    });
  },

  /**
   * @since 0.0.1
   * @method buildUrl
   * @inheritDoc
   */
  buildURL: function (type) {
    this._listenToSocket(type);
    return this._super.apply(this, arguments);
  },

  /**
   * @since 0.0.1
   * @method createRecord
   * @inheritDoc
   */
  createRecord: function (store, type, record) {
    var serializer = store.serializerFor(type.typeKey);
    var data = serializer.serialize(record, { includeId: true });
    var self = this;
    return this.ajax(this.buildURL(type.typeKey, null, record), "POST", data).then(function (payload) {
      return self._newPayload(store, type, payload);
    });
  },

  /**
   * @since 0.0.1
   * @method updateRecord
   * @inheritDoc
   */
  updateRecord: function (store, type, record) {
    var serializer = store.serializerFor(type.typeKey);
    var data = serializer.serialize(record, { includeId: true });
    var self = this;
    return this.ajax(
      this.buildURL(type.typeKey, data.id, record), "PUT", data
    ).then(
      function (payload) {
        return self._newPayload(store, type, payload);
      }
    );
  },

  /**
   * @since 0.0.1
   * @method find
   * @inheritDoc
   */
  find: function (store, type/*, id, record*/) {
    var self = this;
    return this._super.apply(arguments).then(function (payload) {
      return self._newPayload(store, type, payload);
    });
  },

  /**
   * @since 0.0.1
   * @method findAll
   * @inheritDoc
   */
  findAll: function (store, type/*, sinceToken*/) {
    var self = this;
    return this._super.apply(this, arguments).then(function (payload) {
      return self._newPayload(store, type, payload);
    });
  },

  /**
   * @since 0.0.1
   * @method findBelongsTo
   * @inheritDoc
   */
  findBelongsTo: function (/*store, record, url*/) {
    // TODO: check what is returning Sails in that case
    return this._super.apply(this, arguments);
  },

  /**
   * @since 0.0.1
   * @method findHasMany
   * @inheritDoc
   */
  findHasMany: function (/*store, record, url*/) {
    // TODO: check what is returning Sails in that case
    return this._super.apply(this, arguments);
  },

  /**
   * @since 0.0.1
   * @method findMany
   * @inheritDoc
   */
  findMany: function (store, type, ids/*, records*/) {
    return this.findQuery(store, type, {where: {id: ids}});
  },

  /**
   * @since 0.0.1
   * @method findQuery
   * @inheritDoc
   */
  findQuery: function (store, type, query) {
    var self = this;
    return this.ajax(this.buildURL(type.typeKey), 'GET', query).then(function (payload) {
      return self._newPayload(store, type, payload);
    });
  },

  /**
   * @since 0.0.1
   * @method deleteRecord
   * @inheritDoc
   */
  deleteRecord: function (store, type, record) {
    var self = this;
    return this.ajax(
      this.buildURL(type.typeKey, record.get('id'), record),
      'DELETE',
      {}
    ).then(function (payload) {
        return self._newPayload(store, type, payload);
      }
    );
  },

  /**
   * Fetches the CSRF token
   *
   * @since 0.0.3
   * @method fetchCsrfToken
   */
  fetchCsrfToken: function () {
    // on connection we need to re-new the CSRF
    io.socket.get('/csrfToken', function (tokenObject) {
      this._log('debug', 'got new CSRF token', tokenObject);
      this.csrfToken = tokenObject._csrf;
    }.bind(this));
  },

  /**
   * Handle `connect` event of the socket
   *
   * @since 0.0.1
   * @method _handleSocketConnect
   * @private
   */
  _handleSocketConnect: function () {
    this.csrfToken = null;
    this.socketRebindListeners();
    if (this.useCSRF) {
      this.fetchCsrfToken();
    }
  },

  /**
   * Handle reception of messages over the socket
   * @since 0.0.1
   * @method _handleSocketMessage
   * @param {Object} meta The meta containing `data`, `event`, `autoReAttach` and `callback`
   * @param {Object} message The message received
   * @private
   */
  _handleSocketMessage: function (meta, message) {
    var method = '_handleSocketRecord' + message.verb.capitalize();
    this._log('debug', 'new event ' + meta.event + ':' + message.verb + ', message:', message);
    if (this[method]) {
      Ember.run.next(this, method, meta, message);
    }
    else {
      this._log('notice', 'nothing to handle message with verb ' + message.verb);
    }
  },

  /**
   * Handle a created record message
   *
   * @since 0.0.1
   * @method _handleSocketRecordCreated
   * @param {Object} meta The meta containing `data`, `event`, `autoReAttach` and `callback`
   * @param {Object} message The message received
   * @private
   */
  _handleSocketRecordCreated: function (meta, message) {
    var type = meta.data.type,
      store = meta.data.store,
      record = message.data;
    if (!record.id && message.id) {
      record.id = message.id;
    }
    store.pushPayload(store, this._newPayload(store, type, record));
  },

  /**
   * Handle a updated record message
   *
   * @since 0.0.1
   * @method _handleSocketRecordUpdated
   * @param {Object} meta The meta containing `data`, `event`, `autoReAttach` and `callback`
   * @param {Object} message The message received
   * @private
   */
  _handleSocketRecordUpdated: Ember.aliasMethod('_handleSocketRecordCreated'),

  /**
   * Handle a destroyed record message
   *
   * @since 0.0.1
   * @method _handleSocketRecordDestroyed
   * @param {Object} meta The meta containing `data`, `event`, `autoReAttach` and `callback`
   * @param {Object} message The message received
   * @private
   */
  _handleSocketRecordDestroyed: function (meta, message) {
    var type = meta.data.type,
      store = meta.data.store,
      record = store.getById(type.typeKey, message.id);
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
    var eventName = Ember.String.camelize(model).toLowerCase();
    if (this.socketIsListening(eventName)) {
      return;
    }
    var store = this.container.lookup('store:main');
    var type = store.modelFor(model);
    this.socketAddListener(eventName, this._handleSocketMessage, {store: store, type: type}, true);
  }
});
