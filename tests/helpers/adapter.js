import Ember from 'ember';
import SailsSocketAdapter from 'ember-data-sails/adapters/sails-socket';
import SailsRESTAdapter from 'ember-data-sails/adapters/sails-rest';

export function adapterCall(adapter, returnPromise, method) {
  var args = [].slice.call(arguments, 2), old = adapter._request, res;
  adapter._request = function (out, url, method, options) {
    if (adapter instanceof SailsSocketAdapter) {
      out.protocol = 'socket';
    }
    else if (adapter instanceof SailsRESTAdapter) {
      out.protocol = 'http';
    }
    res = { out: out, url: url, method: method, options: options };
    return returnPromise;
  };
  return new Ember.RSVP.Promise(function (resolve, reject) {
    adapter[method].apply(adapter, args)
      .then(resolve, reject)
      .finally(function () {
        adapter._request = old;
      });
  });
}
