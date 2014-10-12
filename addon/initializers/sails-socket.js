/* global io */

/**
 * Defers the readiness of the application until the `io.socket` is fully ready
 * For now it's a hack since using `io.socket.on('connect')` is doing a lot of mess
 * adding as many listener as it's tryin to connect, same for futher events
 *
 * @since 0.0.1
 * @method initialize
 * @param {Ember.Container} container
 * @param {Ember.Application} application
 */
export var initialize = function (container, application) {
  var checkConnect;

  if (!io.socket.socket || !io.socket.socket.open) {
    application.deferReadiness();

    checkConnect = function () {
      if (!io.socket.socket || !io.socket.socket.open) {
        setTimeout(checkConnect, 50);
      }
      else {
        setTimeout(application.advanceReadiness.bind(application), 10);
      }
    };

    checkConnect();
  }
};

/**
 * Sails socket initializer for Ember application
 *
 * @class SailsSocketInitializer
 * @since 0.0.1
 * @constructor
 */
export default {
  name:   'sails-socket',
  before: 'store',

  initialize: initialize
};
