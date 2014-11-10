"use strict";

require("6to5/polyfill");
var Promise = require("bluebird");
module.exports = function (R) {
  var url = require("url");
  var _ = require("lodash");
  var assert = require("assert");
  var request;
  if (R.isClient()) {
    request = require("browser-request");
  } else {
    request = require("request");
  }
  var co = require("co");

  var Uplink = function Uplink(httpEndpoint, socketEndpoint, guid, shouldReloadOnServerRestart) {
    this._httpEndpoint = httpEndpoint;
    this._socketEndPoint = socketEndpoint;
    this._guid = guid;
    if (R.isClient()) {
      this._initInClient();
    }
    if (R.isServer()) {
      this._initInServer();
    }
    this._data = {};
    this._hashes = {};
    this._performUpdateIfNecessary = R.scope(this._performUpdateIfNecessary, this);
    this._shouldFetchKey = R.scope(this._shouldFetchKey, this);
    this.fetch = R.scope(this.fetch, this);
    this.subscribeTo = R.scope(this.subscribeTo, this);
    this.unsubscribeFrom = R.scope(this.unsubscribeFrom, this);
    this.listenTo = R.scope(this.listenTo, this);
    this.unlistenFrom = R.scope(this.unlistenFrom, this);
    this.dispatch = R.scope(this.dispatch, this);
    this.shouldReloadOnServerRestart = shouldReloadOnServerRestart;
  };

  _.extend(Uplink.prototype, /** @lends R.Uplink.prototype */{
    _httpEndpoint: null,
    _socketEndPoint: null,
    _subscriptions: null,
    _listeners: null,
    _socket: null,
    _guid: null,
    _pid: null,
    ready: null,
    shouldReloadOnServerRestart: null,
    _acknowledgeHandshake: null,
    _debugLog: function () {
      var args = arguments;
      _.dev(function () {
        console.log.apply(console, args);
      });
    },
    /**
    * <p>Emits a socket signal to the uplink-server</p>
    * @param {string} name The name of the signal
    * @param {object} params The specifics params to send
    * @private
    */
    _emit: function (name, params) {
      var _this = this;

      _.dev(function () {
        return _this._socket.should.be.ok && (null !== _this._socket).should.be.ok;
      });
      this._debugLog(">>> " + name, params);
      this._socket.emit(name, params);
    },

    /**
    * <p> Creating io connection client-side in order to use sockets </p>
    * @method _initInClient
    * @private
    */
    _initInClient: function () {
      var _this2 = this;

      _.dev(function () {
        return R.isClient().should.be.ok;
      });
      if (this._socketEndPoint) {
        var io;
        if (window.io && _.isFunction(window.io)) {
          io = window.io;
        } else {
          io = require("socket.io-client");
        }
        this._subscriptions = {};
        this._listeners = {};
        //Connect to uplink server-side. Trigger the uplink-server on io.on("connection")
        var socket = this._socket = io(this._socketEndPoint);
        //Prepare all event client-side, listening:
        socket.on("update", R.scope(this._handleUpdate, this));
        socket.on("event", R.scope(this._handleEvent, this));
        socket.on("disconnect", R.scope(this._handleDisconnect, this));
        socket.on("connect", R.scope(this._handleConnect, this));
        socket.on("handshake-ack", R.scope(this._handleHandshakeAck, this));
        socket.on("debug", R.scope(this._handleDebug, this));
        socket.on("log", R.scope(this._handleLog, this));
        socket.on("warn", R.scope(this._handleWarn, this));
        socket.on("err", R.scope(this._handleError, this));
        this.ready = new Promise(function (resolve, reject) {
          _this2._acknowledgeHandshake = resolve;
        });
        if (window.onbeforeunload) {
          var prevHandler = window.onbeforeunload;
          window.onbeforeunload = R.scope(this._handleUnload(prevHandler), this);
        } else {
          window.onbeforeunload = R.scope(this._handleUnload(null), this);
        }
      } else {
        this.ready = Promise.cast(true);
      }
    },
    /**
    * <p>Server-side</p>
    * @method _initInServer
    * @private
    */
    _initInServer: function () {
      _.dev(function () {
        return R.isServer().should.be.ok;
      });
      this.ready = Promise.cast(true);
    },
    /**
    * <p>Triggered when a data is updated according to the specific key <br />
    * Call corresponding function key </p>
    * @method _handleUpdate
    * @param {object} params The specific key
    * @private
    */
    _handleUpdate: function (params) {
      var _this3 = this;

      this._debugLog("<<< update", params);
      _.dev(function () {
        return params.should.be.an.object && params.k.should.be.ok && params.k.should.be.a.String && params.v.should.be.ok && params.d.should.be.ok && params.d.should.be.an.Array && params.h.should.be.ok && params.h.should.be.a.String;
      });
      var key = params.k;
      this._performUpdateIfNecessary(key, params)(function (err, val) {
        _.dev(function () {
          if (err) {
            throw R.Debug.extendError(err, "R.Uplink._handleUpdate(...): couldn't _performUpdateIfNecessary.");
          }
        });
        if (err) {
          return;
        }
        _this3._data[key] = val;
        _this3._hashes[key] = R.hash(JSON.stringify(val));
        if (_.has(_this3._subscriptions, key)) {
          Object.keys(_this3._subscriptions[key]).forEach(function (fn) {
            fn(key, val);
          });
        }
      });
    },
    /**
    * @method _shouldFetchKey
    * @param {string} key
    * @param {object} entry
    * @return {Boolean} bool The boolean
    * @private
    */
    _shouldFetchKey: function (key, entry) {
      if (!_.has(this._data, key) || !_.has(this._hashes, key)) {
        return true;
      }
      if (this._hashes[key] !== entry.from) {
        return true;
      }
      return false;
    },

    /**
    * <p>Determines if the the data must be fetched</p>
    * @method _performUpdateIfNecessary
    * @param {string} key
    * @param {object} entry
    * @return {Function} fn The Function to call
    * @private
    */
    _performUpdateIfNecessary: function (key, entry) {
      var _this4 = this;

      return function (fn) {
        co(regeneratorRuntime.mark(function callee$3$0() {
          return regeneratorRuntime.wrap(function callee$3$0$(context$4$0) {
            while (1) switch (context$4$0.prev = context$4$0.next) {case 0:

                if (!this._shouldFetchKey(key, entry)) {
                  context$4$0.next = 6;
                  break;
                }
                context$4$0.next = 3;
                return this.fetch(key);

              case 3: return context$4$0.abrupt("return", context$4$0.sent);
              case 6: return context$4$0.abrupt("return", R.patch(this._data[key], entry.diff));
              case 7:
              case "end": return context$4$0.stop();
            }
          }, callee$3$0, this);
        })).call(_this4, fn);
      };
    },

    /**
    * @method _handleEvent
    * @param {string} params
    * @private
    */
    _handleEvent: function (params) {
      this._debugLog("<<< event", params.eventName);
      var eventName = params.eventName;
      var eventParams = params.params;
      if (_.has(this._listeners, eventName)) {
        Object.keys(this._listeners[eventName], function (fn) {
          fn(eventParams);
        });
      }
    },
    /**
    * @method _handleDisconnect
    * @param {string} params
    * @private
    */
    _handleDisconnect: function (params) {
      var _this5 = this;

      this._debugLog("<<< disconnect", params);
      this.ready = new Promise(function (resolve, reject) {
        _this5._acknowledgeHandshake = resolve;
      });
    },
    /**
    * <p>Occurs after a connection. When a connection is established, the client sends a signal "handshake".</p>
    * @method _handleDisconnect
    * @private
    */
    _handleConnect: function () {
      this._debugLog("<<< connect");
      //notify uplink-server
      this._emit("handshake", { guid: this._guid });
    },

    /**
    * <p> Identifies if the pid of the server has changed (due to a potential reboot server-side) since the last client connection. <br />
    * If this is the case, a page reload is performed<p>
    * @method _handleHandshakeAck
    * @params {object} params
    * @private
    */
    _handleHandshakeAck: function (params) {
      this._debugLog("<<< handshake-ack", params);
      if (this._pid && params.pid !== this._pid && this.shouldReloadOnServerRestart) {
        _.dev(function () {
          console.warn("Server pid has changed, reloading page.");
        });
        setTimeout(function () {
          window.location.reload(true);
        }, _.random(2000, 10000));
      }
      this._pid = params.pid;
      this._acknowledgeHandshake(params);
    },
    /**
    * @method _handleDebug
    * @params {object} params
    * @private
    */
    _handleDebug: function (params) {
      this._debugLog("<<< debug", params);
      _.dev(function () {
        console.warn("R.Uplink.debug(...):", params.debug);
      });
    },
    /**
    * @method _handleLog
    * @params {object} params
    * @private
    */
    _handleLog: function (params) {
      this._debugLog("<<< log", params);
      console.log("R.Uplink.log(...):", params.log);
    },
    /**
    * @method _handleWarn
    * @params {object} params
    * @private
    */
    _handleWarn: function (params) {
      this._debugLog("<<< warn", params);
      console.warn("R.Uplink.warn(...):", params.warn);
    },
    /**
    * @method _handleError
    * @params {object} params
    * @private
    */
    _handleError: function (params) {
      this._debugLog("<<< error", params);
      console.error("R.Uplink.err(...):", params.err);
    },

    /**
    * <p>Occurs when a client unloads the document</p>
    * @method _handleUnload
    * @params {Function} prevHandler The function to execute when the page will be unloaded
    * @return {Function} function
    * @private
    */
    _handleUnload: function (prevHandler) {
      var _this6 = this;

      return function () {
        if (prevHandler) {
          prevHandler();
        }
        _this6._emit("unhandshake");
      };
    },

    /**
    * <p>Simply closes the socket</p>
    * @method _destroyInClient
    * @private
    */
    _destroyInClient: function () {
      if (this._socket) {
        this._socket.close();
      }
    },
    /**
    * <p>Does nothing</p>
    * @method _destroyInClient
    * @return {*} void0
    * @private
    */
    _destroyInServer: function () {
      return void 0;
    },

    /**
    * <p>Notifies the uplink-server that a subscription is required by client</p>
    * @method _subscribeTo
    * @return {string} key The key to subscribe
    * @private
    */
    _subscribeTo: function (key) {
      co(regeneratorRuntime.mark(function callee$2$0() {
        return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
          while (1) switch (context$3$0.prev = context$3$0.next) {case 0:
              context$3$0.next = 2;
              return this.ready;

            case 2: this._emit("subscribeTo", { key: key });
            case 3:
            case "end": return context$3$0.stop();
          }
        }, callee$2$0, this);
      })).call(this, R.Debug.rethrow("R.Uplink._subscribeTo(...): couldn't subscribe (" + key + ")"));
    },

    /**
    * <p>Notifies the uplink-server that a subscription is over</p>
    * @method _subscribeTo
    * @return {string} key The key to unsubscribe
    * @private
    */
    _unsubscribeFrom: function (key) {
      co(regeneratorRuntime.mark(function callee$2$0() {
        return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
          while (1) switch (context$3$0.prev = context$3$0.next) {case 0:
              context$3$0.next = 2;
              return this.ready;

            case 2: this._emit("unsubscribeFrom", { key: key });
            case 3:
            case "end": return context$3$0.stop();
          }
        }, callee$2$0, this);
      })).call(this, R.Debug.rethrow("R.Uplink._subscribeTo(...): couldn't unsubscribe (" + key + ")"));
    },

    /**
    * <p>Etablishes a subscription to a key, and call the specified function when _handleUpdate occurs</p>
    * @method subscribeTo
    * @param {string} key The key to subscribe
    * @param {function} fn The function to execute
    * @return {object} subscription The created subscription
    */
    subscribeTo: function (key, fn) {
      var subscription = new R.Uplink.Subscription(key);
      if (!_.has(this._subscriptions, key)) {
        this._subscribeTo(key);
        this._subscriptions[key] = {};
        this._data[key] = {};
        this._hashes[key] = R.hash(JSON.stringify({}));
      }
      this._subscriptions[key][subscription.uniqueId] = fn;
      return subscription;
    },

    /**
    * <p>Removes a subscription to a key</p>
    * @method subscribeTo
    * @param {string} key The key to subscribe
    * @param {object} subscription
    */
    unsubscribeFrom: function (key, subscription) {
      var _this7 = this;

      _.dev(function () {
        return _this7._subscriptions.should.be.an.Object && _this7._subscriptions[key].should.be.ok && _this7._subscriptions[key].should.be.an.Object && _this7._subscriptions[key][subscription.uniqueId].should.be.ok && _this7._subscriptions[key][subscription.uniqueId].should.be.a.String;
      });
      delete this._subscriptions[key][subscription.uniqueId];
      if (_.size(this._subscriptions[key]) === 0) {
        delete this._subscriptions[key];
        delete this._data[key];
        delete this._hashes[key];
        this._unsubscribeFrom(key);
      }
    },
    /**
    * <p>Sends the listener signal "listenTo"</p>
    * @method _listenTo
    * @param {string} eventName The eventName to listen
    * @private
    */
    _listenTo: function (eventName) {
      co(regeneratorRuntime.mark(function callee$2$0() {
        return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
          while (1) switch (context$3$0.prev = context$3$0.next) {case 0:
              context$3$0.next = 2;
              return this.ready;

            case 2: this._emit("listenTo", { eventName: eventName });
            case 3:
            case "end": return context$3$0.stop();
          }
        }, callee$2$0, this);
      })).call(this, R.Debug.rethrow("R.Uplink._listenTo: couldn't listen (" + eventName + ")"));
    },
    /**
    * <p>Sends the unlistener signal "unlistenFrom"</p>
    * @method _unlistenFrom
    * @param {string} eventName The eventName to listen
    * @private
    */
    _unlistenFrom: function (eventName) {
      co(regeneratorRuntime.mark(function callee$2$0() {
        return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
          while (1) switch (context$3$0.prev = context$3$0.next) {case 0:
              context$3$0.next = 2;
              return this.ready;

            case 2: this._emit("unlistenFrom", { eventName: eventName });
            case 3:
            case "end": return context$3$0.stop();
          }
        }, callee$2$0, this);
      })).call(this, R.Debug.rethrow("R.Uplink._unlistenFrom: couldn't unlisten (" + eventName + ")"));
    },
    /**
    * <p>Create a listener according to a specific name</p>
    * @method listenTo
    * @param {string} eventName The eventName to listen
    * @param {function} fn The function to execute when triggered
    * @return {object} listener The created listener
    */
    listenTo: function (eventName, fn) {
      var listener = R.Uplink.Listener(eventName);
      if (!_.has(this._listeners, eventName)) {
        this._listenTo(eventName);
        this._listeners[eventName] = {};
      }
      this._listeners[eventName][listener.uniqueId] = fn;
      return listener;
    },

    /**
    * <p>Remove a listener </p>
    * @method unlistenFrom
    * @param {string} eventName The eventName to remove
    * @param {object} listener
    */
    unlistenFrom: function (eventName, listener) {
      var _this8 = this;

      _.dev(function () {
        return _this8._listeners.should.be.an.Object && _this8._listeners[eventName].should.be.ok && _this8._listeners[eventName].should.be.an.Object && _this8._listeners[eventName][listener.uniqueId].should.be.ok && _this8._listeners[eventName][listener.uniqueId].should.be.a.String;
      });
      delete this._listeners[eventName];
      if (_.size(this._listeners[eventName]) === 0) {
        delete this._listeners[eventName];
        this._unlistenFrom(eventName);
      }
    },
    /**
    * @method _getFullUrl
    * @param {string} suffix
    * @param {object} listener
    * @private
    */
    _getFullUrl: function (suffix) {
      if (suffix.slice(0, 1) === "/" && this._httpEndpoint.slice(-1) === "/") {
        return this._httpEndpoint.slice(0, -1) + suffix;
      } else {
        return this._httpEndpoint + suffix;
      }
    },
    /**
    * <p>Fetch data by GET request from the uplink-server</p>
    * @method fetch
    * @param {string} key The key to fetch
    * @return {object} object Fetched data according to the key
    */
    fetch: function (key) {
      var _this9 = this;

      return new Promise(function (resolve, reject) {
        _this9._debugLog(">>> fetch", key);
        request({
          url: _this9._getFullUrl(key),
          method: "GET",
          json: true,
          withCredentials: false }, function (err, res, body) {
          if (err) {
            _.dev(function () {
              console.warn("R.Uplink.fetch(...): couldn't fetch '" + key + "':", err.toString());
            });
            return resolve(null);
          } else {
            return resolve(body);
          }
        });
      });
    },

    /**
    * <p>Dispatches an action by POST request from the uplink-server</p>
    * @method dispatch
    * @param {object} action The specific action to dispatch
    * @param {object} params
    * @return {object} object Fetched data according to the specified action
    */
    dispatch: function (action, params) {
      var _this10 = this;

      return new Promise(function (resolve, reject) {
        _this10._debugLog(">>> dispatch", action, params);
        request({
          url: _this10._getFullUrl(action),
          method: "POST",
          body: { guid: _this10._guid, params: params },
          json: true,
          withCredentials: false }, function (err, res, body) {
          if (err) {
            reject(err);
          } else {
            resolve(body);
          }
        });
      });
    },
    /**
    * <p>Destroy socket client-side</p>
    * @method destroy
    */
    destroy: function () {
      if (R.isClient()) {
        this._destroyInClient();
      }
      if (R.isServer()) {
        this._destroyInServer();
      }
    } });

  _.extend(Uplink, {
    Subscription: function (key) {
      this.key = key;
      this.uniqueId = _.uniqueId("R.Uplink.Subscription");
    },
    Listener: function (eventName) {
      this.eventName = eventName;
      this.uniqueId = _.uniqueId("R.Uplink.Listener");
    } });

  return Uplink;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImQ6L3dvcmtzcGFjZV9yZWZhY3Rvci9yZWFjdC1yYWlscy9zcmMvUi5VcGxpbmsuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7QUFDekIsSUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ3BDLE1BQU0sQ0FBQyxPQUFPLEdBQUcsVUFBUyxDQUFDLEVBQUU7QUFDekIsTUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzNCLE1BQU0sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUM1QixNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDakMsTUFBSSxPQUFPLENBQUM7QUFDWixNQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBRTtBQUNiLFdBQU8sR0FBRyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQztHQUN4QyxNQUNJO0FBQ0QsV0FBTyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztHQUNoQztBQUNELE1BQU0sRUFBRSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQzs7TUErQ25CLE1BQU0sR0FDRyxTQURULE1BQU0sQ0FDSSxZQUFZLEVBQUUsY0FBYyxFQUFFLElBQUksRUFBRSwyQkFBMkIsRUFBQztBQUN4RSxRQUFJLENBQUMsYUFBYSxHQUFHLFlBQVksQ0FBQztBQUNsQyxRQUFJLENBQUMsZUFBZSxHQUFHLGNBQWMsQ0FBQztBQUN0QyxRQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQztBQUNsQixRQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBRTtBQUNiLFVBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztLQUN4QjtBQUNELFFBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFFO0FBQ2IsVUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO0tBQ3hCO0FBQ0QsUUFBSSxDQUFDLEtB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QUMsQ0FBQyxRQUFRLEVBQUUsRUFBRTtBQUNiLFlBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO09BQzNCO0FBQ0QsVUFBRyxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUU7QUFDYixZQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztPQUMzQjtLQUNKLEVBQ0osQ0FBQyxDQUFDOztBQUVILEdBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO0FBQ2IsZ0JBQVksRUFBQSxVQUFDLEdBQUcsRUFBRTtBQUNkLFVBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQ2YsVUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLHVCQUF1QixDQUFDLENBQUM7S0FDdkQ7QUFDRCxZQUFRLEVBQUEsVUFBQyxTQUFTLEVBQUU7QUFDaEIsVUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7QUFDM0IsVUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDLENBQUM7S0FDbkQsRUFDSixDQUFDLENBQUM7O0FBRUgsU0FBTyxNQUFNLENBQUM7Q0FDakIsQ0FBQyIsImZpbGUiOiJSLlVwbGluay5qcyIsInNvdXJjZXNDb250ZW50IjpbInJlcXVpcmUoJzZ0bzUvcG9seWZpbGwnKTtcbmNvbnN0IFByb21pc2UgPSByZXF1aXJlKCdibHVlYmlyZCcpO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihSKSB7XHJcbiAgICBjb25zdCB1cmwgPSByZXF1aXJlKFwidXJsXCIpO1xyXG4gICAgY29uc3QgXyA9IHJlcXVpcmUoXCJsb2Rhc2hcIik7XHJcbiAgICBjb25zdCBhc3NlcnQgPSByZXF1aXJlKFwiYXNzZXJ0XCIpO1xyXG4gICAgbGV0IHJlcXVlc3Q7XHJcbiAgICBpZihSLmlzQ2xpZW50KCkpIHtcclxuICAgICAgICByZXF1ZXN0ID0gcmVxdWlyZShcImJyb3dzZXItcmVxdWVzdFwiKTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIHJlcXVlc3QgPSByZXF1aXJlKFwicmVxdWVzdFwiKTtcclxuICAgIH1cclxuICAgIGNvbnN0IGNvID0gcmVxdWlyZShcImNvXCIpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogPHA+VGhlIFVwbGluayBtaWNyby1wcm90b2NvbCBpcyBhIHNpbXBsZSBzZXQgb2YgY29udmVudGlvbnMgdG8gaW1wbGVtZW50IHJlYWwtdGltZSByZWFjdGl2ZSBGbHV4IG92ZXIgdGhlIHdpcmUuIDxiciAvPlxyXG4gICAgICogVGhlIGZyb250ZW5kIGFuZCB0aGUgYmFja2VuZCBzZXJ2ZXIgc2hhcmUgMiBtZWFucyBvZiBjb21tdW5pY2F0aW9ucyA6IDxiciAvPlxyXG4gICAgICogLSBhIFdlYlNvY2tldC1saWtlIChzb2NrZXQuaW8gd3JhcHBlcikgZHVwbGV4IGNvbm5lY3Rpb24gdG8gaGFuZHNoYWtlIGFuZCBzdWJzY3JpYmUgdG8ga2V5cy9saXN0ZW4gdG8gZXZlbnRzIDxiciAvPlxyXG4gICAgICogLSByZWd1bGFycyBIVFRQIHJlcXVlc3RzIChmcm9udCAtPiBiYWNrKSB0byBhY3R1YWxseSBnZXQgZGF0YSBmcm9tIHRoZSBzdG9yZXM8L3A+XHJcbiAgICAgKiA8cD5cclxuICAgICAqIFBST1RPQ09MOiA8YnIgLz5cclxuICAgICAqPGJyIC8+XHJcbiAgICAgKiBDb25uZWN0aW9uL3JlY29ubmVjdGlvbjo8YnIgLz5cclxuICAgICAqPGJyIC8+XHJcbiAgICAgKiBDbGllbnQ6IGJpbmQgc29ja2V0PGJyIC8+XHJcbiAgICAgKiBTZXJ2ZXI6IEFja25vd2xlZGdlIGNvbm5lY3Rpb248YnIgLz5cclxuICAgICAqIENsaWVudDogc2VuZCBcImhhbmRzaGFrZVwiIHsgZ3VpZDogZ3VpZCB9PGJyIC8+XHJcbiAgICAgKiBTZXJ2ZXI6IHNlbmQgXCJoYW5kc2hha2UtYWNrXCIgeyByZWNvdmVyZWQ6IGJvb2wgfSAocmVjb3ZlciBwcmV2aW91cyBzZXNzaW9uIGlmIGV4aXN0aW5nIGJhc2VkIHVwb24gZ3VpZDsgcmVjb3ZlcmVkIGlzIHRydWUgaWZmIHByZXZpb3VzIHNlc3Npb24gZXhpc3RlZCk8YnIgLz48YnIgLz5cclxuICAgICAqPGJyIC8+XHJcbiAgICAgKiBTdG9yZXM6PGJyIC8+XHJcbiAgICAgKiBDbGllbnQ6IHNlbmQgXCJzdWJzY3JpYmVUb1wiIHsga2V5OiBrZXkgfTxiciAvPlxyXG4gICAgICogU2VydmVyOiBzZW5kIFwidXBkYXRlXCIgeyBrZXk6IGtleSB9PGJyIC8+XHJcbiAgICAgKiBDbGllbnQ6IFhIUiBHRVQgL3VwbGluay9rZXk8YnIgLz5cclxuICAgICAqPGJyIC8+XHJcbiAgICAgKiBFdmVudHM6XHJcbiAgICAgKiBDbGllbnQ6IHNlbmQgXCJsaXN0ZW5Ub1wiIHsgZXZlbnROYW1lOiBldmVudE5hbWUgfTxiciAvPlxyXG4gICAgICogU2VydmVyOiBzZW5kIFwiZXZlbnRcIiB7IGV2ZW50TmFtZTogZXZlbnROYW1lLCBwYXJhbXM6IHBhcmFtcyB9PGJyIC8+XHJcbiAgICAgKjxiciAvPlxyXG4gICAgICogQWN0aW9uczo8YnIgLz5cclxuICAgICAqIENsaWVudDogWEhSIFBPU1QgL3VwbGluay9hY3Rpb24geyBwYXJhbXM6IHBhcmFtcyB9PGJyIC8+XHJcbiAgICAgKjxiciAvPlxyXG4gICAgICogT3RoZXIgbm90aWZpY2F0aW9uczo8YnIgLz5cclxuICAgICAqIFNlcnZlcjogc2VuZCBcImRlYnVnXCI6IHsgZGVidWc6IGRlYnVnIH0gRGVidWctbGV2ZWwgbWVzc2FnZTxiciAvPlxyXG4gICAgICogU2VydmVyOiBzZW5kIFwibG9nXCIgeyBsb2c6IGxvZyB9IExvZy1sZXZlbCBtZXNzYWdlPGJyIC8+XHJcbiAgICAgKiBTZXJ2ZXI6IHNlbmQgXCJ3YXJuXCI6IHsgd2Fybjogd2FybiB9IFdhcm4tbGV2ZWwgbWVzc2FnZTxiciAvPlxyXG4gICAgICogU2VydmVyOiBzZW5kIFwiZXJyXCI6IHsgZXJyOiBlcnIgfSBFcnJvci1sZXZlbCBtZXNzYWdlPGJyIC8+XHJcbiAgICAgKiA8L3A+XHJcbiAgICAgKiBAY2xhc3MgUi5VcGxpbmtcclxuICAgICAqL1xyXG5cclxuICAgIC8qKlxyXG4gICAgKiA8cD4gSW5pdGlhbGl6ZXMgdGhlIHVwbGluayBhY2NvcmRpbmcgdG8gdGhlIHNwZWNpZmljYXRpb25zIHByb3ZpZGVkIDwvcD5cclxuICAgICogQG1ldGhvZCBVcGxpbmtcclxuICAgICogQHBhcmFtIHtvYmplY3R9IGh0dHBFbmRwb2ludFxyXG4gICAgKiBAcGFyYW0ge29iamVjdH0gc29ja2V0RW5kcG9pbnRcclxuICAgICogQHBhcmFtIHtvYmplY3R9IGd1aWRcclxuICAgICogQHBhcmFtIHtvYmplY3R9IHNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydFxyXG4gICAgKi9cclxuXHJcbiAgICBjbGFzcyBVcGxpbmsge1xyXG4gICAgICAgIGNvbnN0cnVjdG9yKGh0dHBFbmRwb2ludCwgc29ja2V0RW5kcG9pbnQsIGd1aWQsIHNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydCl7XHJcbiAgICAgICAgICAgIHRoaXMuX2h0dHBFbmRwb2ludCA9IGh0dHBFbmRwb2ludDtcclxuICAgICAgICAgICAgdGhpcy5fc29ja2V0RW5kUG9pbnQgPSBzb2NrZXRFbmRwb2ludDtcclxuICAgICAgICAgICAgdGhpcy5fZ3VpZCA9IGd1aWQ7XHJcbiAgICAgICAgICAgIGlmKFIuaXNDbGllbnQoKSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5faW5pdEluQ2xpZW50KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYoUi5pc1NlcnZlcigpKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9pbml0SW5TZXJ2ZXIoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGlzLl9kYXRhID0ge307XHJcbiAgICAgICAgICAgIHRoaXMuX2hhc2hlcyA9IHt9O1xyXG4gICAgICAgICAgICB0aGlzLl9wZXJmb3JtVXBkYXRlSWZOZWNlc3NhcnkgPSBSLnNjb3BlKHRoaXMuX3BlcmZvcm1VcGRhdGVJZk5lY2Vzc2FyeSwgdGhpcyk7XHJcbiAgICAgICAgICAgIHRoaXMuX3Nob3VsZEZldGNoS2V5ID0gUi5zY29wZSh0aGlzLl9zaG91bGRGZXRjaEtleSwgdGhpcyk7XHJcbiAgICAgICAgICAgIHRoaXMuZmV0Y2ggPSBSLnNjb3BlKHRoaXMuZmV0Y2gsIHRoaXMpO1xyXG4gICAgICAgICAgICB0aGlzLnN1YnNjcmliZVRvID0gUi5zY29wZSh0aGlzLnN1YnNjcmliZVRvLCB0aGlzKTtcclxuICAgICAgICAgICAgdGhpcy51bnN1YnNjcmliZUZyb20gPSBSLnNjb3BlKHRoaXMudW5zdWJzY3JpYmVGcm9tLCB0aGlzKTtcclxuICAgICAgICAgICAgdGhpcy5saXN0ZW5UbyA9IFIuc2NvcGUodGhpcy5saXN0ZW5UbywgdGhpcyk7XHJcbiAgICAgICAgICAgIHRoaXMudW5saXN0ZW5Gcm9tID0gUi5zY29wZSh0aGlzLnVubGlzdGVuRnJvbSwgdGhpcyk7XHJcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2ggPSBSLnNjb3BlKHRoaXMuZGlzcGF0Y2gsIHRoaXMpO1xyXG4gICAgICAgICAgICB0aGlzLnNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydCA9IHNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgXy5leHRlbmQoVXBsaW5rLnByb3RvdHlwZSwgLyoqIEBsZW5kcyBSLlVwbGluay5wcm90b3R5cGUgKi8ge1xyXG4gICAgICAgIF9odHRwRW5kcG9pbnQ6IG51bGwsXHJcbiAgICAgICAgX3NvY2tldEVuZFBvaW50OiBudWxsLFxyXG4gICAgICAgIF9zdWJzY3JpcHRpb25zOiBudWxsLFxyXG4gICAgICAgIF9saXN0ZW5lcnM6IG51bGwsXHJcbiAgICAgICAgX3NvY2tldDogbnVsbCxcclxuICAgICAgICBfZ3VpZDogbnVsbCxcclxuICAgICAgICBfcGlkOiBudWxsLFxyXG4gICAgICAgIHJlYWR5OiBudWxsLFxyXG4gICAgICAgIHNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydDogbnVsbCxcclxuICAgICAgICBfYWNrbm93bGVkZ2VIYW5kc2hha2U6IG51bGwsXHJcbiAgICAgICAgX2RlYnVnTG9nKCkge1xyXG4gICAgICAgICAgICBsZXQgYXJncyA9IGFyZ3VtZW50cztcclxuICAgICAgICAgICAgXy5kZXYoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2cuYXBwbHkoY29uc29sZSwgYXJncyk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiA8cD5FbWl0cyBhIHNvY2tldCBzaWduYWwgdG8gdGhlIHVwbGluay1zZXJ2ZXI8L3A+XHJcbiAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgc2lnbmFsXHJcbiAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gcGFyYW1zIFRoZSBzcGVjaWZpY3MgcGFyYW1zIHRvIHNlbmRcclxuICAgICAgICAqIEBwcml2YXRlXHJcbiAgICAgICAgKi9cclxuICAgICAgICBfZW1pdChuYW1lLCBwYXJhbXMpIHtcclxuICAgICAgICAgICAgXy5kZXYoKCkgPT4gdGhpcy5fc29ja2V0LnNob3VsZC5iZS5vayAmJiAobnVsbCAhPT0gdGhpcy5fc29ja2V0KS5zaG91bGQuYmUub2spO1xyXG4gICAgICAgICAgICB0aGlzLl9kZWJ1Z0xvZyhcIj4+PiBcIiArIG5hbWUsIHBhcmFtcyk7XHJcbiAgICAgICAgICAgIHRoaXMuX3NvY2tldC5lbWl0KG5hbWUsIHBhcmFtcyk7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiA8cD4gQ3JlYXRpbmcgaW8gY29ubmVjdGlvbiBjbGllbnQtc2lkZSBpbiBvcmRlciB0byB1c2Ugc29ja2V0cyA8L3A+XHJcbiAgICAgICAgKiBAbWV0aG9kIF9pbml0SW5DbGllbnRcclxuICAgICAgICAqIEBwcml2YXRlXHJcbiAgICAgICAgKi9cclxuICAgICAgICBfaW5pdEluQ2xpZW50KCkge1xyXG4gICAgICAgICAgICBfLmRldigoKSA9PiBSLmlzQ2xpZW50KCkuc2hvdWxkLmJlLm9rKTtcclxuICAgICAgICAgICAgaWYodGhpcy5fc29ja2V0RW5kUG9pbnQpIHtcclxuICAgICAgICAgICAgICAgIGxldCBpbztcclxuICAgICAgICAgICAgICAgIGlmKHdpbmRvdy5pbyAmJiBfLmlzRnVuY3Rpb24od2luZG93LmlvKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlvID0gd2luZG93LmlvO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaW8gPSByZXF1aXJlKFwic29ja2V0LmlvLWNsaWVudFwiKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRoaXMuX3N1YnNjcmlwdGlvbnMgPSB7fTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2xpc3RlbmVycyA9IHt9O1xyXG4gICAgICAgICAgICAgICAgLy9Db25uZWN0IHRvIHVwbGluayBzZXJ2ZXItc2lkZS4gVHJpZ2dlciB0aGUgdXBsaW5rLXNlcnZlciBvbiBpby5vbihcImNvbm5lY3Rpb25cIilcclxuICAgICAgICAgICAgICAgIGxldCBzb2NrZXQgPSB0aGlzLl9zb2NrZXQgPSBpbyh0aGlzLl9zb2NrZXRFbmRQb2ludCk7XHJcbiAgICAgICAgICAgICAgICAvL1ByZXBhcmUgYWxsIGV2ZW50IGNsaWVudC1zaWRlLCBsaXN0ZW5pbmc6XHJcbiAgICAgICAgICAgICAgICBzb2NrZXQub24oXCJ1cGRhdGVcIiwgUi5zY29wZSh0aGlzLl9oYW5kbGVVcGRhdGUsIHRoaXMpKTtcclxuICAgICAgICAgICAgICAgIHNvY2tldC5vbihcImV2ZW50XCIsIFIuc2NvcGUodGhpcy5faGFuZGxlRXZlbnQsIHRoaXMpKTtcclxuICAgICAgICAgICAgICAgIHNvY2tldC5vbihcImRpc2Nvbm5lY3RcIiwgUi5zY29wZSh0aGlzLl9oYW5kbGVEaXNjb25uZWN0LCB0aGlzKSk7XHJcbiAgICAgICAgICAgICAgICBzb2NrZXQub24oXCJjb25uZWN0XCIsIFIuc2NvcGUodGhpcy5faGFuZGxlQ29ubmVjdCwgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgc29ja2V0Lm9uKFwiaGFuZHNoYWtlLWFja1wiLCBSLnNjb3BlKHRoaXMuX2hhbmRsZUhhbmRzaGFrZUFjaywgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgc29ja2V0Lm9uKFwiZGVidWdcIiwgUi5zY29wZSh0aGlzLl9oYW5kbGVEZWJ1ZywgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgc29ja2V0Lm9uKFwibG9nXCIsIFIuc2NvcGUodGhpcy5faGFuZGxlTG9nLCB0aGlzKSk7XHJcbiAgICAgICAgICAgICAgICBzb2NrZXQub24oXCJ3YXJuXCIsIFIuc2NvcGUodGhpcy5faGFuZGxlV2FybiwgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgc29ja2V0Lm9uKFwiZXJyXCIsIFIuc2NvcGUodGhpcy5faGFuZGxlRXJyb3IsIHRoaXMpKTtcclxuICAgICAgICAgICAgICAgIHRoaXMucmVhZHkgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYWNrbm93bGVkZ2VIYW5kc2hha2UgPSByZXNvbHZlO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBpZih3aW5kb3cub25iZWZvcmV1bmxvYWQpIHtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgcHJldkhhbmRsZXIgPSB3aW5kb3cub25iZWZvcmV1bmxvYWQ7XHJcbiAgICAgICAgICAgICAgICAgICAgd2luZG93Lm9uYmVmb3JldW5sb2FkID0gUi5zY29wZSh0aGlzLl9oYW5kbGVVbmxvYWQocHJldkhhbmRsZXIpLCB0aGlzKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHdpbmRvdy5vbmJlZm9yZXVubG9hZCA9IFIuc2NvcGUodGhpcy5faGFuZGxlVW5sb2FkKG51bGwpLCB0aGlzKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMucmVhZHkgPSBQcm9taXNlLmNhc3QodHJ1ZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICogPHA+U2VydmVyLXNpZGU8L3A+XHJcbiAgICAgICAgKiBAbWV0aG9kIF9pbml0SW5TZXJ2ZXJcclxuICAgICAgICAqIEBwcml2YXRlXHJcbiAgICAgICAgKi9cclxuICAgICAgICBfaW5pdEluU2VydmVyKCkge1xyXG4gICAgICAgICAgICBfLmRldigoKSA9PiBSLmlzU2VydmVyKCkuc2hvdWxkLmJlLm9rKTtcclxuICAgICAgICAgICAgdGhpcy5yZWFkeSA9IFByb21pc2UuY2FzdCh0cnVlKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICogPHA+VHJpZ2dlcmVkIHdoZW4gYSBkYXRhIGlzIHVwZGF0ZWQgYWNjb3JkaW5nIHRvIHRoZSBzcGVjaWZpYyBrZXkgPGJyIC8+XHJcbiAgICAgICAgKiBDYWxsIGNvcnJlc3BvbmRpbmcgZnVuY3Rpb24ga2V5IDwvcD5cclxuICAgICAgICAqIEBtZXRob2QgX2hhbmRsZVVwZGF0ZVxyXG4gICAgICAgICogQHBhcmFtIHtvYmplY3R9IHBhcmFtcyBUaGUgc3BlY2lmaWMga2V5XHJcbiAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICovXHJcbiAgICAgICAgX2hhbmRsZVVwZGF0ZShwYXJhbXMpIHtcclxuICAgICAgICAgICAgdGhpcy5fZGVidWdMb2coXCI8PDwgdXBkYXRlXCIsIHBhcmFtcyk7XHJcbiAgICAgICAgICAgIF8uZGV2KCgpID0+IFxyXG4gICAgICAgICAgICAgICAgcGFyYW1zLnNob3VsZC5iZS5hbi5vYmplY3QgJiZcclxuICAgICAgICAgICAgICAgIHBhcmFtcy5rLnNob3VsZC5iZS5vayAmJlxyXG4gICAgICAgICAgICAgICAgcGFyYW1zLmsuc2hvdWxkLmJlLmEuU3RyaW5nICYmXHJcbiAgICAgICAgICAgICAgICBwYXJhbXMudi5zaG91bGQuYmUub2sgJiZcclxuICAgICAgICAgICAgICAgIHBhcmFtcy5kLnNob3VsZC5iZS5vayAmJlxyXG4gICAgICAgICAgICAgICAgcGFyYW1zLmQuc2hvdWxkLmJlLmFuLkFycmF5ICYmXHJcbiAgICAgICAgICAgICAgICBwYXJhbXMuaC5zaG91bGQuYmUub2sgJiZcclxuICAgICAgICAgICAgICAgIHBhcmFtcy5oLnNob3VsZC5iZS5hLlN0cmluZ1xyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgICAgICBsZXQga2V5ID0gcGFyYW1zLms7XHJcbiAgICAgICAgICAgIHRoaXMuX3BlcmZvcm1VcGRhdGVJZk5lY2Vzc2FyeShrZXksIHBhcmFtcykoKGVyciwgdmFsKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgXy5kZXYoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBSLkRlYnVnLmV4dGVuZEVycm9yKGVyciwgXCJSLlVwbGluay5faGFuZGxlVXBkYXRlKC4uLik6IGNvdWxkbid0IF9wZXJmb3JtVXBkYXRlSWZOZWNlc3NhcnkuXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIGlmKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRoaXMuX2RhdGFba2V5XSA9IHZhbDtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2hhc2hlc1trZXldID0gUi5oYXNoKEpTT04uc3RyaW5naWZ5KHZhbCkpO1xyXG4gICAgICAgICAgICAgICAgaWYoXy5oYXModGhpcy5fc3Vic2NyaXB0aW9ucywga2V5KSkge1xyXG4gICAgICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKHRoaXMuX3N1YnNjcmlwdGlvbnNba2V5XSkuZm9yRWFjaCgoZm4pID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm4oa2V5LCB2YWwpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICogQG1ldGhvZCBfc2hvdWxkRmV0Y2hLZXlcclxuICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXlcclxuICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBlbnRyeVxyXG4gICAgICAgICogQHJldHVybiB7Qm9vbGVhbn0gYm9vbCBUaGUgYm9vbGVhblxyXG4gICAgICAgICogQHByaXZhdGVcclxuICAgICAgICAqL1xyXG4gICAgICAgIF9zaG91bGRGZXRjaEtleShrZXksIGVudHJ5KSB7XHJcbiAgICAgICAgICAgIGlmKCFfLmhhcyh0aGlzLl9kYXRhLCBrZXkpIHx8ICFfLmhhcyh0aGlzLl9oYXNoZXMsIGtleSkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmKHRoaXMuX2hhc2hlc1trZXldICE9PSBlbnRyeS5mcm9tKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiA8cD5EZXRlcm1pbmVzIGlmIHRoZSB0aGUgZGF0YSBtdXN0IGJlIGZldGNoZWQ8L3A+XHJcbiAgICAgICAgKiBAbWV0aG9kIF9wZXJmb3JtVXBkYXRlSWZOZWNlc3NhcnlcclxuICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXlcclxuICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBlbnRyeVxyXG4gICAgICAgICogQHJldHVybiB7RnVuY3Rpb259IGZuIFRoZSBGdW5jdGlvbiB0byBjYWxsXHJcbiAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICovXHJcbiAgICAgICAgX3BlcmZvcm1VcGRhdGVJZk5lY2Vzc2FyeShrZXksIGVudHJ5KSB7XHJcbiAgICAgICAgICAgIHJldHVybiAoZm4pID0+IHtcclxuICAgICAgICAgICAgICAgIGNvKGZ1bmN0aW9uKigpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZih0aGlzLl9zaG91bGRGZXRjaEtleShrZXksIGVudHJ5KSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4geWllbGQgdGhpcy5mZXRjaChrZXkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFIucGF0Y2godGhpcy5fZGF0YVtrZXldLCBlbnRyeS5kaWZmKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KS5jYWxsKHRoaXMsIGZuKTtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAqIEBtZXRob2QgX2hhbmRsZUV2ZW50XHJcbiAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gcGFyYW1zXHJcbiAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICovXHJcbiAgICAgICAgX2hhbmRsZUV2ZW50KHBhcmFtcykge1xyXG4gICAgICAgICAgICB0aGlzLl9kZWJ1Z0xvZyhcIjw8PCBldmVudFwiLCBwYXJhbXMuZXZlbnROYW1lKTtcclxuICAgICAgICAgICAgbGV0IGV2ZW50TmFtZSA9IHBhcmFtcy5ldmVudE5hbWU7XHJcbiAgICAgICAgICAgIGxldCBldmVudFBhcmFtcyA9IHBhcmFtcy5wYXJhbXM7XHJcbiAgICAgICAgICAgIGlmKF8uaGFzKHRoaXMuX2xpc3RlbmVycywgZXZlbnROYW1lKSkge1xyXG4gICAgICAgICAgICAgICAgT2JqZWN0LmtleXModGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0sIChmbikgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGZuKGV2ZW50UGFyYW1zKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAqIEBtZXRob2QgX2hhbmRsZURpc2Nvbm5lY3RcclxuICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBwYXJhbXNcclxuICAgICAgICAqIEBwcml2YXRlXHJcbiAgICAgICAgKi9cclxuICAgICAgICBfaGFuZGxlRGlzY29ubmVjdChwYXJhbXMpIHtcclxuICAgICAgICAgICAgdGhpcy5fZGVidWdMb2coXCI8PDwgZGlzY29ubmVjdFwiLCBwYXJhbXMpO1xyXG4gICAgICAgICAgICB0aGlzLnJlYWR5ID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fYWNrbm93bGVkZ2VIYW5kc2hha2UgPSByZXNvbHZlO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICogPHA+T2NjdXJzIGFmdGVyIGEgY29ubmVjdGlvbi4gV2hlbiBhIGNvbm5lY3Rpb24gaXMgZXN0YWJsaXNoZWQsIHRoZSBjbGllbnQgc2VuZHMgYSBzaWduYWwgXCJoYW5kc2hha2VcIi48L3A+XHJcbiAgICAgICAgKiBAbWV0aG9kIF9oYW5kbGVEaXNjb25uZWN0XHJcbiAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICovXHJcbiAgICAgICAgX2hhbmRsZUNvbm5lY3QoKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2RlYnVnTG9nKFwiPDw8IGNvbm5lY3RcIik7XHJcbiAgICAgICAgICAgIC8vbm90aWZ5IHVwbGluay1zZXJ2ZXJcclxuICAgICAgICAgICAgdGhpcy5fZW1pdChcImhhbmRzaGFrZVwiLCB7IGd1aWQ6IHRoaXMuX2d1aWQgfSk7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiA8cD4gSWRlbnRpZmllcyBpZiB0aGUgcGlkIG9mIHRoZSBzZXJ2ZXIgaGFzIGNoYW5nZWQgKGR1ZSB0byBhIHBvdGVudGlhbCByZWJvb3Qgc2VydmVyLXNpZGUpIHNpbmNlIHRoZSBsYXN0IGNsaWVudCBjb25uZWN0aW9uLiA8YnIgLz5cclxuICAgICAgICAqIElmIHRoaXMgaXMgdGhlIGNhc2UsIGEgcGFnZSByZWxvYWQgaXMgcGVyZm9ybWVkPHA+XHJcbiAgICAgICAgKiBAbWV0aG9kIF9oYW5kbGVIYW5kc2hha2VBY2tcclxuICAgICAgICAqIEBwYXJhbXMge29iamVjdH0gcGFyYW1zXHJcbiAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICovXHJcbiAgICAgICAgX2hhbmRsZUhhbmRzaGFrZUFjayhwYXJhbXMpIHtcclxuICAgICAgICAgICAgdGhpcy5fZGVidWdMb2coXCI8PDwgaGFuZHNoYWtlLWFja1wiLCBwYXJhbXMpO1xyXG4gICAgICAgICAgICBpZih0aGlzLl9waWQgJiYgcGFyYW1zLnBpZCAhPT0gdGhpcy5fcGlkICYmIHRoaXMuc2hvdWxkUmVsb2FkT25TZXJ2ZXJSZXN0YXJ0KSB7XHJcbiAgICAgICAgICAgICAgICBfLmRldigoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiU2VydmVyIHBpZCBoYXMgY2hhbmdlZCwgcmVsb2FkaW5nIHBhZ2UuXCIpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB3aW5kb3cubG9jYXRpb24ucmVsb2FkKHRydWUpO1xyXG4gICAgICAgICAgICAgICAgfSwgXy5yYW5kb20oMjAwMCwgMTAwMDApKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGlzLl9waWQgPSBwYXJhbXMucGlkO1xyXG4gICAgICAgICAgICB0aGlzLl9hY2tub3dsZWRnZUhhbmRzaGFrZShwYXJhbXMpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiBAbWV0aG9kIF9oYW5kbGVEZWJ1Z1xyXG4gICAgICAgICogQHBhcmFtcyB7b2JqZWN0fSBwYXJhbXNcclxuICAgICAgICAqIEBwcml2YXRlXHJcbiAgICAgICAgKi9cclxuICAgICAgICBfaGFuZGxlRGVidWcocGFyYW1zKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2RlYnVnTG9nKFwiPDw8IGRlYnVnXCIsIHBhcmFtcyk7XHJcbiAgICAgICAgICAgIF8uZGV2KCgpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIlIuVXBsaW5rLmRlYnVnKC4uLik6XCIsIHBhcmFtcy5kZWJ1Zyk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiBAbWV0aG9kIF9oYW5kbGVMb2dcclxuICAgICAgICAqIEBwYXJhbXMge29iamVjdH0gcGFyYW1zXHJcbiAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICovXHJcbiAgICAgICAgX2hhbmRsZUxvZyhwYXJhbXMpIHtcclxuICAgICAgICAgICAgdGhpcy5fZGVidWdMb2coXCI8PDwgbG9nXCIsIHBhcmFtcyk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiUi5VcGxpbmsubG9nKC4uLik6XCIsIHBhcmFtcy5sb2cpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiBAbWV0aG9kIF9oYW5kbGVXYXJuXHJcbiAgICAgICAgKiBAcGFyYW1zIHtvYmplY3R9IHBhcmFtc1xyXG4gICAgICAgICogQHByaXZhdGVcclxuICAgICAgICAqL1xyXG4gICAgICAgIF9oYW5kbGVXYXJuKHBhcmFtcykge1xyXG4gICAgICAgICAgICB0aGlzLl9kZWJ1Z0xvZyhcIjw8PCB3YXJuXCIsIHBhcmFtcyk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihcIlIuVXBsaW5rLndhcm4oLi4uKTpcIiwgcGFyYW1zLndhcm4pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiBAbWV0aG9kIF9oYW5kbGVFcnJvclxyXG4gICAgICAgICogQHBhcmFtcyB7b2JqZWN0fSBwYXJhbXNcclxuICAgICAgICAqIEBwcml2YXRlXHJcbiAgICAgICAgKi9cclxuICAgICAgICBfaGFuZGxlRXJyb3IocGFyYW1zKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2RlYnVnTG9nKFwiPDw8IGVycm9yXCIsIHBhcmFtcyk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJSLlVwbGluay5lcnIoLi4uKTpcIiwgcGFyYW1zLmVycik7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiA8cD5PY2N1cnMgd2hlbiBhIGNsaWVudCB1bmxvYWRzIHRoZSBkb2N1bWVudDwvcD5cclxuICAgICAgICAqIEBtZXRob2QgX2hhbmRsZVVubG9hZFxyXG4gICAgICAgICogQHBhcmFtcyB7RnVuY3Rpb259IHByZXZIYW5kbGVyIFRoZSBmdW5jdGlvbiB0byBleGVjdXRlIHdoZW4gdGhlIHBhZ2Ugd2lsbCBiZSB1bmxvYWRlZFxyXG4gICAgICAgICogQHJldHVybiB7RnVuY3Rpb259IGZ1bmN0aW9uXHJcbiAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICovXHJcbiAgICAgICAgX2hhbmRsZVVubG9hZChwcmV2SGFuZGxlcikge1xyXG4gICAgICAgICAgICByZXR1cm4gKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYocHJldkhhbmRsZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICBwcmV2SGFuZGxlcigpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdGhpcy5fZW1pdChcInVuaGFuZHNoYWtlXCIpO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICogPHA+U2ltcGx5IGNsb3NlcyB0aGUgc29ja2V0PC9wPlxyXG4gICAgICAgICogQG1ldGhvZCBfZGVzdHJveUluQ2xpZW50XHJcbiAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICovXHJcbiAgICAgICAgX2Rlc3Ryb3lJbkNsaWVudCgpIHtcclxuICAgICAgICAgICAgaWYodGhpcy5fc29ja2V0KSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9zb2NrZXQuY2xvc2UoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiA8cD5Eb2VzIG5vdGhpbmc8L3A+XHJcbiAgICAgICAgKiBAbWV0aG9kIF9kZXN0cm95SW5DbGllbnRcclxuICAgICAgICAqIEByZXR1cm4geyp9IHZvaWQwXHJcbiAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICovXHJcbiAgICAgICAgX2Rlc3Ryb3lJblNlcnZlcigpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHZvaWQgMDtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAqIDxwPk5vdGlmaWVzIHRoZSB1cGxpbmstc2VydmVyIHRoYXQgYSBzdWJzY3JpcHRpb24gaXMgcmVxdWlyZWQgYnkgY2xpZW50PC9wPlxyXG4gICAgICAgICogQG1ldGhvZCBfc3Vic2NyaWJlVG9cclxuICAgICAgICAqIEByZXR1cm4ge3N0cmluZ30ga2V5IFRoZSBrZXkgdG8gc3Vic2NyaWJlXHJcbiAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICovXHJcbiAgICAgICAgX3N1YnNjcmliZVRvKGtleSkge1xyXG4gICAgICAgICAgICBjbyhmdW5jdGlvbiooKSB7XHJcbiAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLnJlYWR5O1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZW1pdChcInN1YnNjcmliZVRvXCIsIHsga2V5OiBrZXkgfSk7XHJcbiAgICAgICAgICAgIH0pLmNhbGwodGhpcywgUi5EZWJ1Zy5yZXRocm93KFwiUi5VcGxpbmsuX3N1YnNjcmliZVRvKC4uLik6IGNvdWxkbid0IHN1YnNjcmliZSAoXCIgKyBrZXkgKyBcIilcIikpO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICogPHA+Tm90aWZpZXMgdGhlIHVwbGluay1zZXJ2ZXIgdGhhdCBhIHN1YnNjcmlwdGlvbiBpcyBvdmVyPC9wPlxyXG4gICAgICAgICogQG1ldGhvZCBfc3Vic2NyaWJlVG9cclxuICAgICAgICAqIEByZXR1cm4ge3N0cmluZ30ga2V5IFRoZSBrZXkgdG8gdW5zdWJzY3JpYmVcclxuICAgICAgICAqIEBwcml2YXRlXHJcbiAgICAgICAgKi9cclxuICAgICAgICBfdW5zdWJzY3JpYmVGcm9tKGtleSkge1xyXG4gICAgICAgICAgICBjbyhmdW5jdGlvbiooKSB7XHJcbiAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLnJlYWR5O1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZW1pdChcInVuc3Vic2NyaWJlRnJvbVwiLCB7IGtleToga2V5IH0pO1xyXG4gICAgICAgICAgICB9KS5jYWxsKHRoaXMsIFIuRGVidWcucmV0aHJvdyhcIlIuVXBsaW5rLl9zdWJzY3JpYmVUbyguLi4pOiBjb3VsZG4ndCB1bnN1YnNjcmliZSAoXCIgKyBrZXkgKyBcIilcIikpO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICogPHA+RXRhYmxpc2hlcyBhIHN1YnNjcmlwdGlvbiB0byBhIGtleSwgYW5kIGNhbGwgdGhlIHNwZWNpZmllZCBmdW5jdGlvbiB3aGVuIF9oYW5kbGVVcGRhdGUgb2NjdXJzPC9wPlxyXG4gICAgICAgICogQG1ldGhvZCBzdWJzY3JpYmVUb1xyXG4gICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IHRvIHN1YnNjcmliZVxyXG4gICAgICAgICogQHBhcmFtIHtmdW5jdGlvbn0gZm4gVGhlIGZ1bmN0aW9uIHRvIGV4ZWN1dGVcclxuICAgICAgICAqIEByZXR1cm4ge29iamVjdH0gc3Vic2NyaXB0aW9uIFRoZSBjcmVhdGVkIHN1YnNjcmlwdGlvblxyXG4gICAgICAgICovXHJcbiAgICAgICAgc3Vic2NyaWJlVG8oa2V5LCBmbikge1xyXG4gICAgICAgICAgICBsZXQgc3Vic2NyaXB0aW9uID0gbmV3IFIuVXBsaW5rLlN1YnNjcmlwdGlvbihrZXkpO1xyXG4gICAgICAgICAgICBpZighXy5oYXModGhpcy5fc3Vic2NyaXB0aW9ucywga2V5KSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fc3Vic2NyaWJlVG8oa2V5KTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3N1YnNjcmlwdGlvbnNba2V5XSA9IHt9O1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZGF0YVtrZXldID0ge307XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9oYXNoZXNba2V5XSA9IFIuaGFzaChKU09OLnN0cmluZ2lmeSh7fSkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuX3N1YnNjcmlwdGlvbnNba2V5XVtzdWJzY3JpcHRpb24udW5pcXVlSWRdID0gZm47XHJcbiAgICAgICAgICAgIHJldHVybiBzdWJzY3JpcHRpb247XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiA8cD5SZW1vdmVzIGEgc3Vic2NyaXB0aW9uIHRvIGEga2V5PC9wPlxyXG4gICAgICAgICogQG1ldGhvZCBzdWJzY3JpYmVUb1xyXG4gICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IHRvIHN1YnNjcmliZVxyXG4gICAgICAgICogQHBhcmFtIHtvYmplY3R9IHN1YnNjcmlwdGlvblxyXG4gICAgICAgICovXHJcbiAgICAgICAgdW5zdWJzY3JpYmVGcm9tKGtleSwgc3Vic2NyaXB0aW9uKSB7XHJcbiAgICAgICAgICAgIF8uZGV2KCgpID0+IFxyXG4gICAgICAgICAgICAgICAgdGhpcy5fc3Vic2NyaXB0aW9ucy5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXHJcbiAgICAgICAgICAgICAgICB0aGlzLl9zdWJzY3JpcHRpb25zW2tleV0uc2hvdWxkLmJlLm9rICYmXHJcbiAgICAgICAgICAgICAgICB0aGlzLl9zdWJzY3JpcHRpb25zW2tleV0uc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxyXG4gICAgICAgICAgICAgICAgdGhpcy5fc3Vic2NyaXB0aW9uc1trZXldW3N1YnNjcmlwdGlvbi51bmlxdWVJZF0uc2hvdWxkLmJlLm9rICYmXHJcbiAgICAgICAgICAgICAgICB0aGlzLl9zdWJzY3JpcHRpb25zW2tleV1bc3Vic2NyaXB0aW9uLnVuaXF1ZUlkXS5zaG91bGQuYmUuYS5TdHJpbmdcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3N1YnNjcmlwdGlvbnNba2V5XVtzdWJzY3JpcHRpb24udW5pcXVlSWRdO1xyXG4gICAgICAgICAgICBpZihfLnNpemUodGhpcy5fc3Vic2NyaXB0aW9uc1trZXldKSA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3N1YnNjcmlwdGlvbnNba2V5XTtcclxuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9kYXRhW2tleV07XHJcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5faGFzaGVzW2tleV07XHJcbiAgICAgICAgICAgICAgICB0aGlzLl91bnN1YnNjcmliZUZyb20oa2V5KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiA8cD5TZW5kcyB0aGUgbGlzdGVuZXIgc2lnbmFsIFwibGlzdGVuVG9cIjwvcD5cclxuICAgICAgICAqIEBtZXRob2QgX2xpc3RlblRvXHJcbiAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lIFRoZSBldmVudE5hbWUgdG8gbGlzdGVuXHJcbiAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICovXHJcbiAgICAgICAgX2xpc3RlblRvKGV2ZW50TmFtZSkge1xyXG4gICAgICAgICAgICBjbyhmdW5jdGlvbiooKSB7XHJcbiAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLnJlYWR5O1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZW1pdChcImxpc3RlblRvXCIsIHsgZXZlbnROYW1lOiBldmVudE5hbWUgfSk7XHJcbiAgICAgICAgICAgIH0pLmNhbGwodGhpcywgUi5EZWJ1Zy5yZXRocm93KFwiUi5VcGxpbmsuX2xpc3RlblRvOiBjb3VsZG4ndCBsaXN0ZW4gKFwiICsgZXZlbnROYW1lICsgXCIpXCIpKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgICAvKipcclxuICAgICAgICAqIDxwPlNlbmRzIHRoZSB1bmxpc3RlbmVyIHNpZ25hbCBcInVubGlzdGVuRnJvbVwiPC9wPlxyXG4gICAgICAgICogQG1ldGhvZCBfdW5saXN0ZW5Gcm9tXHJcbiAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lIFRoZSBldmVudE5hbWUgdG8gbGlzdGVuXHJcbiAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICovXHJcbiAgICAgICAgX3VubGlzdGVuRnJvbShldmVudE5hbWUpIHtcclxuICAgICAgICAgICAgY28oZnVuY3Rpb24qKCkge1xyXG4gICAgICAgICAgICAgICAgeWllbGQgdGhpcy5yZWFkeTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoXCJ1bmxpc3RlbkZyb21cIiwgeyBldmVudE5hbWU6IGV2ZW50TmFtZSB9KTtcclxuICAgICAgICAgICAgfSkuY2FsbCh0aGlzLCBSLkRlYnVnLnJldGhyb3coXCJSLlVwbGluay5fdW5saXN0ZW5Gcm9tOiBjb3VsZG4ndCB1bmxpc3RlbiAoXCIgKyBldmVudE5hbWUgKyBcIilcIikpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiA8cD5DcmVhdGUgYSBsaXN0ZW5lciBhY2NvcmRpbmcgdG8gYSBzcGVjaWZpYyBuYW1lPC9wPlxyXG4gICAgICAgICogQG1ldGhvZCBsaXN0ZW5Ub1xyXG4gICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50TmFtZSBUaGUgZXZlbnROYW1lIHRvIGxpc3RlblxyXG4gICAgICAgICogQHBhcmFtIHtmdW5jdGlvbn0gZm4gVGhlIGZ1bmN0aW9uIHRvIGV4ZWN1dGUgd2hlbiB0cmlnZ2VyZWRcclxuICAgICAgICAqIEByZXR1cm4ge29iamVjdH0gbGlzdGVuZXIgVGhlIGNyZWF0ZWQgbGlzdGVuZXJcclxuICAgICAgICAqL1xyXG4gICAgICAgIGxpc3RlblRvKGV2ZW50TmFtZSwgZm4pIHtcclxuICAgICAgICAgICAgdmFyIGxpc3RlbmVyID0gUi5VcGxpbmsuTGlzdGVuZXIoZXZlbnROYW1lKTtcclxuICAgICAgICAgICAgaWYoIV8uaGFzKHRoaXMuX2xpc3RlbmVycywgZXZlbnROYW1lKSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fbGlzdGVuVG8oZXZlbnROYW1lKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdID0ge307XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV1bbGlzdGVuZXIudW5pcXVlSWRdID0gZm47XHJcbiAgICAgICAgICAgIHJldHVybiBsaXN0ZW5lcjtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAqIDxwPlJlbW92ZSBhIGxpc3RlbmVyIDwvcD5cclxuICAgICAgICAqIEBtZXRob2QgdW5saXN0ZW5Gcm9tXHJcbiAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lIFRoZSBldmVudE5hbWUgdG8gcmVtb3ZlXHJcbiAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gbGlzdGVuZXJcclxuICAgICAgICAqL1xyXG4gICAgICAgIHVubGlzdGVuRnJvbShldmVudE5hbWUsIGxpc3RlbmVyKSB7XHJcbiAgICAgICAgICAgIF8uZGV2KCgpID0+IFxyXG4gICAgICAgICAgICAgICAgdGhpcy5fbGlzdGVuZXJzLnNob3VsZC5iZS5hbi5PYmplY3QgJiZcclxuICAgICAgICAgICAgICAgIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdLnNob3VsZC5iZS5vayAmJlxyXG4gICAgICAgICAgICAgICAgdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0uc2hvdWxkLmJlLmFuLk9iamVjdCAmJiBcclxuICAgICAgICAgICAgICAgIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdW2xpc3RlbmVyLnVuaXF1ZUlkXS5zaG91bGQuYmUub2sgJiZcclxuICAgICAgICAgICAgICAgIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdW2xpc3RlbmVyLnVuaXF1ZUlkXS5zaG91bGQuYmUuYS5TdHJpbmdcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdO1xyXG4gICAgICAgICAgICBpZihfLnNpemUodGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0pID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV07XHJcbiAgICAgICAgICAgICAgICB0aGlzLl91bmxpc3RlbkZyb20oZXZlbnROYW1lKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiBAbWV0aG9kIF9nZXRGdWxsVXJsXHJcbiAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3VmZml4XHJcbiAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gbGlzdGVuZXJcclxuICAgICAgICAqIEBwcml2YXRlXHJcbiAgICAgICAgKi9cclxuICAgICAgICBfZ2V0RnVsbFVybChzdWZmaXgpIHtcclxuICAgICAgICAgICAgaWYoc3VmZml4LnNsaWNlKDAsIDEpID09PSBcIi9cIiAmJiB0aGlzLl9odHRwRW5kcG9pbnQuc2xpY2UoLTEpID09PSBcIi9cIikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2h0dHBFbmRwb2ludC5zbGljZSgwLCAtMSkgKyBzdWZmaXg7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5faHR0cEVuZHBvaW50ICsgc3VmZml4O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAqIDxwPkZldGNoIGRhdGEgYnkgR0VUIHJlcXVlc3QgZnJvbSB0aGUgdXBsaW5rLXNlcnZlcjwvcD5cclxuICAgICAgICAqIEBtZXRob2QgZmV0Y2hcclxuICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSB0byBmZXRjaFxyXG4gICAgICAgICogQHJldHVybiB7b2JqZWN0fSBvYmplY3QgRmV0Y2hlZCBkYXRhIGFjY29yZGluZyB0byB0aGUga2V5XHJcbiAgICAgICAgKi9cclxuICAgICAgICBmZXRjaChrZXkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2RlYnVnTG9nKFwiPj4+IGZldGNoXCIsIGtleSk7XHJcbiAgICAgICAgICAgICAgICByZXF1ZXN0KHtcclxuICAgICAgICAgICAgICAgICAgICB1cmw6IHRoaXMuX2dldEZ1bGxVcmwoa2V5KSxcclxuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6IFwiR0VUXCIsXHJcbiAgICAgICAgICAgICAgICAgICAganNvbjogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICB3aXRoQ3JlZGVudGlhbHM6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24oZXJyLCByZXMsIGJvZHkpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZihlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgXy5kZXYoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiUi5VcGxpbmsuZmV0Y2goLi4uKTogY291bGRuJ3QgZmV0Y2ggJ1wiICsga2V5ICsgXCInOlwiLCBlcnIudG9TdHJpbmcoKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShudWxsKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKGJvZHkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAqIDxwPkRpc3BhdGNoZXMgYW4gYWN0aW9uIGJ5IFBPU1QgcmVxdWVzdCBmcm9tIHRoZSB1cGxpbmstc2VydmVyPC9wPlxyXG4gICAgICAgICogQG1ldGhvZCBkaXNwYXRjaFxyXG4gICAgICAgICogQHBhcmFtIHtvYmplY3R9IGFjdGlvbiBUaGUgc3BlY2lmaWMgYWN0aW9uIHRvIGRpc3BhdGNoXHJcbiAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gcGFyYW1zXHJcbiAgICAgICAgKiBAcmV0dXJuIHtvYmplY3R9IG9iamVjdCBGZXRjaGVkIGRhdGEgYWNjb3JkaW5nIHRvIHRoZSBzcGVjaWZpZWQgYWN0aW9uXHJcbiAgICAgICAgKi9cclxuICAgICAgICBkaXNwYXRjaChhY3Rpb24sIHBhcmFtcykge1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZGVidWdMb2coXCI+Pj4gZGlzcGF0Y2hcIiwgYWN0aW9uLCBwYXJhbXMpO1xyXG4gICAgICAgICAgICAgICAgcmVxdWVzdCh7XHJcbiAgICAgICAgICAgICAgICAgICAgdXJsOiB0aGlzLl9nZXRGdWxsVXJsKGFjdGlvbiksXHJcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcclxuICAgICAgICAgICAgICAgICAgICBib2R5OiB7IGd1aWQ6IHRoaXMuX2d1aWQsIHBhcmFtczogcGFyYW1zIH0sXHJcbiAgICAgICAgICAgICAgICAgICAganNvbjogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICB3aXRoQ3JlZGVudGlhbHM6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24oZXJyLCByZXMsIGJvZHkpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZihlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGJvZHkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICogPHA+RGVzdHJveSBzb2NrZXQgY2xpZW50LXNpZGU8L3A+XHJcbiAgICAgICAgKiBAbWV0aG9kIGRlc3Ryb3lcclxuICAgICAgICAqL1xyXG4gICAgICAgIGRlc3Ryb3koKSB7XHJcbiAgICAgICAgICAgIGlmKFIuaXNDbGllbnQoKSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZGVzdHJveUluQ2xpZW50KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYoUi5pc1NlcnZlcigpKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9kZXN0cm95SW5TZXJ2ZXIoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICBfLmV4dGVuZChVcGxpbmssIHtcclxuICAgICAgICBTdWJzY3JpcHRpb24oa2V5KSB7XHJcbiAgICAgICAgICAgIHRoaXMua2V5ID0ga2V5O1xyXG4gICAgICAgICAgICB0aGlzLnVuaXF1ZUlkID0gXy51bmlxdWVJZChcIlIuVXBsaW5rLlN1YnNjcmlwdGlvblwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIExpc3RlbmVyKGV2ZW50TmFtZSkge1xyXG4gICAgICAgICAgICB0aGlzLmV2ZW50TmFtZSA9IGV2ZW50TmFtZTtcclxuICAgICAgICAgICAgdGhpcy51bmlxdWVJZCA9IF8udW5pcXVlSWQoXCJSLlVwbGluay5MaXN0ZW5lclwiKTtcclxuICAgICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIFVwbGluaztcclxufTtcclxuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9