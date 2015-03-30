import DS from 'ember-data';
import Ember from 'ember';
import WithLoggerMixin from '../mixins/with-logger';


var EmberString = Ember.String;
var fmt = EmberString.fmt;
var pluralize = EmberString.pluralize;
var camelize = EmberString.camelize;
var run = Ember.run;
var schedule = run.schedule;
var bind = run.bind;
var $ = Ember.$;
var RSVP = Ember.RSVP;
var computed = Ember.computed;
var bool = computed.bool;

/**
 * Base adapter for SailsJS adapters
 *
 * @since 0.0.1
 * @class SailsBaseAdapter
 * @extends DS.RESTAdapter
 * @uses Ember.Evented
 * @uses WithLoggerMixin
 * @constructor
 */
export default DS.RESTAdapter.extend(Ember.Evented, WithLoggerMixin, {
  /**
   * @inheritDoc
   */
  defaultSerializer: 'sails',

  /**
   * Whether to use CSRF
   * @since 0.0.1
   * @property useCSRF
   * @type Boolean
   */
  useCSRF: false,

  /**
   * Path where to GET the CSRF
   * @since 0.0.15
   * @property csrfTokenPath
   * @type String
   */
  csrfTokenPath: '/csrfToken',

  /**
   * The csrfToken
   * @since 0.0.1
   * @property csrfToken
   * @type String
   */
  csrfToken: null,

  /**
   * Are we loading CSRF token?
   * @since 0.0.7
   * @property isLoadingCSRF
   * @type Boolean
   */
  isLoadingCSRF: bool('_csrfTokenLoadingPromise'),

  /**
   * The promise responsible of the current CSRF token fetch
   * @since 0.0.15
   * @property _csrfTokenLoadingPromise
   * @type Promise
   * @private
   */
  _csrfTokenLoadingPromise: null,


  /**
   * @since 0.0.4
   * @method init
   * @inheritDoc
   */
  init: function () {
    this._super();
    this.set('csrfToken', null);
  },

  /**
   * Send a message using `_request` of extending class
   *
   * @since 0.0.11
   * @method ajax
   * @inheritDoc
   */
  ajax: function (url, method, options) {
    var processRequest, out = {};
    method = method.toUpperCase();
    if (!options) {
      options = {};
    }
    if (!options.data && method !== 'GET') {
      // so that we can add our CSRF token
      options.data = {};
    }
    processRequest = bind(this, function () {
      return this._request(out, url, method, options)
        .then(bind(this, function (response) {
          this.info(fmt('%@ %@ request on %@: SUCCESS', out.protocol, method, url));
          this.debug('  → request:', options.data);
          this.debug('  ← response:', response);
          if (this.isErrorObject(response)) {
            if (response.errors) {
              return RSVP.reject(new DS.InvalidError(this.formatError(response)));
            }
            return RSVP.reject(response);
          }
          return response;
        }))
        .catch(bind(this, function (error) {
          this.warn(fmt('%@ %@ request on %@: ERROR', out.protocol, method, url));
          this.info('  → request:', options.data);
          this.info('  ← error:', error);
          return RSVP.reject(error);
        }));
    });
    if (method !== 'GET') {
      return this.fetchCSRFToken()
        .then(bind(this, function () {
          this.checkCSRF(options.data);
          return processRequest();
        }));
    }
    else {
      return processRequest();
    }
  },

  /**
   * @since 0.0.1
   * @method ajaxError
   * @inheritDoc
   */
  ajaxError: function (jqXHR) {
    var error = this._super(jqXHR);
    var data;

    try {
      data = $.parseJSON(jqXHR.responseText);
    }
    catch (err) {
      data = jqXHR.responseText;
    }

    if (data.errors) {
      this.error('error returned from Sails', data);
      return new DS.InvalidError(this.formatError(data));
    }
    else if (data) {
      return new Error(data);
    }
    else {
      return error;
    }
  },

  /**
   * Fetches the CSRF token if needed
   *
   * @since 0.0.3
   * @method fetchCSRFToken
   * @param {Boolean} [force] If `true`, the token will be fetched even if it has already been fetched
   * @return {RSVP.Promise}
   */
  fetchCSRFToken: function (force) {
    var self = this, promise;
    if (this.get('useCSRF') && (force || !this.get('csrfToken'))) {
      if (!(promise = this.get('_csrfTokenLoadingPromise'))) {
        this.set('csrfToken', null);
        this.debug('fetching CSRF token...');
        promise = this._fetchCSRFToken()
          // handle success response
          .then(function (token) {
            if (!token) {
              self.error('Got an empty CSRF token from the server.');
              return RSVP.reject('Got an empty CSRF token from the server!');
            }
            self.info('got a new CSRF token:', token);
            self.set('csrfToken', token);
            schedule('actions', self, 'trigger', 'didLoadCSRF', token);
            return token;
          })
          // handle errors
          .catch(function (error) {
            self.error('error trying to get new CSRF token:', error);
            schedule('actions', self, 'trigger', 'didLoadCSRF', null, error);
            return error;
          })
          // reset the loading promise
          .finally(bind(this, 'set', '_csrfTokenLoadingPromise', null));
        this.set('_csrfTokenLoadingPromise', promise);
      }
      // return the loading promise
      return promise;
    }
    return RSVP.resolve(null);
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
    return pluralize(camelize(type));
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
    return !!(data && data.error && data.model && data.summary && data.status);
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
    this.info('adding CSRF token');
    if (!this.csrfToken) {
      this.error('CSRF not fetched yet');
      throw new Error("CSRF Token not fetched yet.");
    }
    data._csrf = this.csrfToken;
    return data;
  }
});
