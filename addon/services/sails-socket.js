/* global io */
import Ember from 'ember';

/**
 * Shortcut to know if an object is alive or not
 *
 * @since 0.0.4
 * @param {Ember.Object} obj The object to test
 * @returns {Boolean} Returns `true` if the object is still alive, else `false`
 * @private
 */
function isAlive(obj) {
  if (!obj || obj.isDestroying || obj.isDestroyed) {
    return false;
  }
  return true;
}

/**
 * Layer on top of io.socket from Sails to play well with Ember
 *
 * @since 0.0.4
 * @class SailsSocketService
 * @extends Ember.Object
 * @constructor
 */
export default Ember.Object.extend(Ember.Evented, {
  /**
   * Holds our sails socket
   * @since 0.0.4
   * @property _socket
   * @type io.Socket
   * @private
   */
  _socket:               null,
  /**
   * Holds the events we are listening on the socket for later re-binding
   * @since 0.0.4
   * @property _listeners
   * @type Object<Object>
   * @private
   */
  _listeners:            null,
  /**
   * Whether the socket core object is initialized or not
   * @since 0.0.4
   * @property isInitialized
   * @type Boolean
   */
  isInitialized:         null,
  /**
   * Whether the socket is connected or not
   * @since 0.0.4
   * @property isConnected
   * @type Boolean
   */
  isConnected:           null,
  /**
   * The number of currently pending operations
   * @since 0.0.4
   * @property pendingOperationCount
   * @type Number
   */
  pendingOperationCount: null,
  /**
   * Whether the service is busy or not
   * @since 0.0.4
   * @property isBusy
   * @type Boolean
   */
  isBusy:                function () {
    return !this.get('isInitialized') || this.get('pendingOperationCount') > 0;
  }.property('pendingOperationCount', 'isInitialized').readOnly(),


  /**
   * @since 0.0.4
   * @method init
   * @inheritDoc
   */
  init: function () {
    this._super();
    this._listeners = {};
    this._socket = io.socket;
    this.setProperties({
      pendingOperationCount: 0,
      isInitialized:         false,
      isConnected:           false
    });
    this._waitJsObject();
  },

  /**
   * @since 0.0.4
   * @method destroy
   * @inheritDoc
   */
  destroy: function () {
    if (this.get('isConnected')) {
      this._socket.disconnect();
    }
    this._super();
  },

  /**
   * Enable/disable listening for a given socket event
   *
   * @since 0.0.4
   * @method listenFor
   * @param {String} event The event to start/stop listening for
   * @param {Boolean} [listen=true] If `true`, it'll listen for these events, else it'll stop listening
   * @return {Boolean} Returns `true` if the some change has been triggered, else `false`
   */
  listenFor: function (event, listen) {
    var cb, sockMethod;
    listen = listen == null ? true : listen;
    if (listen && !this._listeners[event]) {
      cb = this._listeners[event] = Ember.run.bind(this, '_handleSocketMessage', event);
      sockMethod = 'add';
    }
    else if (!listen && (cb = this._listeners[event])) {
      sockMethod = 'remove';
    }
    if (sockMethod) {
      this._connectedSocket(function (error, socket) {
        if (error) {
          Ember.debug('error trying to %@ listener for `%@` on the socket - '.fmt(sockMethod, event) + error);
        }
        else {
          socket[sockMethod + 'Listener'](event, cb);
        }
        if ((listen && error) || (!listen && !error)) {
          delete this._listeners[event];
        }
        if (error) {
          throw error;
        }
      });
    }
    return !!sockMethod;
  },

  /**
   * Call a method on the socket object with the given parameters once the socket is ready and
   * connected. Returns a promise which will resolve to the result of the method call, assuming the
   * method is accepting as last parameter (which would not be given) a function to call once the
   * process is done (as a NodeJS callback).
   *
   * @since 0.0.4
   * @method call
   * @param {String} method The name of the method to call
   * @param {mixed} [arg]* Any argument to give to the method
   * @returns {*}
   */
  call: function (method/*, arg*/) {
    var self = this,
      args = [].slice.call(arguments, 1),
      incPending = this.incrementProperty.bind(this, 'pendingOperationCount');
    incPending(1);
    return new Ember.RSVP.Promise(function (resolve, reject) {
      self._connectedSocket(function (error, socket) {
        if (isAlive(self) && !error) {
          args.push(function (err, data) {
            incPending(-1);
            if (err) {
              reject(err);
            }
            else {
              resolve(data);
            }
          });
          socket[method].apply(socket, args);
        }
        else {
          incPending(-1);
          reject(error ? error : new Ember.Error('Sails socket service destroyed'));
        }
      });
    });
  },

  /**
   * Get the socket ready and connected and then pass it as parameter of the given callback
   *
   * @since 0.0.4
   * @method _connectedSocket
   * @param {Function} callback The method to call with the socket or the error
   * @private
   */
  _connectedSocket: function (callback) {
    if (!isAlive(this)) {
      Ember.run.next(this, callback, new Ember.Error('Sails socket service destroyed'));
    }
    else if (this.get('isConnected')) {
      Ember.run.next(this, callback, null, this._socket);
    }
    else {
      this.one('didConnect', Ember.run.bind(this, callback, null, this._socket));
      if (this.get('isInitialized')) {
        this._reconnect();
      }
    }
  },

  /**
   * Force the reconnection of the socket
   *
   * @since 0.0.4
   * @method _reconnect
   */
  _reconnect: function () {
    if (!this._socket.socket.connected && !this._socket.socket.connecting) {
      this._socket.socket.reconnect();
    }
  },

  /**
   * Re-bind event listeners that have been attached already
   *
   * @since 0.0.4
   * @method _rebindListeners
   * @chainable
   * @private
   */
  _rebindListeners: function () {
    var cb;
    for (var event in this._listeners) {
      if ((cb = this._listeners[event])) {
        this._socket.removeListener(event, cb);
        this._socket.addListener(event, cb);
        Ember.debug('re-attached event `%@` on socket'.fmt(event));
      }
    }
    return this;
  },

  /**
   * Handles a message received by the socket and dispatch our own event
   *
   * @since 0.0.4
   * @method _handleSocketMessage
   * @param {String} event The event name
   * @param {Object} message The message received
   * @private
   */
  _handleSocketMessage: function (event, message) {
    if (!isAlive(this)) {
      return;
    }
    this.trigger(event + '.' + message.verb, message);
  },

  /**
   * Handles the readiness of the socket, initializing listeners etc. once the `io.socket` is ready
   * The way how the `io.socket` is checked for readiness is a hack, since listening to `connect`
   * event was doing a lot of garbage listeners for each subsequent call to `on`. Maybe a bug in
   * `sails` socket code...
   *
   * @since 0.0.4
   * @method _handleSocketReady
   * @private
   */
  _handleSocketReady: function () {
    if (!isAlive(this)) {
      return;
    }
    this.set('isInitialized', true);
    this.trigger('didInitialize');
    this._socket.on('connect', Ember.run.bind(this, '_handleSocketConnect'));
    this._socket.on('disconnect', Ember.run.bind(this, '_handleSocketDisconnect'));
    // after initialization the socket is connected due to the hack we have to do
    Ember.run.next(this, '_handleSocketConnect');
  },

  /**
   * Handles the connected event of the socket
   *
   * @since 0.0.4
   * @method _handleSocketConnect
   * @private
   */
  _handleSocketConnect: function () {
    if (!isAlive(this)) {
      return;
    }
    this._rebindListeners();
    this.set('isConnected', true);
    this.trigger('didConnect');
  },

  /**
   * Handles the disconnected event of the socket
   *
   * @since 0.0.4
   * @method _handleSocketDisconnect
   * @private
   */
  _handleSocketDisconnect: function () {
    if (!isAlive(this)) {
      return;
    }
    this.set('isConnected', false);
    this.trigger('didDisconnect');
  },

  /**
   * Wait until the `io.socket.socket.open` is `true`, which is a hack to be sure the `io.socket`
   * object is ready to be used and ready to attach events on.
   *
   * @since 0.0.4
   * @method _waitJsObject
   * @private
   */
  _waitJsObject: function () {
    if (!isAlive(this)) {
      return;
    }
    if (this._isJsObjectReady()) {
      Ember.run.next(this, '_handleSocketReady');
    }
    else {
      Ember.run.later(this, '_waitJsObject', 10);
    }
  },

  /**
   * Finds whether the `io.socket` object is ready and connected (hack).
   *
   * @since 0.0.4
   * @method _waitJsObject
   * @returns {Boolean}
   * @private
   */
  _isJsObjectReady: function () {
    return this._socket && this._socket.socket && this._socket.socket.open;
  }
});
