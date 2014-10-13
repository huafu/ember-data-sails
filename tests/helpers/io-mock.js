/* global clearTimeout */

var socket, io;
function requestMethod(method) {
  return function (url, data, callback) {
    io.socket.requestQueue.push({
      cb:      callback,
      method:  method.toLowerCase(),
      url:     url,
      headers: {},
      data:    data || {}
    });
    io.mockProcessQueue();
  };
}
socket = {
  requestQueue: [],

  get:            requestMethod('get'),
  post:           requestMethod('post'),
  put:            requestMethod('put'),
  delete:         requestMethod('delete'),

  // mocked properties and methods
  socket:         {
    _connectingTimeout:    null,
    _disconnectingTimeout: null,
    open:                  false,
    connected:             false,
    connecting:            false,
    reconnecting:          false,
    disconnecting:         false,

    connect:    function (delay, fail, asReconnect) {
      delay = delay || 50;
      if (this.reconnecting || this.connecting) {
        return;
      }
      if (this._disconnectingTimeout) {
        clearTimeout(this._disconnectingTimeout);
        this._disconnectingTimeout = null;
        this.disconnecting = false;
      }
      if (this.connected) {
        return;
      }
      this.disconnecting = false;
      this.connecting = true;
      this.reconnecting = asReconnect ? true : false;
      this._connectingTimeout = setTimeout(function () {
        this._connectingTimeout = null;
        this.reconnecting = false;
        this.connecting = false;
        if (fail) {
          io.mockTrigger('connect_failed');
        }
        else {
          this.connected = this.open = true;
          io.mockProcessQueue();
          io.mockTrigger('connect');
        }
      }.bind(this), delay);
    },
    reconnect:  function (delay, fail) {
      this.connect(delay, fail, true);
    },
    disconnect: function (delay, fail) {
      delay = delay || 50;
      if (this.disconnecting) {
        return;
      }
      if (this._connectingTimeout) {
        clearTimeout(this._connectingTimeout);
        this._connectingTimeout = null;
        this.connecting = false;
        this.reconnecting = false;
      }
      if (!this.connected) {
        return;
      }
      this.disconnecting = true;
      this.reconnecting = false;
      this.connecting = false;
      this._disconnectingTimeout = setTimeout(function () {
        this._disconnectingTimeout = null;
        this.disconnecting = false;
        if (!fail) {
          this.connected = this.open = false;
          io.mockTrigger('disconnect');
        }
      }.bind(this), delay);
    }
  },
  addListener:    function (eventName, method, thisArg) {
    var listeners = io.mockMeta.events[eventName];
    if (!listeners) {
      listeners = io.mockMeta.events[eventName] = [];
    }
    listeners.push({target: thisArg || null, method: method});
  },
  removeListener: function (eventName, method, thisArg) {
    var listeners = io.mockMeta.events[eventName];
    if (!listeners) {
      return;
    }
    io.mockMeta.events[eventName] = listeners.filter(function (listener) {
      return !(listener.target === thisArg && listener.method === method);
    });
  }
};
io = {
  _oldIo:           null,
  mockSetup:        function (connectDelay, fail) {
    this._oldIo = window.io;
    window.io = io;
    io.mockReset();
    if (connectDelay) {
      this.mockConnect(connectDelay, fail);
    }
  },
  mockConnect:      function (delay, fail) {
    socket.socket.connect(delay, fail);
  },
  mockTeardown:     function () {
    window.io = this._oldIo;
  },
  mockProcessQueue: function () {
    var item, res;
    if (!socket.socket.open) {
      return;
    }
    if ((item = io.socket.requestQueue.shift())) {
      res = io.mockPopResponse(item.method, item.url);
      if (!res) {
        throw new ReferenceError('unable to find a mock for %@ %@'.fmt(item.method, item.url));
      }
      res.onStart(res);
      setTimeout(function () {
        setTimeout(io.mockProcessQueue.bind(io), 1);
        if (res.error) {
          item.cb(res.error);
        }
        else {
          item.cb(null, res.response);
        }
      }, res.delay);
    }
  },
  mockMeta:         null,
  mockRequest:      function (method, url, error, response, delay, onStart) {
    var mkey = method.toLowerCase();
    var mocks = io.mockMeta[mkey] = io.mockMeta[mkey] || [];
    mocks.push({
        url:      url,
        error:    error,
        response: response,
        delay:    delay || 10,
        onStart:  onStart || function () {
        }
      }
    );
  },
  mockPopResponse:  function (method, url) {
    var mkey = method.toLowerCase();
    var mock, mocks = io.mockMeta[mkey];
    if (mocks) {
      for (var i = mocks.length - 1; i >= 0; i--) {
        if (mocks[i].url === url) {
          mock = mocks.splice(i, 1).shift();
          break;
        }
      }
    }
    return mock;
  },
  mockReset:        function () {
    io.mockMeta = {
      events:   {},
      requests: {}
    };
    io.socket.requestQueue = [];
    var s = socket.socket;
    s.open = false;
    s.connected = false;
    s.connecting = false;
    s.reconnecting = false;
    s.disconnecting = false;
    if (s._connectingTimeout) {
      clearTimeout(s._connectingTimeout);
      s._connectingTimeout = null;
    }
    if (s._disconnectingTimeout) {
      clearTimeout(s._disconnectingTimeout);
      s._disconnectingTimeout = null;
    }
  },
  mockTrigger:      function (event/*, arg*/) {
    var listeners = io.mockMeta.events[event],
      args = [].slice.call(arguments, 1);
    if (!listeners) {
      return;
    }
    listeners.forEach(function (listener) {
      listener.apply(listener.target, args.slice());
    });
  },
  socket:           socket
}
;
io.socket.on = io.socket.addListener;


export default io;
