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

  /**
   * <p>The Uplink micro-protocol is a simple set of conventions to implement real-time reactive Flux over the wire. <br />
   * The frontend and the backend server share 2 means of communications : <br />
   * - a WebSocket-like (socket.io wrapper) duplex connection to handshake and subscribe to keys/listen to events <br />
   * - regulars HTTP requests (front -> back) to actually get data from the stores</p>
   * <p>
   * PROTOCOL: <br />
   *<br />
   * Connection/reconnection:<br />
   *<br />
   * Client: bind socket<br />
   * Server: Acknowledge connection<br />
   * Client: send "handshake" { guid: guid }<br />
   * Server: send "handshake-ack" { recovered: bool } (recover previous session if existing based upon guid; recovered is true iff previous session existed)<br /><br />
   *<br />
   * Stores:<br />
   * Client: send "subscribeTo" { key: key }<br />
   * Server: send "update" { key: key }<br />
   * Client: XHR GET /uplink/key<br />
   *<br />
   * Events:
   * Client: send "listenTo" { eventName: eventName }<br />
   * Server: send "event" { eventName: eventName, params: params }<br />
   *<br />
   * Actions:<br />
   * Client: XHR POST /uplink/action { params: params }<br />
   *<br />
   * Other notifications:<br />
   * Server: send "debug": { debug: debug } Debug-level message<br />
   * Server: send "log" { log: log } Log-level message<br />
   * Server: send "warn": { warn: warn } Warn-level message<br />
   * Server: send "err": { err: err } Error-level message<br />
   * </p>
   * @class R.Uplink
   */

  /**
  * <p> Initializes the uplink according to the specifications provided </p>
  * @method Uplink
  * @param {object} httpEndpoint
  * @param {object} socketEndpoint
  * @param {object} guid
  * @param {object} shouldReloadOnServerRestart
  */
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
    _debugLog: function _debugLog() {
      var args = arguments;
      R.Debug.dev(function () {
        console.log.apply(console, args);
      });
    },
    /**
    * <p>Emits a socket signal to the uplink-server</p>
    * @param {string} name The name of the signal
    * @param {object} params The specifics params to send
    * @private
    */
    _emit: function _emit(name, params) {
      R.Debug.dev(R.scope(function () {
        assert(this._socket && null !== this._socket, "R.Uplink.emit(...): no active socket ('" + name + "', '" + params + "')");
      }, this));
      this._debugLog(">>> " + name, params);
      this._socket.emit(name, params);
    },

    /**
    * <p> Creating io connection client-side in order to use sockets </p>
    * @method _initInClient
    * @private
    */
    _initInClient: function _initInClient() {
      R.Debug.dev(function () {
        assert(R.isClient(), "R.Uplink._initInClient(...): should only be called in the client.");
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
        this.ready = new Promise(R.scope(function (resolve, reject) {
          this._acknowledgeHandshake = resolve;
        }, this));
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
    _initInServer: function _initInClient() {
      R.Debug.dev(function () {
        assert(R.isServer(), "R.Uplink._initInServer(...): should only be called in the server.");
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
    _handleUpdate: function _handleUpdate(params) {
      this._debugLog("<<< update", params);
      R.Debug.dev(function () {
        assert(_.isObject(params), "R.Uplink._handleUpdate.params: expecting Object.");
        assert(params.k && _.isString(params.k), "R.Uplink._handleUpdate.params.k: expecting String.");
        assert(_.has(params, "v"), "R.Uplink._handleUpdate.params.v: expecting an entry.");
        assert(params.d && _.isArray(params.d), "R.Uplink._handleUpdate.params.d: expecting Array.");
        assert(params.h && _.isString(params.h), "R.Uplink._handleUpdate.params.h: expecting String.");
      });
      var key = params.k;
      this._performUpdateIfNecessary(key, params)(R.scope(function (err, val) {
        R.Debug.dev(function () {
          if (err) {
            throw R.Debug.extendError(err, "R.Uplink._handleUpdate(...): couldn't _performUpdateIfNecessary.");
          }
        });
        if (err) {
          return;
        }
        this._data[key] = val;
        this._hashes[key] = R.hash(JSON.stringify(val));
        if (_.has(this._subscriptions, key)) {
          _.each(this._subscriptions[key], function (fn) {
            fn(key, val);
          });
        }
      }, this));
    },
    /**
    * @method _shouldFetchKey
    * @param {string} key
    * @param {object} entry
    * @return {Boolean} bool The boolean
    * @private
    */
    _shouldFetchKey: function _shouldFetchKey(key, entry) {
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
    _performUpdateIfNecessary: function _performUpdateIfNecessary(key, entry) {
      return R.scope(function (fn) {
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
        })).call(this, fn);
      }, this);
    },

    /**
    * @method _handleEvent
    * @param {string} params
    * @private
    */
    _handleEvent: function _handleEvent(params) {
      this._debugLog("<<< event", params.eventName);
      var eventName = params.eventName;
      var eventParams = params.params;
      if (_.has(this._listeners, eventName)) {
        _.each(this._listeners[eventName], function (fn) {
          fn(eventParams);
        });
      }
    },
    /**
    * @method _handleDisconnect
    * @param {string} params
    * @private
    */
    _handleDisconnect: function _handleDisconnect(params) {
      this._debugLog("<<< disconnect", params);
      this.ready = new Promise(R.scope(function (resolve, reject) {
        this._acknowledgeHandshake = resolve;
      }, this));
    },
    /**
    * <p>Occurs after a connection. When a connection is established, the client sends a signal "handshake".</p>
    * @method _handleDisconnect
    * @private
    */
    _handleConnect: function _handleConnect() {
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
    _handleHandshakeAck: function _handleHandshakeAck(params) {
      this._debugLog("<<< handshake-ack", params);
      if (this._pid && params.pid !== this._pid && this.shouldReloadOnServerRestart) {
        R.Debug.dev(function () {
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
    _handleDebug: function _handleDebug(params) {
      this._debugLog("<<< debug", params);
      R.Debug.dev(function () {
        console.warn("R.Uplink.debug(...):", params.debug);
      });
    },
    /**
    * @method _handleLog
    * @params {object} params
    * @private
    */
    _handleLog: function _handleLog(params) {
      this._debugLog("<<< log", params);
      console.log("R.Uplink.log(...):", params.log);
    },
    /**
    * @method _handleWarn
    * @params {object} params
    * @private
    */
    _handleWarn: function _handleWarn(params) {
      this._debugLog("<<< warn", params);
      console.warn("R.Uplink.warn(...):", params.warn);
    },
    /**
    * @method _handleError
    * @params {object} params
    * @private
    */
    _handleError: function _handleError(params) {
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
    _handleUnload: function _handleUnload(prevHandler) {
      return R.scope(function () {
        if (prevHandler) {
          prevHandler();
        }
        this._emit("unhandshake");
      }, this);
    },

    /**
    * <p>Simply closes the socket</p>
    * @method _destroyInClient
    * @private
    */
    _destroyInClient: function _destroyInClient() {
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
    _destroyInServer: function _destroyInServer() {
      return void 0;
    },

    /**
    * <p>Notifies the uplink-server that a subscription is required by client</p>
    * @method _subscribeTo
    * @return {string} key The key to subscribe
    * @private
    */
    _subscribeTo: function _subscribeTo(key) {
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
    _unsubscribeFrom: function _unsubscribeFrom(key) {
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
    subscribeTo: function subscribeTo(key, fn) {
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
    unsubscribeFrom: function unsubscribeFrom(key, subscription) {
      R.Debug.dev(R.scope(function () {
        assert(_.has(this._subscriptions, key), "R.Uplink.unsub(...): no such key.");
        assert(_.has(this._subscriptions[key], subscription.uniqueId), "R.Uplink.unsub(...): no such subscription.");
      }, this));
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
    _listenTo: function _listenTo(eventName) {
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
    _unlistenFrom: function _unlistenFrom(eventName) {
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
    listenTo: function listenTo(eventName, fn) {
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
    unlistenFrom: function unlistenFrom(eventName, listener) {
      R.Debug.dev(R.scope(function () {
        assert(_.has(this._listeners, eventName), "R.Uplink.removeListener(...): no such eventName.");
        assert(_.has(this._listeners[eventName], listener.uniqueId), "R.Uplink.removeListener(...): no such listener.");
      }, this));
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
    _getFullUrl: function _getFullUrl(suffix) {
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
    fetch: function fetch(key) {
      return new Promise(R.scope(function (resolve, reject) {
        this._debugLog(">>> fetch", key);
        request({
          url: this._getFullUrl(key),
          method: "GET",
          json: true,
          withCredentials: false }, function (err, res, body) {
          if (err) {
            R.Debug.dev(function () {
              console.warn("R.Uplink.fetch(...): couldn't fetch '" + key + "':", err.toString());
            });
            return resolve(null);
          } else {
            return resolve(body);
          }
        });
      }, this));
    },

    /**
    * <p>Dispatches an action by POST request from the uplink-server</p>
    * @method dispatch
    * @param {object} action The specific action to dispatch
    * @param {object} params
    * @return {object} object Fetched data according to the specified action
    */
    dispatch: function dispatch(action, params) {
      return new Promise(R.scope(function (resolve, reject) {
        this._debugLog(">>> dispatch", action, params);
        request({
          url: this._getFullUrl(action),
          method: "POST",
          body: { guid: this._guid, params: params },
          json: true,
          withCredentials: false }, function (err, res, body) {
          if (err) {
            reject(err);
          } else {
            resolve(body);
          }
        });
      }, this));
    },
    /**
    * <p>Destroy socket client-side</p>
    * @method destroy
    */
    destroy: function destroy() {
      if (R.isClient()) {
        this._destroyInClient();
      }
      if (R.isServer()) {
        this._destroyInServer();
      }
    } });

  _.extend(Uplink, {
    Subscription: function Subscription(key) {
      this.key = key;
      this.uniqueId = _.uniqueId("R.Uplink.Subscription");
    },
    Listener: function Listener(eventName) {
      this.eventName = eventName;
      this.uniqueId = _.uniqueId("R.Uplink.Listener");
    } });

  return Uplink;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImQ6L3dvcmtzcGFjZV9yZWZhY3Rvci9yZWFjdC1yYWlscy9zcmMvUi5VcGxpbmsuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7QUFDekIsSUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ3BDLE1BQU0sQ0FBQyxPQUFPLEdBQUcsVUFBUyxDQUFDLEVBQUU7QUFDekIsTUFBSSxHQUFHLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3pCLE1BQUksQ0FBQyxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUMxQixNQUFJLE1BQU0sR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDL0IsTUFBSSxPQUFPLENBQUM7QUFDWixNQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBRTtBQUNiLFdBQU8sR0FBRyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQztHQUN4QyxNQUNJO0FBQ0QsV0FBTyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztHQUNoQztBQUNELE1BQUksRUFBRSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQThDdkIsTUFBSSxNQUFNLEdBQUcsU0FBUyxNQUFNLENBQUMsWUFBWSxFQUFFLGNBQWMsRUFBRSxJQUFJLEVBQUUsMkJBQTJCLEVBQUU7QUFDMUYsUUFBSSxDQUFDLGFBQWEsR0FBRyxZQUFZLENBQUM7QUFDbEMsUUFBSSxDQUFDLGVBQWUsR0FBRyxjQUFjLENBQUM7QUFDdEMsUUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUM7QUFDbEIsUUFBRyxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUU7QUFDYixVQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7S0FDeEI7QUFDRCxRQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBRTtBQUNi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Qyx1QkFBdUIsQ0FBQyxDQUFDO0tBQ3ZEO0FBQ0QsWUFBUSxFQUFFLFNBQVMsUUFBUSxDQUFDLFNBQVMsRUFBRTtBQUNuQyxVQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztBQUMzQixVQUFJLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsbUJBQW1CLENBQUMsQ0FBQztLQUNuRCxFQUNKLENBQUMsQ0FBQzs7QUFFSCxTQUFPLE1BQU0sQ0FBQztDQUNqQixDQUFDIiwiZmlsZSI6IlIuVXBsaW5rLmpzIiwic291cmNlc0NvbnRlbnQiOlsicmVxdWlyZSgnNnRvNS9wb2x5ZmlsbCcpO1xuY29uc3QgUHJvbWlzZSA9IHJlcXVpcmUoJ2JsdWViaXJkJyk7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKFIpIHtcclxuICAgIHZhciB1cmwgPSByZXF1aXJlKFwidXJsXCIpO1xyXG4gICAgdmFyIF8gPSByZXF1aXJlKFwibG9kYXNoXCIpO1xyXG4gICAgdmFyIGFzc2VydCA9IHJlcXVpcmUoXCJhc3NlcnRcIik7XHJcbiAgICB2YXIgcmVxdWVzdDtcclxuICAgIGlmKFIuaXNDbGllbnQoKSkge1xyXG4gICAgICAgIHJlcXVlc3QgPSByZXF1aXJlKFwiYnJvd3Nlci1yZXF1ZXN0XCIpO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgcmVxdWVzdCA9IHJlcXVpcmUoXCJyZXF1ZXN0XCIpO1xyXG4gICAgfVxyXG4gICAgdmFyIGNvID0gcmVxdWlyZShcImNvXCIpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogPHA+VGhlIFVwbGluayBtaWNyby1wcm90b2NvbCBpcyBhIHNpbXBsZSBzZXQgb2YgY29udmVudGlvbnMgdG8gaW1wbGVtZW50IHJlYWwtdGltZSByZWFjdGl2ZSBGbHV4IG92ZXIgdGhlIHdpcmUuIDxiciAvPlxyXG4gICAgICogVGhlIGZyb250ZW5kIGFuZCB0aGUgYmFja2VuZCBzZXJ2ZXIgc2hhcmUgMiBtZWFucyBvZiBjb21tdW5pY2F0aW9ucyA6IDxiciAvPlxyXG4gICAgICogLSBhIFdlYlNvY2tldC1saWtlIChzb2NrZXQuaW8gd3JhcHBlcikgZHVwbGV4IGNvbm5lY3Rpb24gdG8gaGFuZHNoYWtlIGFuZCBzdWJzY3JpYmUgdG8ga2V5cy9saXN0ZW4gdG8gZXZlbnRzIDxiciAvPlxyXG4gICAgICogLSByZWd1bGFycyBIVFRQIHJlcXVlc3RzIChmcm9udCAtPiBiYWNrKSB0byBhY3R1YWxseSBnZXQgZGF0YSBmcm9tIHRoZSBzdG9yZXM8L3A+XHJcbiAgICAgKiA8cD5cclxuICAgICAqIFBST1RPQ09MOiA8YnIgLz5cclxuICAgICAqPGJyIC8+XHJcbiAgICAgKiBDb25uZWN0aW9uL3JlY29ubmVjdGlvbjo8YnIgLz5cclxuICAgICAqPGJyIC8+XHJcbiAgICAgKiBDbGllbnQ6IGJpbmQgc29ja2V0PGJyIC8+XHJcbiAgICAgKiBTZXJ2ZXI6IEFja25vd2xlZGdlIGNvbm5lY3Rpb248YnIgLz5cclxuICAgICAqIENsaWVudDogc2VuZCBcImhhbmRzaGFrZVwiIHsgZ3VpZDogZ3VpZCB9PGJyIC8+XHJcbiAgICAgKiBTZXJ2ZXI6IHNlbmQgXCJoYW5kc2hha2UtYWNrXCIgeyByZWNvdmVyZWQ6IGJvb2wgfSAocmVjb3ZlciBwcmV2aW91cyBzZXNzaW9uIGlmIGV4aXN0aW5nIGJhc2VkIHVwb24gZ3VpZDsgcmVjb3ZlcmVkIGlzIHRydWUgaWZmIHByZXZpb3VzIHNlc3Npb24gZXhpc3RlZCk8YnIgLz48YnIgLz5cclxuICAgICAqPGJyIC8+XHJcbiAgICAgKiBTdG9yZXM6PGJyIC8+XHJcbiAgICAgKiBDbGllbnQ6IHNlbmQgXCJzdWJzY3JpYmVUb1wiIHsga2V5OiBrZXkgfTxiciAvPlxyXG4gICAgICogU2VydmVyOiBzZW5kIFwidXBkYXRlXCIgeyBrZXk6IGtleSB9PGJyIC8+XHJcbiAgICAgKiBDbGllbnQ6IFhIUiBHRVQgL3VwbGluay9rZXk8YnIgLz5cclxuICAgICAqPGJyIC8+XHJcbiAgICAgKiBFdmVudHM6XHJcbiAgICAgKiBDbGllbnQ6IHNlbmQgXCJsaXN0ZW5Ub1wiIHsgZXZlbnROYW1lOiBldmVudE5hbWUgfTxiciAvPlxyXG4gICAgICogU2VydmVyOiBzZW5kIFwiZXZlbnRcIiB7IGV2ZW50TmFtZTogZXZlbnROYW1lLCBwYXJhbXM6IHBhcmFtcyB9PGJyIC8+XHJcbiAgICAgKjxiciAvPlxyXG4gICAgICogQWN0aW9uczo8YnIgLz5cclxuICAgICAqIENsaWVudDogWEhSIFBPU1QgL3VwbGluay9hY3Rpb24geyBwYXJhbXM6IHBhcmFtcyB9PGJyIC8+XHJcbiAgICAgKjxiciAvPlxyXG4gICAgICogT3RoZXIgbm90aWZpY2F0aW9uczo8YnIgLz5cclxuICAgICAqIFNlcnZlcjogc2VuZCBcImRlYnVnXCI6IHsgZGVidWc6IGRlYnVnIH0gRGVidWctbGV2ZWwgbWVzc2FnZTxiciAvPlxyXG4gICAgICogU2VydmVyOiBzZW5kIFwibG9nXCIgeyBsb2c6IGxvZyB9IExvZy1sZXZlbCBtZXNzYWdlPGJyIC8+XHJcbiAgICAgKiBTZXJ2ZXI6IHNlbmQgXCJ3YXJuXCI6IHsgd2Fybjogd2FybiB9IFdhcm4tbGV2ZWwgbWVzc2FnZTxiciAvPlxyXG4gICAgICogU2VydmVyOiBzZW5kIFwiZXJyXCI6IHsgZXJyOiBlcnIgfSBFcnJvci1sZXZlbCBtZXNzYWdlPGJyIC8+XHJcbiAgICAgKiA8L3A+XHJcbiAgICAgKiBAY2xhc3MgUi5VcGxpbmtcclxuICAgICAqL1xyXG5cclxuICAgIC8qKlxyXG4gICAgKiA8cD4gSW5pdGlhbGl6ZXMgdGhlIHVwbGluayBhY2NvcmRpbmcgdG8gdGhlIHNwZWNpZmljYXRpb25zIHByb3ZpZGVkIDwvcD5cclxuICAgICogQG1ldGhvZCBVcGxpbmtcclxuICAgICogQHBhcmFtIHtvYmplY3R9IGh0dHBFbmRwb2ludFxyXG4gICAgKiBAcGFyYW0ge29iamVjdH0gc29ja2V0RW5kcG9pbnRcclxuICAgICogQHBhcmFtIHtvYmplY3R9IGd1aWRcclxuICAgICogQHBhcmFtIHtvYmplY3R9IHNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydFxyXG4gICAgKi9cclxuICAgIHZhciBVcGxpbmsgPSBmdW5jdGlvbiBVcGxpbmsoaHR0cEVuZHBvaW50LCBzb2NrZXRFbmRwb2ludCwgZ3VpZCwgc2hvdWxkUmVsb2FkT25TZXJ2ZXJSZXN0YXJ0KSB7XHJcbiAgICAgICAgdGhpcy5faHR0cEVuZHBvaW50ID0gaHR0cEVuZHBvaW50O1xyXG4gICAgICAgIHRoaXMuX3NvY2tldEVuZFBvaW50ID0gc29ja2V0RW5kcG9pbnQ7XHJcbiAgICAgICAgdGhpcy5fZ3VpZCA9IGd1aWQ7XHJcbiAgICAgICAgaWYoUi5pc0NsaWVudCgpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2luaXRJbkNsaWVudCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZihSLmlzU2VydmVyKCkpIHtcclxuICAgICAgICAgICAgdGhpcy5faW5pdEluU2VydmVyKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX2RhdGEgPSB7fTtcclxuICAgICAgICB0aGlzLl9oYXNoZXMgPSB7fTtcclxuICAgICAgICB0aGlzLl9wZXJmb3JtVXBkYXRlSWZOZWNlc3NhcnkgPSBSLnNjb3BlKHRoaXMuX3BlcmZvcm1VcGRhdGVJZk5lY2Vzc2FyeSwgdGhpcyk7XHJcbiAgICAgICAgdGhpcy5fc2hvdWxkRmV0Y2hLZXkgPSBSLnNjb3BlKHRoaXMuX3Nob3VsZEZldGNoS2V5LCB0aGlzKTtcclxuICAgICAgICB0aGlzLmZldGNoID0gUi5zY29wZSh0aGlzLmZldGNoLCB0aGlzKTtcclxuICAgICAgICB0aGlzLnN1YnNjcmliZVRvID0gUi5zY29wZSh0aGlzLnN1YnNjcmliZVRvLCB0aGlzKTtcclxuICAgICAgICB0aGlzLnVuc3Vic2NyaWJlRnJvbSA9IFIuc2NvcGUodGhpcy51bnN1YnNjcmliZUZyb20sIHRoaXMpO1xyXG4gICAgICAgIHRoaXMubGlzdGVuVG8gPSBSLnNjb3BlKHRoaXMubGlzdGVuVG8sIHRoaXMpO1xyXG4gICAgICAgIHRoaXMudW5saXN0ZW5Gcm9tID0gUi5zY29wZSh0aGlzLnVubGlzdGVuRnJvbSwgdGhpcyk7XHJcbiAgICAgICAgdGhpcy5kaXNwYXRjaCA9IFIuc2NvcGUodGhpcy5kaXNwYXRjaCwgdGhpcyk7XHJcbiAgICAgICAgdGhpcy5zaG91bGRSZWxvYWRPblNlcnZlclJlc3RhcnQgPSBzaG91bGRSZWxvYWRPblNlcnZlclJlc3RhcnQ7XHJcbiAgICB9O1xyXG5cclxuICAgIF8uZXh0ZW5kKFVwbGluay5wcm90b3R5cGUsIC8qKiBAbGVuZHMgUi5VcGxpbmsucHJvdG90eXBlICovIHtcclxuICAgICAgICBfaHR0cEVuZHBvaW50OiBudWxsLFxyXG4gICAgICAgIF9zb2NrZXRFbmRQb2ludDogbnVsbCxcclxuICAgICAgICBfc3Vic2NyaXB0aW9uczogbnVsbCxcclxuICAgICAgICBfbGlzdGVuZXJzOiBudWxsLFxyXG4gICAgICAgIF9zb2NrZXQ6IG51bGwsXHJcbiAgICAgICAgX2d1aWQ6IG51bGwsXHJcbiAgICAgICAgX3BpZDogbnVsbCxcclxuICAgICAgICByZWFkeTogbnVsbCxcclxuICAgICAgICBzaG91bGRSZWxvYWRPblNlcnZlclJlc3RhcnQ6IG51bGwsXHJcbiAgICAgICAgX2Fja25vd2xlZGdlSGFuZHNoYWtlOiBudWxsLFxyXG4gICAgICAgIF9kZWJ1Z0xvZzogZnVuY3Rpb24gX2RlYnVnTG9nKCkge1xyXG4gICAgICAgICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcclxuICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseShjb25zb2xlLCBhcmdzKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAqIDxwPkVtaXRzIGEgc29ja2V0IHNpZ25hbCB0byB0aGUgdXBsaW5rLXNlcnZlcjwvcD5cclxuICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBzaWduYWxcclxuICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBwYXJhbXMgVGhlIHNwZWNpZmljcyBwYXJhbXMgdG8gc2VuZFxyXG4gICAgICAgICogQHByaXZhdGVcclxuICAgICAgICAqL1xyXG4gICAgICAgIF9lbWl0OiBmdW5jdGlvbiBfZW1pdChuYW1lLCBwYXJhbXMpIHtcclxuICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoUi5zY29wZShmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIGFzc2VydCh0aGlzLl9zb2NrZXQgJiYgbnVsbCAhPT0gdGhpcy5fc29ja2V0LCBcIlIuVXBsaW5rLmVtaXQoLi4uKTogbm8gYWN0aXZlIHNvY2tldCAoJ1wiICsgbmFtZSArIFwiJywgJ1wiICsgcGFyYW1zICsgXCInKVwiKTtcclxuICAgICAgICAgICAgfSwgdGhpcykpO1xyXG4gICAgICAgICAgICB0aGlzLl9kZWJ1Z0xvZyhcIj4+PiBcIiArIG5hbWUsIHBhcmFtcyk7XHJcbiAgICAgICAgICAgIHRoaXMuX3NvY2tldC5lbWl0KG5hbWUsIHBhcmFtcyk7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiA8cD4gQ3JlYXRpbmcgaW8gY29ubmVjdGlvbiBjbGllbnQtc2lkZSBpbiBvcmRlciB0byB1c2Ugc29ja2V0cyA8L3A+XHJcbiAgICAgICAgKiBAbWV0aG9kIF9pbml0SW5DbGllbnRcclxuICAgICAgICAqIEBwcml2YXRlXHJcbiAgICAgICAgKi9cclxuICAgICAgICBfaW5pdEluQ2xpZW50OiBmdW5jdGlvbiBfaW5pdEluQ2xpZW50KCkge1xyXG4gICAgICAgICAgICBSLkRlYnVnLmRldihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIGFzc2VydChSLmlzQ2xpZW50KCksIFwiUi5VcGxpbmsuX2luaXRJbkNsaWVudCguLi4pOiBzaG91bGQgb25seSBiZSBjYWxsZWQgaW4gdGhlIGNsaWVudC5cIik7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBpZih0aGlzLl9zb2NrZXRFbmRQb2ludCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGlvO1xyXG4gICAgICAgICAgICAgICAgaWYod2luZG93LmlvICYmIF8uaXNGdW5jdGlvbih3aW5kb3cuaW8pKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaW8gPSB3aW5kb3cuaW87XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBpbyA9IHJlcXVpcmUoXCJzb2NrZXQuaW8tY2xpZW50XCIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdGhpcy5fc3Vic2NyaXB0aW9ucyA9IHt9O1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fbGlzdGVuZXJzID0ge307XHJcbiAgICAgICAgICAgICAgICAvL0Nvbm5lY3QgdG8gdXBsaW5rIHNlcnZlci1zaWRlLiBUcmlnZ2VyIHRoZSB1cGxpbmstc2VydmVyIG9uIGlvLm9uKFwiY29ubmVjdGlvblwiKVxyXG4gICAgICAgICAgICAgICAgdmFyIHNvY2tldCA9IHRoaXMuX3NvY2tldCA9IGlvKHRoaXMuX3NvY2tldEVuZFBvaW50KTtcclxuICAgICAgICAgICAgICAgIC8vUHJlcGFyZSBhbGwgZXZlbnQgY2xpZW50LXNpZGUsIGxpc3RlbmluZzpcclxuICAgICAgICAgICAgICAgIHNvY2tldC5vbihcInVwZGF0ZVwiLCBSLnNjb3BlKHRoaXMuX2hhbmRsZVVwZGF0ZSwgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgc29ja2V0Lm9uKFwiZXZlbnRcIiwgUi5zY29wZSh0aGlzLl9oYW5kbGVFdmVudCwgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgc29ja2V0Lm9uKFwiZGlzY29ubmVjdFwiLCBSLnNjb3BlKHRoaXMuX2hhbmRsZURpc2Nvbm5lY3QsIHRoaXMpKTtcclxuICAgICAgICAgICAgICAgIHNvY2tldC5vbihcImNvbm5lY3RcIiwgUi5zY29wZSh0aGlzLl9oYW5kbGVDb25uZWN0LCB0aGlzKSk7XHJcbiAgICAgICAgICAgICAgICBzb2NrZXQub24oXCJoYW5kc2hha2UtYWNrXCIsIFIuc2NvcGUodGhpcy5faGFuZGxlSGFuZHNoYWtlQWNrLCB0aGlzKSk7XHJcbiAgICAgICAgICAgICAgICBzb2NrZXQub24oXCJkZWJ1Z1wiLCBSLnNjb3BlKHRoaXMuX2hhbmRsZURlYnVnLCB0aGlzKSk7XHJcbiAgICAgICAgICAgICAgICBzb2NrZXQub24oXCJsb2dcIiwgUi5zY29wZSh0aGlzLl9oYW5kbGVMb2csIHRoaXMpKTtcclxuICAgICAgICAgICAgICAgIHNvY2tldC5vbihcIndhcm5cIiwgUi5zY29wZSh0aGlzLl9oYW5kbGVXYXJuLCB0aGlzKSk7XHJcbiAgICAgICAgICAgICAgICBzb2NrZXQub24oXCJlcnJcIiwgUi5zY29wZSh0aGlzLl9oYW5kbGVFcnJvciwgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5yZWFkeSA9IG5ldyBQcm9taXNlKFIuc2NvcGUoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYWNrbm93bGVkZ2VIYW5kc2hha2UgPSByZXNvbHZlO1xyXG4gICAgICAgICAgICAgICAgfSwgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgaWYod2luZG93Lm9uYmVmb3JldW5sb2FkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHByZXZIYW5kbGVyID0gd2luZG93Lm9uYmVmb3JldW5sb2FkO1xyXG4gICAgICAgICAgICAgICAgICAgIHdpbmRvdy5vbmJlZm9yZXVubG9hZCA9IFIuc2NvcGUodGhpcy5faGFuZGxlVW5sb2FkKHByZXZIYW5kbGVyKSwgdGhpcyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB3aW5kb3cub25iZWZvcmV1bmxvYWQgPSBSLnNjb3BlKHRoaXMuX2hhbmRsZVVubG9hZChudWxsKSwgdGhpcyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnJlYWR5ID0gUHJvbWlzZS5jYXN0KHRydWUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAqIDxwPlNlcnZlci1zaWRlPC9wPlxyXG4gICAgICAgICogQG1ldGhvZCBfaW5pdEluU2VydmVyXHJcbiAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICovXHJcbiAgICAgICAgX2luaXRJblNlcnZlcjogZnVuY3Rpb24gX2luaXRJbkNsaWVudCgpIHtcclxuICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICBhc3NlcnQoUi5pc1NlcnZlcigpLCBcIlIuVXBsaW5rLl9pbml0SW5TZXJ2ZXIoLi4uKTogc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGluIHRoZSBzZXJ2ZXIuXCIpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgdGhpcy5yZWFkeSA9IFByb21pc2UuY2FzdCh0cnVlKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICogPHA+VHJpZ2dlcmVkIHdoZW4gYSBkYXRhIGlzIHVwZGF0ZWQgYWNjb3JkaW5nIHRvIHRoZSBzcGVjaWZpYyBrZXkgPGJyIC8+XHJcbiAgICAgICAgKiBDYWxsIGNvcnJlc3BvbmRpbmcgZnVuY3Rpb24ga2V5IDwvcD5cclxuICAgICAgICAqIEBtZXRob2QgX2hhbmRsZVVwZGF0ZVxyXG4gICAgICAgICogQHBhcmFtIHtvYmplY3R9IHBhcmFtcyBUaGUgc3BlY2lmaWMga2V5XHJcbiAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICovXHJcbiAgICAgICAgX2hhbmRsZVVwZGF0ZTogZnVuY3Rpb24gX2hhbmRsZVVwZGF0ZShwYXJhbXMpIHtcclxuICAgICAgICAgICAgdGhpcy5fZGVidWdMb2coXCI8PDwgdXBkYXRlXCIsIHBhcmFtcyk7XHJcbiAgICAgICAgICAgIFIuRGVidWcuZGV2KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgYXNzZXJ0KF8uaXNPYmplY3QocGFyYW1zKSwgXCJSLlVwbGluay5faGFuZGxlVXBkYXRlLnBhcmFtczogZXhwZWN0aW5nIE9iamVjdC5cIik7XHJcbiAgICAgICAgICAgICAgICBhc3NlcnQocGFyYW1zLmsgJiYgXy5pc1N0cmluZyhwYXJhbXMuayksIFwiUi5VcGxpbmsuX2hhbmRsZVVwZGF0ZS5wYXJhbXMuazogZXhwZWN0aW5nIFN0cmluZy5cIik7XHJcbiAgICAgICAgICAgICAgICBhc3NlcnQoXy5oYXMocGFyYW1zLCBcInZcIiksIFwiUi5VcGxpbmsuX2hhbmRsZVVwZGF0ZS5wYXJhbXMudjogZXhwZWN0aW5nIGFuIGVudHJ5LlwiKTtcclxuICAgICAgICAgICAgICAgIGFzc2VydChwYXJhbXMuZCAmJiBfLmlzQXJyYXkocGFyYW1zLmQpLCBcIlIuVXBsaW5rLl9oYW5kbGVVcGRhdGUucGFyYW1zLmQ6IGV4cGVjdGluZyBBcnJheS5cIik7XHJcbiAgICAgICAgICAgICAgICBhc3NlcnQocGFyYW1zLmggJiYgXy5pc1N0cmluZyhwYXJhbXMuaCksIFwiUi5VcGxpbmsuX2hhbmRsZVVwZGF0ZS5wYXJhbXMuaDogZXhwZWN0aW5nIFN0cmluZy5cIik7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB2YXIga2V5ID0gcGFyYW1zLms7XHJcbiAgICAgICAgICAgIHRoaXMuX3BlcmZvcm1VcGRhdGVJZk5lY2Vzc2FyeShrZXksIHBhcmFtcykoUi5zY29wZShmdW5jdGlvbihlcnIsIHZhbCkge1xyXG4gICAgICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYoZXJyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IFIuRGVidWcuZXh0ZW5kRXJyb3IoZXJyLCBcIlIuVXBsaW5rLl9oYW5kbGVVcGRhdGUoLi4uKTogY291bGRuJ3QgX3BlcmZvcm1VcGRhdGVJZk5lY2Vzc2FyeS5cIik7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBpZihlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9kYXRhW2tleV0gPSB2YWw7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9oYXNoZXNba2V5XSA9IFIuaGFzaChKU09OLnN0cmluZ2lmeSh2YWwpKTtcclxuICAgICAgICAgICAgICAgIGlmKF8uaGFzKHRoaXMuX3N1YnNjcmlwdGlvbnMsIGtleSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBfLmVhY2godGhpcy5fc3Vic2NyaXB0aW9uc1trZXldLCBmdW5jdGlvbihmbikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmbihrZXksIHZhbCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sIHRoaXMpKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICogQG1ldGhvZCBfc2hvdWxkRmV0Y2hLZXlcclxuICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXlcclxuICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBlbnRyeVxyXG4gICAgICAgICogQHJldHVybiB7Qm9vbGVhbn0gYm9vbCBUaGUgYm9vbGVhblxyXG4gICAgICAgICogQHByaXZhdGVcclxuICAgICAgICAqL1xyXG4gICAgICAgIF9zaG91bGRGZXRjaEtleTogZnVuY3Rpb24gX3Nob3VsZEZldGNoS2V5KGtleSwgZW50cnkpIHtcclxuICAgICAgICAgICAgaWYoIV8uaGFzKHRoaXMuX2RhdGEsIGtleSkgfHwgIV8uaGFzKHRoaXMuX2hhc2hlcywga2V5KSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYodGhpcy5faGFzaGVzW2tleV0gIT09IGVudHJ5LmZyb20pIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAqIDxwPkRldGVybWluZXMgaWYgdGhlIHRoZSBkYXRhIG11c3QgYmUgZmV0Y2hlZDwvcD5cclxuICAgICAgICAqIEBtZXRob2QgX3BlcmZvcm1VcGRhdGVJZk5lY2Vzc2FyeVxyXG4gICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGtleVxyXG4gICAgICAgICogQHBhcmFtIHtvYmplY3R9IGVudHJ5XHJcbiAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn0gZm4gVGhlIEZ1bmN0aW9uIHRvIGNhbGxcclxuICAgICAgICAqIEBwcml2YXRlXHJcbiAgICAgICAgKi9cclxuICAgICAgICBfcGVyZm9ybVVwZGF0ZUlmTmVjZXNzYXJ5OiBmdW5jdGlvbiBfcGVyZm9ybVVwZGF0ZUlmTmVjZXNzYXJ5KGtleSwgZW50cnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFIuc2NvcGUoZnVuY3Rpb24oZm4pIHtcclxuICAgICAgICAgICAgICAgIGNvKGZ1bmN0aW9uKigpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZih0aGlzLl9zaG91bGRGZXRjaEtleShrZXksIGVudHJ5KSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4geWllbGQgdGhpcy5mZXRjaChrZXkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFIucGF0Y2godGhpcy5fZGF0YVtrZXldLCBlbnRyeS5kaWZmKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KS5jYWxsKHRoaXMsIGZuKTtcclxuICAgICAgICAgICAgfSwgdGhpcyk7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiBAbWV0aG9kIF9oYW5kbGVFdmVudFxyXG4gICAgICAgICogQHBhcmFtIHtzdHJpbmd9IHBhcmFtc1xyXG4gICAgICAgICogQHByaXZhdGVcclxuICAgICAgICAqL1xyXG4gICAgICAgIF9oYW5kbGVFdmVudDogZnVuY3Rpb24gX2hhbmRsZUV2ZW50KHBhcmFtcykge1xyXG4gICAgICAgICAgICB0aGlzLl9kZWJ1Z0xvZyhcIjw8PCBldmVudFwiLCBwYXJhbXMuZXZlbnROYW1lKTtcclxuICAgICAgICAgICAgdmFyIGV2ZW50TmFtZSA9IHBhcmFtcy5ldmVudE5hbWU7XHJcbiAgICAgICAgICAgIHZhciBldmVudFBhcmFtcyA9IHBhcmFtcy5wYXJhbXM7XHJcbiAgICAgICAgICAgIGlmKF8uaGFzKHRoaXMuX2xpc3RlbmVycywgZXZlbnROYW1lKSkge1xyXG4gICAgICAgICAgICAgICAgXy5lYWNoKHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdLCBmdW5jdGlvbihmbikge1xyXG4gICAgICAgICAgICAgICAgICAgIGZuKGV2ZW50UGFyYW1zKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAqIEBtZXRob2QgX2hhbmRsZURpc2Nvbm5lY3RcclxuICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBwYXJhbXNcclxuICAgICAgICAqIEBwcml2YXRlXHJcbiAgICAgICAgKi9cclxuICAgICAgICBfaGFuZGxlRGlzY29ubmVjdDogZnVuY3Rpb24gX2hhbmRsZURpc2Nvbm5lY3QocGFyYW1zKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2RlYnVnTG9nKFwiPDw8IGRpc2Nvbm5lY3RcIiwgcGFyYW1zKTtcclxuICAgICAgICAgICAgdGhpcy5yZWFkeSA9IG5ldyBQcm9taXNlKFIuc2NvcGUoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9hY2tub3dsZWRnZUhhbmRzaGFrZSA9IHJlc29sdmU7XHJcbiAgICAgICAgICAgIH0sIHRoaXMpKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICogPHA+T2NjdXJzIGFmdGVyIGEgY29ubmVjdGlvbi4gV2hlbiBhIGNvbm5lY3Rpb24gaXMgZXN0YWJsaXNoZWQsIHRoZSBjbGllbnQgc2VuZHMgYSBzaWduYWwgXCJoYW5kc2hha2VcIi48L3A+XHJcbiAgICAgICAgKiBAbWV0aG9kIF9oYW5kbGVEaXNjb25uZWN0XHJcbiAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICovXHJcbiAgICAgICAgX2hhbmRsZUNvbm5lY3Q6IGZ1bmN0aW9uIF9oYW5kbGVDb25uZWN0KCkge1xyXG4gICAgICAgICAgICB0aGlzLl9kZWJ1Z0xvZyhcIjw8PCBjb25uZWN0XCIpO1xyXG4gICAgICAgICAgICAvL25vdGlmeSB1cGxpbmstc2VydmVyXHJcbiAgICAgICAgICAgIHRoaXMuX2VtaXQoXCJoYW5kc2hha2VcIiwgeyBndWlkOiB0aGlzLl9ndWlkIH0pO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICogPHA+IElkZW50aWZpZXMgaWYgdGhlIHBpZCBvZiB0aGUgc2VydmVyIGhhcyBjaGFuZ2VkIChkdWUgdG8gYSBwb3RlbnRpYWwgcmVib290IHNlcnZlci1zaWRlKSBzaW5jZSB0aGUgbGFzdCBjbGllbnQgY29ubmVjdGlvbi4gPGJyIC8+XHJcbiAgICAgICAgKiBJZiB0aGlzIGlzIHRoZSBjYXNlLCBhIHBhZ2UgcmVsb2FkIGlzIHBlcmZvcm1lZDxwPlxyXG4gICAgICAgICogQG1ldGhvZCBfaGFuZGxlSGFuZHNoYWtlQWNrXHJcbiAgICAgICAgKiBAcGFyYW1zIHtvYmplY3R9IHBhcmFtc1xyXG4gICAgICAgICogQHByaXZhdGVcclxuICAgICAgICAqL1xyXG4gICAgICAgIF9oYW5kbGVIYW5kc2hha2VBY2s6IGZ1bmN0aW9uIF9oYW5kbGVIYW5kc2hha2VBY2socGFyYW1zKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2RlYnVnTG9nKFwiPDw8IGhhbmRzaGFrZS1hY2tcIiwgcGFyYW1zKTtcclxuICAgICAgICAgICAgaWYodGhpcy5fcGlkICYmIHBhcmFtcy5waWQgIT09IHRoaXMuX3BpZCAmJiB0aGlzLnNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydCkge1xyXG4gICAgICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiU2VydmVyIHBpZCBoYXMgY2hhbmdlZCwgcmVsb2FkaW5nIHBhZ2UuXCIpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQodHJ1ZSk7XHJcbiAgICAgICAgICAgICAgICB9LCBfLnJhbmRvbSgyMDAwLCAxMDAwMCkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuX3BpZCA9IHBhcmFtcy5waWQ7XHJcbiAgICAgICAgICAgIHRoaXMuX2Fja25vd2xlZGdlSGFuZHNoYWtlKHBhcmFtcyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAqIEBtZXRob2QgX2hhbmRsZURlYnVnXHJcbiAgICAgICAgKiBAcGFyYW1zIHtvYmplY3R9IHBhcmFtc1xyXG4gICAgICAgICogQHByaXZhdGVcclxuICAgICAgICAqL1xyXG4gICAgICAgIF9oYW5kbGVEZWJ1ZzogZnVuY3Rpb24gX2hhbmRsZURlYnVnKHBhcmFtcykge1xyXG4gICAgICAgICAgICB0aGlzLl9kZWJ1Z0xvZyhcIjw8PCBkZWJ1Z1wiLCBwYXJhbXMpO1xyXG4gICAgICAgICAgICBSLkRlYnVnLmRldihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIlIuVXBsaW5rLmRlYnVnKC4uLik6XCIsIHBhcmFtcy5kZWJ1Zyk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiBAbWV0aG9kIF9oYW5kbGVMb2dcclxuICAgICAgICAqIEBwYXJhbXMge29iamVjdH0gcGFyYW1zXHJcbiAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICovXHJcbiAgICAgICAgX2hhbmRsZUxvZzogZnVuY3Rpb24gX2hhbmRsZUxvZyhwYXJhbXMpIHtcclxuICAgICAgICAgICAgdGhpcy5fZGVidWdMb2coXCI8PDwgbG9nXCIsIHBhcmFtcyk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiUi5VcGxpbmsubG9nKC4uLik6XCIsIHBhcmFtcy5sb2cpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiBAbWV0aG9kIF9oYW5kbGVXYXJuXHJcbiAgICAgICAgKiBAcGFyYW1zIHtvYmplY3R9IHBhcmFtc1xyXG4gICAgICAgICogQHByaXZhdGVcclxuICAgICAgICAqL1xyXG4gICAgICAgIF9oYW5kbGVXYXJuOiBmdW5jdGlvbiBfaGFuZGxlV2FybihwYXJhbXMpIHtcclxuICAgICAgICAgICAgdGhpcy5fZGVidWdMb2coXCI8PDwgd2FyblwiLCBwYXJhbXMpO1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oXCJSLlVwbGluay53YXJuKC4uLik6XCIsIHBhcmFtcy53YXJuKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICogQG1ldGhvZCBfaGFuZGxlRXJyb3JcclxuICAgICAgICAqIEBwYXJhbXMge29iamVjdH0gcGFyYW1zXHJcbiAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICovXHJcbiAgICAgICAgX2hhbmRsZUVycm9yOiBmdW5jdGlvbiBfaGFuZGxlRXJyb3IocGFyYW1zKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2RlYnVnTG9nKFwiPDw8IGVycm9yXCIsIHBhcmFtcyk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJSLlVwbGluay5lcnIoLi4uKTpcIiwgcGFyYW1zLmVycik7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiA8cD5PY2N1cnMgd2hlbiBhIGNsaWVudCB1bmxvYWRzIHRoZSBkb2N1bWVudDwvcD5cclxuICAgICAgICAqIEBtZXRob2QgX2hhbmRsZVVubG9hZFxyXG4gICAgICAgICogQHBhcmFtcyB7RnVuY3Rpb259IHByZXZIYW5kbGVyIFRoZSBmdW5jdGlvbiB0byBleGVjdXRlIHdoZW4gdGhlIHBhZ2Ugd2lsbCBiZSB1bmxvYWRlZFxyXG4gICAgICAgICogQHJldHVybiB7RnVuY3Rpb259IGZ1bmN0aW9uXHJcbiAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICovXHJcbiAgICAgICAgX2hhbmRsZVVubG9hZDogZnVuY3Rpb24gX2hhbmRsZVVubG9hZChwcmV2SGFuZGxlcikge1xyXG4gICAgICAgICAgICByZXR1cm4gUi5zY29wZShmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIGlmKHByZXZIYW5kbGVyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcHJldkhhbmRsZXIoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoXCJ1bmhhbmRzaGFrZVwiKTtcclxuICAgICAgICAgICAgfSwgdGhpcyk7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiA8cD5TaW1wbHkgY2xvc2VzIHRoZSBzb2NrZXQ8L3A+XHJcbiAgICAgICAgKiBAbWV0aG9kIF9kZXN0cm95SW5DbGllbnRcclxuICAgICAgICAqIEBwcml2YXRlXHJcbiAgICAgICAgKi9cclxuICAgICAgICBfZGVzdHJveUluQ2xpZW50OiBmdW5jdGlvbiBfZGVzdHJveUluQ2xpZW50KCkge1xyXG4gICAgICAgICAgICBpZih0aGlzLl9zb2NrZXQpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3NvY2tldC5jbG9zZSgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAqIDxwPkRvZXMgbm90aGluZzwvcD5cclxuICAgICAgICAqIEBtZXRob2QgX2Rlc3Ryb3lJbkNsaWVudFxyXG4gICAgICAgICogQHJldHVybiB7Kn0gdm9pZDBcclxuICAgICAgICAqIEBwcml2YXRlXHJcbiAgICAgICAgKi9cclxuICAgICAgICBfZGVzdHJveUluU2VydmVyOiBmdW5jdGlvbiBfZGVzdHJveUluU2VydmVyKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdm9pZCAwO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICogPHA+Tm90aWZpZXMgdGhlIHVwbGluay1zZXJ2ZXIgdGhhdCBhIHN1YnNjcmlwdGlvbiBpcyByZXF1aXJlZCBieSBjbGllbnQ8L3A+XHJcbiAgICAgICAgKiBAbWV0aG9kIF9zdWJzY3JpYmVUb1xyXG4gICAgICAgICogQHJldHVybiB7c3RyaW5nfSBrZXkgVGhlIGtleSB0byBzdWJzY3JpYmVcclxuICAgICAgICAqIEBwcml2YXRlXHJcbiAgICAgICAgKi9cclxuICAgICAgICBfc3Vic2NyaWJlVG86IGZ1bmN0aW9uIF9zdWJzY3JpYmVUbyhrZXkpIHtcclxuICAgICAgICAgICAgY28oZnVuY3Rpb24qKCkge1xyXG4gICAgICAgICAgICAgICAgeWllbGQgdGhpcy5yZWFkeTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoXCJzdWJzY3JpYmVUb1wiLCB7IGtleToga2V5IH0pO1xyXG4gICAgICAgICAgICB9KS5jYWxsKHRoaXMsIFIuRGVidWcucmV0aHJvdyhcIlIuVXBsaW5rLl9zdWJzY3JpYmVUbyguLi4pOiBjb3VsZG4ndCBzdWJzY3JpYmUgKFwiICsga2V5ICsgXCIpXCIpKTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAqIDxwPk5vdGlmaWVzIHRoZSB1cGxpbmstc2VydmVyIHRoYXQgYSBzdWJzY3JpcHRpb24gaXMgb3ZlcjwvcD5cclxuICAgICAgICAqIEBtZXRob2QgX3N1YnNjcmliZVRvXHJcbiAgICAgICAgKiBAcmV0dXJuIHtzdHJpbmd9IGtleSBUaGUga2V5IHRvIHVuc3Vic2NyaWJlXHJcbiAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICovXHJcbiAgICAgICAgX3Vuc3Vic2NyaWJlRnJvbTogZnVuY3Rpb24gX3Vuc3Vic2NyaWJlRnJvbShrZXkpIHtcclxuICAgICAgICAgICAgY28oZnVuY3Rpb24qKCkge1xyXG4gICAgICAgICAgICAgICAgeWllbGQgdGhpcy5yZWFkeTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoXCJ1bnN1YnNjcmliZUZyb21cIiwgeyBrZXk6IGtleSB9KTtcclxuICAgICAgICAgICAgfSkuY2FsbCh0aGlzLCBSLkRlYnVnLnJldGhyb3coXCJSLlVwbGluay5fc3Vic2NyaWJlVG8oLi4uKTogY291bGRuJ3QgdW5zdWJzY3JpYmUgKFwiICsga2V5ICsgXCIpXCIpKTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAqIDxwPkV0YWJsaXNoZXMgYSBzdWJzY3JpcHRpb24gdG8gYSBrZXksIGFuZCBjYWxsIHRoZSBzcGVjaWZpZWQgZnVuY3Rpb24gd2hlbiBfaGFuZGxlVXBkYXRlIG9jY3VyczwvcD5cclxuICAgICAgICAqIEBtZXRob2Qgc3Vic2NyaWJlVG9cclxuICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSB0byBzdWJzY3JpYmVcclxuICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IGZuIFRoZSBmdW5jdGlvbiB0byBleGVjdXRlXHJcbiAgICAgICAgKiBAcmV0dXJuIHtvYmplY3R9IHN1YnNjcmlwdGlvbiBUaGUgY3JlYXRlZCBzdWJzY3JpcHRpb25cclxuICAgICAgICAqL1xyXG4gICAgICAgIHN1YnNjcmliZVRvOiBmdW5jdGlvbiBzdWJzY3JpYmVUbyhrZXksIGZuKSB7XHJcbiAgICAgICAgICAgIHZhciBzdWJzY3JpcHRpb24gPSBuZXcgUi5VcGxpbmsuU3Vic2NyaXB0aW9uKGtleSk7XHJcbiAgICAgICAgICAgIGlmKCFfLmhhcyh0aGlzLl9zdWJzY3JpcHRpb25zLCBrZXkpKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9zdWJzY3JpYmVUbyhrZXkpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fc3Vic2NyaXB0aW9uc1trZXldID0ge307XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9kYXRhW2tleV0gPSB7fTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2hhc2hlc1trZXldID0gUi5oYXNoKEpTT04uc3RyaW5naWZ5KHt9KSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5fc3Vic2NyaXB0aW9uc1trZXldW3N1YnNjcmlwdGlvbi51bmlxdWVJZF0gPSBmbjtcclxuICAgICAgICAgICAgcmV0dXJuIHN1YnNjcmlwdGlvbjtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAqIDxwPlJlbW92ZXMgYSBzdWJzY3JpcHRpb24gdG8gYSBrZXk8L3A+XHJcbiAgICAgICAgKiBAbWV0aG9kIHN1YnNjcmliZVRvXHJcbiAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgdG8gc3Vic2NyaWJlXHJcbiAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gc3Vic2NyaXB0aW9uXHJcbiAgICAgICAgKi9cclxuICAgICAgICB1bnN1YnNjcmliZUZyb206IGZ1bmN0aW9uIHVuc3Vic2NyaWJlRnJvbShrZXksIHN1YnNjcmlwdGlvbikge1xyXG4gICAgICAgICAgICBSLkRlYnVnLmRldihSLnNjb3BlKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgYXNzZXJ0KF8uaGFzKHRoaXMuX3N1YnNjcmlwdGlvbnMsIGtleSksIFwiUi5VcGxpbmsudW5zdWIoLi4uKTogbm8gc3VjaCBrZXkuXCIpO1xyXG4gICAgICAgICAgICAgICAgYXNzZXJ0KF8uaGFzKHRoaXMuX3N1YnNjcmlwdGlvbnNba2V5XSwgc3Vic2NyaXB0aW9uLnVuaXF1ZUlkKSwgXCJSLlVwbGluay51bnN1YiguLi4pOiBubyBzdWNoIHN1YnNjcmlwdGlvbi5cIik7XHJcbiAgICAgICAgICAgIH0sIHRoaXMpKTtcclxuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3N1YnNjcmlwdGlvbnNba2V5XVtzdWJzY3JpcHRpb24udW5pcXVlSWRdO1xyXG4gICAgICAgICAgICBpZihfLnNpemUodGhpcy5fc3Vic2NyaXB0aW9uc1trZXldKSA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3N1YnNjcmlwdGlvbnNba2V5XTtcclxuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9kYXRhW2tleV07XHJcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5faGFzaGVzW2tleV07XHJcbiAgICAgICAgICAgICAgICB0aGlzLl91bnN1YnNjcmliZUZyb20oa2V5KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiA8cD5TZW5kcyB0aGUgbGlzdGVuZXIgc2lnbmFsIFwibGlzdGVuVG9cIjwvcD5cclxuICAgICAgICAqIEBtZXRob2QgX2xpc3RlblRvXHJcbiAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lIFRoZSBldmVudE5hbWUgdG8gbGlzdGVuXHJcbiAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICovXHJcbiAgICAgICAgX2xpc3RlblRvOiBmdW5jdGlvbiBfbGlzdGVuVG8oZXZlbnROYW1lKSB7XHJcbiAgICAgICAgICAgIGNvKGZ1bmN0aW9uKigpIHtcclxuICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMucmVhZHk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KFwibGlzdGVuVG9cIiwgeyBldmVudE5hbWU6IGV2ZW50TmFtZSB9KTtcclxuICAgICAgICAgICAgfSkuY2FsbCh0aGlzLCBSLkRlYnVnLnJldGhyb3coXCJSLlVwbGluay5fbGlzdGVuVG86IGNvdWxkbid0IGxpc3RlbiAoXCIgKyBldmVudE5hbWUgKyBcIilcIikpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgIC8qKlxyXG4gICAgICAgICogPHA+U2VuZHMgdGhlIHVubGlzdGVuZXIgc2lnbmFsIFwidW5saXN0ZW5Gcm9tXCI8L3A+XHJcbiAgICAgICAgKiBAbWV0aG9kIF91bmxpc3RlbkZyb21cclxuICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudE5hbWUgVGhlIGV2ZW50TmFtZSB0byBsaXN0ZW5cclxuICAgICAgICAqIEBwcml2YXRlXHJcbiAgICAgICAgKi9cclxuICAgICAgICBfdW5saXN0ZW5Gcm9tOiBmdW5jdGlvbiBfdW5saXN0ZW5Gcm9tKGV2ZW50TmFtZSkge1xyXG4gICAgICAgICAgICBjbyhmdW5jdGlvbiooKSB7XHJcbiAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLnJlYWR5O1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZW1pdChcInVubGlzdGVuRnJvbVwiLCB7IGV2ZW50TmFtZTogZXZlbnROYW1lIH0pO1xyXG4gICAgICAgICAgICB9KS5jYWxsKHRoaXMsIFIuRGVidWcucmV0aHJvdyhcIlIuVXBsaW5rLl91bmxpc3RlbkZyb206IGNvdWxkbid0IHVubGlzdGVuIChcIiArIGV2ZW50TmFtZSArIFwiKVwiKSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAqIDxwPkNyZWF0ZSBhIGxpc3RlbmVyIGFjY29yZGluZyB0byBhIHNwZWNpZmljIG5hbWU8L3A+XHJcbiAgICAgICAgKiBAbWV0aG9kIGxpc3RlblRvXHJcbiAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lIFRoZSBldmVudE5hbWUgdG8gbGlzdGVuXHJcbiAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBmbiBUaGUgZnVuY3Rpb24gdG8gZXhlY3V0ZSB3aGVuIHRyaWdnZXJlZFxyXG4gICAgICAgICogQHJldHVybiB7b2JqZWN0fSBsaXN0ZW5lciBUaGUgY3JlYXRlZCBsaXN0ZW5lclxyXG4gICAgICAgICovXHJcbiAgICAgICAgbGlzdGVuVG86IGZ1bmN0aW9uIGxpc3RlblRvKGV2ZW50TmFtZSwgZm4pIHtcclxuICAgICAgICAgICAgdmFyIGxpc3RlbmVyID0gUi5VcGxpbmsuTGlzdGVuZXIoZXZlbnROYW1lKTtcclxuICAgICAgICAgICAgaWYoIV8uaGFzKHRoaXMuX2xpc3RlbmVycywgZXZlbnROYW1lKSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fbGlzdGVuVG8oZXZlbnROYW1lKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdID0ge307XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV1bbGlzdGVuZXIudW5pcXVlSWRdID0gZm47XHJcbiAgICAgICAgICAgIHJldHVybiBsaXN0ZW5lcjtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAqIDxwPlJlbW92ZSBhIGxpc3RlbmVyIDwvcD5cclxuICAgICAgICAqIEBtZXRob2QgdW5saXN0ZW5Gcm9tXHJcbiAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lIFRoZSBldmVudE5hbWUgdG8gcmVtb3ZlXHJcbiAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gbGlzdGVuZXJcclxuICAgICAgICAqL1xyXG4gICAgICAgIHVubGlzdGVuRnJvbTogZnVuY3Rpb24gdW5saXN0ZW5Gcm9tKGV2ZW50TmFtZSwgbGlzdGVuZXIpIHtcclxuICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoUi5zY29wZShmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIGFzc2VydChfLmhhcyh0aGlzLl9saXN0ZW5lcnMsIGV2ZW50TmFtZSksIFwiUi5VcGxpbmsucmVtb3ZlTGlzdGVuZXIoLi4uKTogbm8gc3VjaCBldmVudE5hbWUuXCIpO1xyXG4gICAgICAgICAgICAgICAgYXNzZXJ0KF8uaGFzKHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdLCBsaXN0ZW5lci51bmlxdWVJZCksIFwiUi5VcGxpbmsucmVtb3ZlTGlzdGVuZXIoLi4uKTogbm8gc3VjaCBsaXN0ZW5lci5cIik7XHJcbiAgICAgICAgICAgIH0sIHRoaXMpKTtcclxuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdO1xyXG4gICAgICAgICAgICBpZihfLnNpemUodGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0pID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV07XHJcbiAgICAgICAgICAgICAgICB0aGlzLl91bmxpc3RlbkZyb20oZXZlbnROYW1lKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiBAbWV0aG9kIF9nZXRGdWxsVXJsXHJcbiAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3VmZml4XHJcbiAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gbGlzdGVuZXJcclxuICAgICAgICAqIEBwcml2YXRlXHJcbiAgICAgICAgKi9cclxuICAgICAgICBfZ2V0RnVsbFVybDogZnVuY3Rpb24gX2dldEZ1bGxVcmwoc3VmZml4KSB7XHJcbiAgICAgICAgICAgIGlmKHN1ZmZpeC5zbGljZSgwLCAxKSA9PT0gXCIvXCIgJiYgdGhpcy5faHR0cEVuZHBvaW50LnNsaWNlKC0xKSA9PT0gXCIvXCIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9odHRwRW5kcG9pbnQuc2xpY2UoMCwgLTEpICsgc3VmZml4O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2h0dHBFbmRwb2ludCArIHN1ZmZpeDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiA8cD5GZXRjaCBkYXRhIGJ5IEdFVCByZXF1ZXN0IGZyb20gdGhlIHVwbGluay1zZXJ2ZXI8L3A+XHJcbiAgICAgICAgKiBAbWV0aG9kIGZldGNoXHJcbiAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgdG8gZmV0Y2hcclxuICAgICAgICAqIEByZXR1cm4ge29iamVjdH0gb2JqZWN0IEZldGNoZWQgZGF0YSBhY2NvcmRpbmcgdG8gdGhlIGtleVxyXG4gICAgICAgICovXHJcbiAgICAgICAgZmV0Y2g6IGZ1bmN0aW9uIGZldGNoKGtleSkge1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoUi5zY29wZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2RlYnVnTG9nKFwiPj4+IGZldGNoXCIsIGtleSk7XHJcbiAgICAgICAgICAgICAgICByZXF1ZXN0KHtcclxuICAgICAgICAgICAgICAgICAgICB1cmw6IHRoaXMuX2dldEZ1bGxVcmwoa2V5KSxcclxuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6IFwiR0VUXCIsXHJcbiAgICAgICAgICAgICAgICAgICAganNvbjogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICB3aXRoQ3JlZGVudGlhbHM6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24oZXJyLCByZXMsIGJvZHkpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZihlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJSLlVwbGluay5mZXRjaCguLi4pOiBjb3VsZG4ndCBmZXRjaCAnXCIgKyBrZXkgKyBcIic6XCIsIGVyci50b1N0cmluZygpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKG51bGwpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoYm9keSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0sIHRoaXMpKTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAqIDxwPkRpc3BhdGNoZXMgYW4gYWN0aW9uIGJ5IFBPU1QgcmVxdWVzdCBmcm9tIHRoZSB1cGxpbmstc2VydmVyPC9wPlxyXG4gICAgICAgICogQG1ldGhvZCBkaXNwYXRjaFxyXG4gICAgICAgICogQHBhcmFtIHtvYmplY3R9IGFjdGlvbiBUaGUgc3BlY2lmaWMgYWN0aW9uIHRvIGRpc3BhdGNoXHJcbiAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gcGFyYW1zXHJcbiAgICAgICAgKiBAcmV0dXJuIHtvYmplY3R9IG9iamVjdCBGZXRjaGVkIGRhdGEgYWNjb3JkaW5nIHRvIHRoZSBzcGVjaWZpZWQgYWN0aW9uXHJcbiAgICAgICAgKi9cclxuICAgICAgICBkaXNwYXRjaDogZnVuY3Rpb24gZGlzcGF0Y2goYWN0aW9uLCBwYXJhbXMpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKFIuc2NvcGUoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9kZWJ1Z0xvZyhcIj4+PiBkaXNwYXRjaFwiLCBhY3Rpb24sIHBhcmFtcyk7XHJcbiAgICAgICAgICAgICAgICByZXF1ZXN0KHtcclxuICAgICAgICAgICAgICAgICAgICB1cmw6IHRoaXMuX2dldEZ1bGxVcmwoYWN0aW9uKSxcclxuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIGJvZHk6IHsgZ3VpZDogdGhpcy5fZ3VpZCwgcGFyYW1zOiBwYXJhbXMgfSxcclxuICAgICAgICAgICAgICAgICAgICBqc29uOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgIHdpdGhDcmVkZW50aWFsczogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICB9LCBmdW5jdGlvbihlcnIsIHJlcywgYm9keSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoYm9keSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0sIHRoaXMpKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICogPHA+RGVzdHJveSBzb2NrZXQgY2xpZW50LXNpZGU8L3A+XHJcbiAgICAgICAgKiBAbWV0aG9kIGRlc3Ryb3lcclxuICAgICAgICAqL1xyXG4gICAgICAgIGRlc3Ryb3k6IGZ1bmN0aW9uIGRlc3Ryb3koKSB7XHJcbiAgICAgICAgICAgIGlmKFIuaXNDbGllbnQoKSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZGVzdHJveUluQ2xpZW50KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYoUi5pc1NlcnZlcigpKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9kZXN0cm95SW5TZXJ2ZXIoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICBfLmV4dGVuZChVcGxpbmssIHtcclxuICAgICAgICBTdWJzY3JpcHRpb246IGZ1bmN0aW9uIFN1YnNjcmlwdGlvbihrZXkpIHtcclxuICAgICAgICAgICAgdGhpcy5rZXkgPSBrZXk7XHJcbiAgICAgICAgICAgIHRoaXMudW5pcXVlSWQgPSBfLnVuaXF1ZUlkKFwiUi5VcGxpbmsuU3Vic2NyaXB0aW9uXCIpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgTGlzdGVuZXI6IGZ1bmN0aW9uIExpc3RlbmVyKGV2ZW50TmFtZSkge1xyXG4gICAgICAgICAgICB0aGlzLmV2ZW50TmFtZSA9IGV2ZW50TmFtZTtcclxuICAgICAgICAgICAgdGhpcy51bmlxdWVJZCA9IF8udW5pcXVlSWQoXCJSLlVwbGluay5MaXN0ZW5lclwiKTtcclxuICAgICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIFVwbGluaztcclxufTtcclxuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9