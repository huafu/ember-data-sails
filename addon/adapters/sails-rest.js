import DS from 'ember-data';
import Ember from 'ember';
import SailsBaseAdapter from 'ember-data-sails/adapters/sails-base';

/**
 * Adapter for SailsJS HTTP REST API
 *
 * @since 0.0.8
 * @class SailsRESTAdapter
 * @extends SailsBaseAdapter
 * @constructor
 */
export default SailsBaseAdapter.extend({
  /**
   * @since 0.0.8
   * @method ajax
   * @inheritDoc
   */
  ajax: function (url, method, data) {
    var self = this, run;
    method = method.toUpperCase();
    run = function () {
      return self._restAdapter_ajax(url, method, data).then(function (response) {
        Ember.debug('[ed-sails] http %@ request on %@'.fmt(method, url));
        Ember.debug('[ed-sails]   -> request: %@'.fmt(Ember.inspect(data)));
        Ember.debug('[ed-sails]   <- response: %@'.fmt(Ember.inspect(response)));
        if (self.isErrorObject(response)) {
          if (response.errors) {
            return Ember.RSVP.reject(new DS.InvalidError(self.formatError(response)));
          }
          return Ember.RSVP.reject(response);
        }
        return response;
      }).catch(function (error) {
        Ember.warn('[ed-sails] http %@ request on %@'.fmt(method, url));
        Ember.warn('[ed-sails]   -> request: %@'.fmt(Ember.inspect(data)));
        Ember.warn('[ed-sails]   <- error: %@'.fmt(Ember.inspect(error)));
        return Ember.RSVP.reject(error);
      });
    };
    if (method !== 'GET') {
      return this.fetchCSRFToken().then(function () {
        this.checkCSRF(data);
        return run();
      });
    }
    else {
      return run();
    }
  },

  /**
   * @since 0.0.8
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
   * @since 0.0.8
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
   * @since 0.0.8
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
   * @since 0.0.8
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
   * @since 0.0.8
   * @method findBelongsTo
   * @inheritDoc
   */
  findBelongsTo: function (/*store, record, url*/) {
    // TODO: check what is returning Sails in that case
    return this._super.apply(this, arguments);
  },

  /**
   * @since 0.0.8
   * @method findHasMany
   * @inheritDoc
   */
  findHasMany: function (/*store, record, url*/) {
    // TODO: check what is returning Sails in that case
    return this._super.apply(this, arguments);
  },

  /**
   * @since 0.0.8
   * @method findMany
   * @inheritDoc
   */
  findMany: function (store, type, ids/*, records*/) {
    return this.findQuery(store, type, {where: {id: ids}});
  },

  /**
   * @since 0.0.8
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
   * @since 0.0.8
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
    return this.ajax('get', '/csrfToken').then(function (tokenObject) {
      return tokenObject._csrf;
    });
  },

  /**
   * Since Ember class model doesn't support `super` while in async mode, we need to copy the original
   * `ajax` method to be able ot use it inside our own `ajax` inside async code.
   *
   * @since 0.0.8
   * @method _restAdapter_ajax
   * @private
   * @param {String} url
   * @param {String} type The request type GET, POST, PUT, DELETE etc.
   * @param {Object} hash
   * @return {Promise} promise
   */
  _restAdapter_ajax: DS.RESTAdapter.proto().ajax
});
