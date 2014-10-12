import DS from 'ember-data';
import Ember from 'ember';


/**
 * Base adapter for SailsJS adapters
 *
 * @since 0.0.1
 * @class SailsBaseAdapter
 * @extends DS.RESTAdapter
 * @constructor
 */
export default DS.RESTAdapter.extend({
  /**
   * Whether to use CSRF
   * @since 0.0.1
   * @property useCSRF
   * @type Boolean
   */
  useCSRF:   true,
  /**
   * The csrfToken
   * @since 0.0.1
   * @property csrfToken
   * @type String
   */
  csrfToken: null,

  /**
   * @since 0.0.4
   * @method init
   * @inheritDoc
   */
  init: function () {
    this._super();
    this.fetchCsrfToken();
  },

  /**
   * @since 0.0.1
   * @method ajaxError
   * @inheritDoc
   */
  ajaxError: function (jqXHR) {
    var error = this._super(jqXHR);
    var data = Ember.$.parseJSON(jqXHR.responseText);

    if (data.errors) {
      Ember.warn('error returned from Sails' + Ember.inspect(data));
      return new DS.InvalidError(this.formatError(data));
    }
    else {
      return error;
    }
  },

  /**
   * Fetches the CSRF token if needed
   *
   * @since 0.0.3
   * @method fetchCsrfToken
   */
  fetchCsrfToken: function () {
    this.csrfToken = null;
    if (this.useCSRF) {
      this._fetchCsrfToken();
    }
  },

  /**
   * Format an error coming from Sails
   *
   * @since 0.0.1
   * @method formatError
   * @param {Object} error The error to format
   * @return {Object}
   */
  formatError: function (error) {
    return Object.keys(error.invalidAttributes).reduce(function (memo, property) {
      memo[property] = error.invalidAttributes[property].map(function (err) {
        return err.message;
      });
      return memo;
    }, {});
  },

  /**
   * @since 0.0.1
   * @method pathForType
   * @inheritDoc
   */
  pathForType: function (type) {
    return Ember.String.camelize(type).pluralize();
  },

  /**
   * Is the given result a Sails error object?
   *
   * @since 0.0.1
   * @method isErrorObject
   * @param {Object} data The object to test
   * @return {Boolean} Returns `true` if it's an error object, else `false`
   */
  isErrorObject: function (data) {
    return !!(data.error && data.model && data.summary && data.status);
  },

  /**
   * Check if we have a CSRF and include it in the given data to be sent
   *
   * @since 0.0.1
   * @method checkCSRF
   * @param {Object} [data] The data on which to attach the CSRF token
   * @return {Object} data The given data
   */
  checkCSRF: function (data) {
    if (!this.useCSRF) {
      return data;
    }
    Ember.debug('adding CSRF token');
    if (!this.csrfToken || this.csrfToken.length === 0) {
      Ember.warn('CSRF not fetched yet');
      throw new DS.Error("CSRF Token not fetched yet.");
    }
    data._csrf = this.csrfToken;
    return data;
  },

  /**
   * Creates a new payload and inject the optionally given record of given type
   *
   * @since 0.0.1
   * @method _newPayload
   * @param {DS.Store} store The store to be used
   * @param {subclass of DS.Model} [type] The model of the record(s) to inject
   * @param {Object|Array<Object>} [record] The record(s) to inject
   * @return {Object} The created payload
   * @private
   */
  _newPayload: function (store, type, record) {
    var res = {}, extracted;
    Ember.debug('created new payload');
    if (arguments.length > 0) {
      extracted = [];
      this._payloadInject(store, res, type, record, extracted);
    }
    return res;
  },

  /**
   * Inject the given record of given type into the given payload
   *
   * @since 0.0.1
   * @method _payloadInject
   * @param {DS.Store} store The store to be used
   * @param {Object} payload The payload in which to inject the record(s)
   * @param {subclass of DS.Model} type The model of the record(s) to inject
   * @param {Object|Array<Object>} record The record(s) to inject
   * @return {Object} The updated payload
   * @private
   */
  _payloadInject: function (store, payload, type, record, _extracted) {
    var index, records, toExtract,
      self = this,
      typeKey = type.typeKey.pluralize();
    if (!payload[typeKey]) {
      payload[typeKey] = [];
    }
    if (record) {
      records = Ember.typeOf(record) === 'array' ? record : [record];
      index = {};
      toExtract = [];
      payload[typeKey].forEach(function (record) {
        index['' + record.id] = 0;
      });
      records.forEach(function (record) {
        var id = '' + record.id;
        if (!record.id) {
          Ember.warn('got a record without id: %@'.fmt(Ember.inspect(record)));
          throw new ReferenceError('Got a record without id for ' + typeKey);
        }
        if (!(id in index)) {
          index[id] = 0;
          payload[typeKey].push(record);
          Ember.debug('injected one %@ record: %@'.fmt(typeKey, Ember.inspect(record)));
          toExtract.push(record);
        }
      });
      toExtract.forEach(function (record) {
        self._payloadExtractEmbedded(store, payload, type, record, _extracted);
      });
    }
    return payload;
  },

  /**
   * Extract embedded records from the given record and inject them into the given payload
   *
   * @since 0.0.1
   * @method _payloadExtractEmbedded
   * @param {DS.Store} store The store to be used
   * @param {Object} payload The payload in which to inject the found record(s)
   * @param {subclass of DS.Model} type The model of the record to inspect
   * @param {Object|Array<Object>} record The record to inspect
   * @return {Object} The updated payload
   * @private
   */
  _payloadExtractEmbedded: function (store, payload, type, record, _extracted) {
    var extracted = _extracted ? _extracted : [],
      self = this;
    if (extracted.indexOf(record) < 0) {
      extracted.push(record);
      type.eachRelationship(function (key, rel) {
        var data;
        if ((data = record[key])) {
          if (rel.kind === 'belongsTo') {
            if (Ember.typeOf(record[key]) === 'object') {
              Ember.debug('found 1 embedded %@ record: %@'.fmt(rel.type.typeKey, Ember.inspect(record[key])));
              delete record[key];
              self._payloadInject(store, payload, rel.type, data, extracted);
              record[key] = data.id;
            }
          }
          else if (rel.kind === 'hasMany') {
            record[key] = data.map(function (item) {
              if (Ember.typeOf(item) === 'object') {
                Ember.debug('found 1 embedded %@ record: %@'.fmt(rel.type.typeKey, Ember.inspect(record[key])));
                self._payloadInject(store, payload, rel.type, item, extracted);
                return item.id;
              }
              return item;
            });
          }
          else {
            Ember.warn('unknown relationship kind %@: %@'.fmt(rel.kind, Ember.inspect(rel)));
            throw new ReferenceError('Unknown relationship kind ' + rel.kind);
          }
        }
      });
    }
    return payload;
  }
});
