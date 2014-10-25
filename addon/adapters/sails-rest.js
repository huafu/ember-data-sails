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
        self.info('http %@ request on %@: SUCCESS'.fmt(method, url));
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
        self.warn('http %@ request on %@: ERROR'.fmt(method, url));
        self.info('  → request: %@', data);
        self.info('  ← error: %@', error);
        return Ember.RSVP.reject(error);
      });
    };
    if (method !== 'GET') {
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
