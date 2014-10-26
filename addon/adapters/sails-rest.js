import DS from 'ember-data';
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
   * Sends a request over HTTP
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
  _request: function(out, url, method, options) {
    out.protocol = 'http';
    return this._restAdapter_ajax.call(this, url, method, options);
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
    return this._restAdapter_ajax.call(this, '/csrfToken', 'get').then(function (tokenObject) {
      return tokenObject._csrf;
    });
  },

  /**
   * We need to copy the original `ajax` method to be able ot use it inside our own `_request`
   *
   * @since 0.0.8
   * @method _restAdapter_ajax
   * @private
   * @param {String} url
   * @param {String} type The request type GET, POST, PUT, DELETE etc.
   * @param {Object} hash
   * @return {Ember.RSVP.Promise} promise
   */
  _restAdapter_ajax: DS.RESTAdapter.proto().ajax
});
