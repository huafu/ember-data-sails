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
   * @since 0.0.1
   * @method init
   * @inheritDoc
   */
  init: function () {
    this._super();
    this.get('sailsSocket').on('didConnect', this, 'fetchCSRFToken', true);
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
   * @return {Ember.RSVP.Promise} A promise resolving to the result or an error
   */
  socket: function (url, method, data) {
    method = method.toLowerCase();
    var self = this, run;
    run = function () {
      return self.get('sailsSocket').call(method, url, data).then(function (response) {
        self.info('socket %@ request on %@: SUCCESS'.fmt(method, url));
        self.debug('  → request:', data);
        self.debug('  ← response:', response);
        if (self.isErrorObject(response)) {
          if (response.errors) {
            return Ember.RSVP.reject(new DS.InvalidError(self.formatError(response)));
          }
          return Ember.RSVP.reject(response);
        }
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
    return this._super.apply(this, arguments).then(function (payload) {
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
   * @since 0.0.4
   * @method _fetchCSRFToken
   * @return {Ember.RSVP.Promise} Returns the promise resolving the CSRF token
   * @private
   */
  _fetchCSRFToken: function () {
    return this.get('sailsSocket').call('get', '/csrfToken').then(function (tokenObject) {
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
    store.pushPayload(type, this._newPayload(store, type, record));
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
  }
});
