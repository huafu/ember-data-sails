import Evented from '@ember/object/evented';
import $ from 'jquery';
import RSVP from 'rsvp';
import {bind, schedule} from '@ember/runloop';
import {camelize} from '@ember/string';
import {set, get} from '@ember/object';
import DS from 'ember-data';
import Ember from 'ember';
import WithLoggerMixin from '../mixins/with-logger';
import {pluralize} from 'ember-inflector';
import {bool} from '@ember/object/computed'
import { debug, warn } from '@ember/debug';

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
export default DS.RESTAdapter.extend(Evented, WithLoggerMixin, {
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
		set(this, 'csrfToken', null);
	},

	/**
	 * Send a message using `_request` of extending class
	 *
	 * @since 0.0.11
	 * @method ajax
	 * @inheritDoc
	 */
	ajax: function (url, method, options) {
		const out = {};
		method = method.toUpperCase();
		if (!options) {
			options = {};
		}
		if (!options.data && method !== 'GET') {
			// so that we can add our CSRF token
			options.data = {};
		}
		const processRequest = bind(this, function () {
			return this._request(out, url, method, options)
				.then(bind(this, function (response) {
					debug(`${out.protocol} ${method} request on ${url}: SUCCESS`);
					debug('  → request:', options.data);
					debug('  ← response:', response);
					if (this.isErrorObject(response)) {
						if (response.errors) {
							return RSVP.reject(new DS.InvalidError(this.formatError(response)));
						}
						return RSVP.reject(response);
					}
					return response;
				}))
				.catch(bind(this, function (error) {
					warn(`${out.protocol} ${method} request on ${url}: ERROR`, false, { id: 'bc-ember-data-sails.failed-request' });
					debug('  → request:', options.data);
					debug('  ← error:', error);
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
		const error = this._super(jqXHR);
		let data;

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
		let promise;
		if (get(this, 'useCSRF') && (force || !get(this, 'csrfToken'))) {
			if (!(promise = get(this, '_csrfTokenLoadingPromise'))) {
				this.set('csrfToken', null);
				debug('fetching CSRF token...');
				promise = this._fetchCSRFToken()
				// handle success response
					.then(token => {
						if (!token) {
							this.error('Got an empty CSRF token from the server.');
							return RSVP.reject('Got an empty CSRF token from the server!');
						}
						debug('got a new CSRF token:', token);
						this.set('csrfToken', token);
						schedule('actions', this, 'trigger', 'didLoadCSRF', token);
						return token;
					})
					// handle errors
					.catch(error => {
						this.error('error trying to get new CSRF token:', error);
						schedule('actions', this, 'trigger', 'didLoadCSRF', null, error);
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
		debug('adding CSRF token');
		if (!this.csrfToken) {
			throw new Error("CSRF Token not fetched yet.");
		}
		data._csrf = this.csrfToken;
		return data;
	}
});
