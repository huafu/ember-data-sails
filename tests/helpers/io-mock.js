/* global clearTimeout */
import { fmt } from '@ember/string';

import { bind } from '@ember/runloop';

var socket, io;

function requestMethod(method) {
	return function (url, data, callback) {
		io.sails.requestQueue.push({
			cb: callback,
			method: method.toLowerCase(),
			url: url,
			headers: {},
			data: data || {}
		});
		io.mockProcessQueue();
	};
}

socket = {
	requestQueue: [],

	get: requestMethod('get'),
	post: requestMethod('post'),
	put: requestMethod('put'),
	delete: requestMethod('delete'),

	// mocked properties and methods
	_raw: {
		_connectingTimeout: null,
		_disconnectingTimeout: null,
		open: false,
		connected: false,
		connecting: false,
		reconnecting: false,
		disconnecting: false,

		connect: function () {
			this._connect();
		},

		_connect: function (delay, fail, asReconnect) {
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
			this._connectingTimeout = setTimeout(bind(this, function () {
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
			}), delay);
		},

		reconnect: function (delay, fail) {
			this._connect(delay, fail, true);
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
			this._disconnectingTimeout = setTimeout(bind(this, function () {
				this._disconnectingTimeout = null;
				this.disconnecting = false;
				if (!fail) {
					this.connected = this.open = false;
					io.mockTrigger('disconnect');
				}
			}), delay);
		},

		addEventListener: function (eventName, method, thisArg) {
			var listeners = io.mockMeta.events[eventName];
			if (!listeners) {
				listeners = io.mockMeta.events[eventName] = [];
			}
			listeners.push({target: thisArg || null, method: method});
		},

		removeEventListener: function (eventName, method, thisArg) {
			var listeners = io.mockMeta.events[eventName];
			if (!listeners) {
				return;
			}
			io.mockMeta.events[eventName] = listeners.filter(function (listener) {
				return !(listener.target === thisArg && listener.method === method);
			});
		}
	}
};

io = {
	_oldIo: null,

	mockSetup: function (connectDelay, fail) {
		this._oldIo = window.io;
		window.io = io;
		io.mockReset();
		if (connectDelay) {
			this.mockConnect(connectDelay, fail);
		}
	},

	mockConnect: function (delay, fail) {
		socket._raw._connect(delay, fail);
	},

	mockTeardown: function () {
		window.io = this._oldIo;
	},

	mockProcessQueue: function () {
		var item, res;
		if (!socket._raw.open) {
			return;
		}
		if ((item = io.sails.requestQueue.shift())) {
			res = io.mockPopResponse(item.method, item.url);
			if (!res) {
				throw new ReferenceError(fmt('unable to find a mock for %@ %@', item.method, item.url));
			}
			res.onStart(res);
			setTimeout(function () {
				setTimeout(bind(io, 'mockProcessQueue'), 1);
				if (res.error) {
					item.cb(res.response, res.error === true ? {statusCode: 404} : res.error);
				}
				else {
					item.cb(res.response, {statusCode: 200});
				}
			}, res.delay);
		}
	},

	mockMeta: null,

	mockRequest: function (method, url, error, response, delay, onStart) {
		var mkey = method.toLowerCase();
		var mocks = io.mockMeta[mkey] = io.mockMeta[mkey] || [];
		mocks.push({
				url: url,
				error: error,
				response: response,
				delay: delay || 10,
				onStart: onStart || function () {
				}
			}
		);
	},

	mockPopResponse: function (method, url) {
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

	mockReset: function () {
		io.mockMeta = {
			events: {},
			requests: {}
		};
		io.sails.requestQueue = [];
		var s = socket._raw;
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

	mockTrigger: function (event/*, arg*/) {
		var listeners = io.mockMeta.events[event],
			args = [].slice.call(arguments, 1);
		if (!listeners) {
			return;
		}
		listeners.forEach(function (listener) {
			listener.apply(listener.target, args.slice());
		});
	},

	sails: socket
};

io.sails.on = io.sails._raw.addEventListener;


export default io;
