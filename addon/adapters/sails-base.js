import DS from 'ember-data';
import Ember from 'ember';


var LOG_LEVELS = ['debug', 'info', 'notice', 'warning', 'error', 'fatal'];
var LOG_LEVEL_CONSOLE = {
  fatal:   'error',
  warning: 'warn'
};

/**
 * Base adapter for SailsJS
 * (tested with Sails version `10.0.5`)
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
  useCSRF:  true,
  /**
   * Min log level to log in the console
   * @since 0.0.1
   * @property logLevel
   * @type String
   */
  logLevel: 'warning',

  /**
   * The csrfToken
   * @since 0.0.1
   * @property csrfToken
   * @type String
   */
  csrfToken: null,

  /**
   * @since 0.0.1
   * @method ajaxError
   * @inheritDoc
   */
  ajaxError: function (jqXHR) {
    var error = this._super(jqXHR);
    var data = Ember.$.parseJSON(jqXHR.responseText);

    if (data.errors) {
      this._log('error', 'error returned from Sails', data);
      return new DS.InvalidError(this.formatError(data));
    }
    else {
      return error;
    }
  },

  /**
   * Format an error coming from Sails
   *
   * @since 0.0.1
   * @method formatError
   * @param {Object} error The error to format
   * @returns {Object}
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
   * @returns {Boolean} Returns `true` if it's an error object, else `false`
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
   * @returns {Object} data The given data
   */
  checkCSRF: function (data) {
    if (!this.useCSRF) {
      return data;
    }
    this._log('info', 'adding CSRF token');
    if (!this.csrfToken || this.csrfToken.length === 0) {
      this._log('error', 'CSRF not fetched yet');
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
    this._log('debug', 'created new payload');
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
          self._log('fatal', 'got a record without id', record);
          throw new ReferenceError('Got a record without id for ' + typeKey);
        }
        if (!(id in index)) {
          index[id] = 0;
          payload[typeKey].push(record);
          self._log('debug', 'injected one ' + typeKey + ' record', record);
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
   * @param {Object|Array<Object>} record The record to inpect
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
              self._log('debug', 'found 1 embedded ' + rel.type.typeKey + ' record', record[key]);
              delete record[key];
              self._payloadInject(store, payload, rel.type, data, extracted);
              record[key] = data.id;
            }
          }
          else if (rel.kind === 'hasMany') {
            record[key] = data.map(function (item) {
              if (Ember.typeOf(item) === 'object') {
                self._log('debug', 'found 1 embedded ' + rel.type.typeKey + ' record', record[key]);
                self._payloadInject(store, payload, rel.type, item, extracted);
                return item.id;
              }
              return item;
            });
          }
          else {
            self._log('fatal', 'unknown relationship kind ' + rel.kind, rel);
            throw new ReferenceError('Unknown relationship kind ' + rel.kind);
          }
        }
      });
    }
    return payload;
  },

  /**
   * Log a message if it is higher than `logLevel`
   *
   * @since 0.0.1
   * @param {String} level The level
   * @param {mixed} message* The message and data to log
   * @private
   */
  _log: function (level/*, message*/) {
    var lvl = LOG_LEVEL_CONSOLE[level];
    if (LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(this.logLevel)) {
      console[lvl ? lvl : level].apply(console, [].slice.call(arguments, 1));
    }
  }
});
