import DS from 'ember-data';
import Ember from 'ember';
import WithLoggerMixin from '../mixins/with-logger';


var EmberString = Ember.String;
var fmt = EmberString.fmt;

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
  defaultSerializer: 'sails',
  /**
   * Whether to use CSRF
   * @since 0.0.1
   * @property useCSRF
   * @type Boolean
   */
  useCSRF:           null,
  /**
   * The csrfToken
   * @since 0.0.1
   * @property csrfToken
   * @type String
   */
  csrfToken:         null,
  /**
   * Are we loading CSRF token?
   * @since 0.0.7
   * @property isLoadingCSRF
   * @type Boolean
   */
  isLoadingCSRF:     null,

  /**
   * @since 0.0.4
   * @method init
   * @inheritDoc
   */
  init: function () {
    this._super();
    this.set('isLoadingCSRF', false);
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
    var self = this, run, out = {};
    method = method.toUpperCase();
    if (!options) {
      options = {};
    }
    if (!options.data && method !== 'GET') {
      // so that we can add our CSRF token
      options.data = {};
    }
    run = function () {
      return self._request(out, url, method, options).then(function (response) {
        self.info(fmt('%@ %@ request on %@: SUCCESS', out.protocol, method, url));
        self.debug('  → request:', options.data);
        self.debug('  ← response:', response);
        if (self.isErrorObject(response)) {
          if (response.errors) {
            return Ember.RSVP.reject(new DS.InvalidError(self.formatError(response)));
          }
          return Ember.RSVP.reject(response);
        }
        return response;
      }).catch(function (error) {
        self.warn(fmt('%@ %@ request on %@: ERROR', out.protocol, method, url));
        self.info('  → request:', options.data);
        self.info('  ← error:', error);
        return Ember.RSVP.reject(error);
      });
    };
    if (method !== 'GET') {
      return this.fetchCSRFToken().then(function () {
        self.checkCSRF(options.data);
        return run();
      });
    }
    else {
      return run();
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
      data = Ember.$.parseJSON(jqXHR.responseText);
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
   * @return {Ember.RSVP.Promise}
   */
  fetchCSRFToken: function (force) {
    var self = this;
    if (this.get('useCSRF') && (force || !this.get('csrfToken'))) {
      if (this.get('isLoadingCSRF')) {
        return new Ember.RSVP.Promise(function (resolve, reject) {
          self.one('didLoadCSRF', function (token, error) {
            if (token) {
              resolve(token);
            }
            else {
              reject(error);
            }
          });
        }, 'waiting for CSRF to load');
      }
      else {
        this.set('isLoadingCSRF', true);
        this.set('csrfToken', null);
        this.debug('fetching CSRF token...');
        return this._fetchCSRFToken()
          .then(function (token) {
            self.set('isLoadingCSRF', false);
            self.info('got a new CSRF token:', token);
            self.set('csrfToken', token);
            Ember.run.next(self, 'trigger', 'didLoadCSRF', token);
            return token;
          })
          .catch(function (error) {
            self.set('isLoadingCSRF', false);
            self.error('error trying to get new CSRF token:', error);
            Ember.run.next(self, 'trigger', 'didLoadCSRF', null, error);
            return error;
          });
      }
    }
    return Ember.RSVP.resolve(null);
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
    this.info('adding CSRF token');
    if (!this.csrfToken || this.csrfToken.length === 0) {
      this.error('CSRF not fetched yet');
      throw new DS.Error("CSRF Token not fetched yet.");
    }
    data._csrf = this.csrfToken;
    return data;
  }
});
