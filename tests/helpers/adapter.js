import { Promise as EmberPromise } from 'rsvp';
import SailsSocketAdapter from 'ember-data-sails/adapters/sails-socket';
import SailsRESTAdapter from 'ember-data-sails/adapters/sails-rest';

export function adapterCall(adapter, returnPromise, method) {
	const args = [].slice.call(arguments, 2);
	const old = adapter._request;

	adapter._request = function (out) {
		if (adapter instanceof SailsSocketAdapter) {
			out.protocol = 'socket';
		}
		else if (adapter instanceof SailsRESTAdapter) {
			out.protocol = 'http';
		}
		return returnPromise;
	};

	return new EmberPromise(function (resolve, reject) {
		adapter[method].apply(adapter, args)
			.then(resolve, reject)
			.finally(function () {
				adapter._request = old;
			});
	});
}
