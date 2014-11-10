"use strict";

require("6to5/polyfill");
var Promise = require("bluebird");
module.exports = function (R) {
  var io = require("socket.io");
  var _ = require("lodash");
  var assert = require("assert");
  var co = require("co");
  var EventEmitter = require("events").EventEmitter;
  var bodyParser = require("body-parser");

  /**
  * <p> SimpleUplinkServer represents an uplink-server that will be able to store data via an other server.<br />
  * There also will be able to notify each client who suscribes to a data when an update will occurs thanks to socket </p>
  * <p> SimpleUplinkServer will be requested by GET or POST via R.Uplink server-side and client-side
  * @class R.SimpleUplinkServer
  */
  var SimpleUplinkServer = {
    /**
    * <p> Initializes the SimpleUplinkServer according to the specifications provided </p>
    * @method createApp
    * @param {object} specs All the specifications of the SimpleUplinkServer
    * @return {SimpleUplinkServerInstance} SimpleUplinkServerInstance The instance of the created SimpleUplinkServer
    */
    createServer: function createServer(specs) {
      R.Debug.dev(function () {
        assert(specs.store && _.isArray(specs.store), "R.SimpleUplinkServer.createServer(...).specs.store: expecting Array.");
        assert(specs.events && _.isArray(specs.events), "R.SimpleUplinkServer.createServer(...).specs.events: expecting Array.");
        assert(specs.actions && _.isPlainObject(specs.actions), "R.SimpleUplinkServer.createServer(...).specs.actions: expecting Object.");
        assert(specs.sessionCreated && _.isFunction(specs.sessionCreated), "R.SimpleUplinkServer.createServer(...).specs.sessionCreated: expecting Function.");
        assert(specs.sessionDestroyed && _.isFunction(specs.sessionDestroyed), "R.SimpleUplinkServer.createServer(...).specs.sessionDestroyed: expecting Function.");
        assert(specs.sessionTimeout && _.isNumber(specs.sessionTimeout), "R.SimpleUplinkServer.createServer(...).specs.sessionTimeout: expecting Number.");
      });
      var SimpleUplinkServerInstance = function SimpleUplinkServerInstance() {
        SimpleUplinkServer.SimpleUplinkServerInstance.call(this);
        this._specs = specs;
        this._pid = R.guid("SimpleUplinkServer");
      };
      _.extend(SimpleUplinkServerInstance.prototype, SimpleUplinkServer.SimpleUplinkServerInstance.prototype, specs);
      return SimpleUplinkServerInstance;
    },
    /**
    * <p> Setting up necessary methods for the SimpleUplinkServer </p>
    * @method SimpleUplinkServerInstance
    */
    SimpleUplinkServerInstance: function SimpleUplinkServerInstance() {
      this._store = {};
      this._hashes = {};
      this._storeRouter = new R.Router();
      this._storeRouter.def(_.constant({
        err: "Unknown store key" }));
      this._storeEvents = new EventEmitter();
      this._eventsRouter = new R.Router();
      this._eventsRouter.def(_.constant({
        err: "Unknown event name" }));
      this._eventsEvents = new EventEmitter();
      this._actionsRouter = new R.Router();
      this._actionsRouter.def(_.constant({
        err: "Unknown action" }));
      this._sessions = {};
      this._sessionsEvents = new EventEmitter();
      this._connections = {};

      this._linkSession = R.scope(this._linkSession, this);
      this._unlinkSession = R.scope(this._unlinkSession, this);
    },
    _SimpleUplinkServerInstanceProtoProps: /** @lends R.SimpleUplinkServer.SimpleUplinkServerInstance.prototype */{
      _specs: null,
      _pid: null,
      _prefix: null,
      _app: null,
      _io: null,
      _store: null,
      _storeEvents: null,
      _storeRouter: null,
      _eventsRouter: null,
      _eventsEvents: null,
      _actionsRouter: null,
      _sessions: null,
      _sessionsEvents: null,
      _connections: null,
      bootstrap: null,
      sessionCreated: null,
      sessionDestroyed: null,
      sessionTimeout: null,
      /**
      * <p>Saves data in store.
      * Called by another server that will provide data for each updated data </p>
      * @method setStore
      * @param {string} key The specified key to set
      * @param {string} val The value to save
      * @return {function} 
      */
      setStore: function setStore(key, val) {
        return R.scope(function (fn) {
          try {
            var previousVal = this._store[key] || {};
            var previousHash = this._hashes[key] || R.hash(JSON.stringify(previousVal));
            var diff = R.diff(previousVal, val);
            var hash = R.hash(JSON.stringify(val));
            this._store[key] = val;
            this._hashes[key] = hash;
            this._storeEvents.emit("set:" + key, {
              k: key,
              d: diff,
              h: previousHash });
          } catch (err) {
            return fn(R.Debug.extendError(err, "R.SimpleUplinkServer.setStore('" + key + "', '" + val + "')"));
          }
          _.defer(function () {
            fn(null, val);
          });
        }, this);
      },

      /**
      * <p> Provides data from store. <br />
      * Called when the fetching data occurs. <br />
      * Requested by GET from R.Store server-side or client-side</p>
      * @method getStore
      * @param {string} key The specified key to set
      * @return {function} 
      */
      getStore: function getStore(key) {
        return R.scope(function (fn) {
          var val;
          try {
            R.Debug.dev(R.scope(function () {
              if (!_.has(this._store, key)) {
                console.warn("R.SimpleUplinkServer(...).getStore: no such key (" + key + ")");
              }
            }, this));
            val = this._store[key];
          } catch (err) {
            return fn(R.Debug.extendError(err, "R.SimpleUplinkServer.getStore('" + key + "')"));
          }
          _.defer(function () {
            fn(null, val);
          });
        }, this);
      },
      /**
      * @method emitEvent
      * @param {string} eventName
      * @param {object} params
      */
      emitEvent: function emitEvent(eventName, params) {
        this._eventsEvents.emit("emit:" + eventName, params);
      },
      /**
      * @method emitDebug
      * @param {string} guid
      * @param {object} params
      */
      emitDebug: function emitDebug(guid, params) {
        R.Debug.dev(R.scope(function () {
          if (this._sessions[guid]) {
            this._sessions[guid].emit("debug", params);
          }
        }, this));
      },
      /**
      * @method emitLog
      * @param {string} guid
      * @param {object} params
      */
      emitLog: function emitLog(guid, params) {
        if (this._sessions[guid]) {
          this._sessions[guid].emit("log", params);
        }
      },
      /**
      * @method emitWarn
      * @param {string} guid
      * @param {object} params
      */
      emitWarn: function emitLog(guid, params) {
        if (this._sessions[guid]) {
          this._sessions[guid].emit("warn", params);
        }
      },
      /**
      * @method emitError
      * @param {string} guid
      * @param {object} params
      */
      emitError: function emitLog(guid, params) {
        if (this._sessions[guid]) {
          this._sessions[guid].emit("err", params);
        }
      },
      _extractOriginalPath: function _extractOriginalPath() {
        return arguments[arguments.length - 1];
      },
      _bindStoreRoute: function _bindStoreRoute(route) {
        this._storeRouter.route(route, this._extractOriginalPath);
      },
      _bindEventsRoute: function _bindEventsRoute(route) {
        this._eventsRouter.route(route, this._extractOriginalPath);
      },
      _bindActionsRoute: function _bindActionsRoute(handler, route) {
        this._actionsRouter.route(route, _.constant(R.scope(handler, this)));
      },
      /** 
      * <p> Setting up UplinkServer. <br />
      * - create the socket connection <br />
      * - init get and post app in order to provide data via R.Uplink.fetch</p>
      * @method installHandlers
      * @param {object} app The specified App
      * @param {string} prefix The prefix string that will be requested. Tipically "/uplink"
      */
      installHandlers: regeneratorRuntime.mark(function installHandlers(app, prefix) {
        var server;
        return regeneratorRuntime.wrap(function installHandlers$(context$2$0) {
          while (1) switch (context$2$0.prev = context$2$0.next) {case 0:

              assert(this._app === null, "R.SimpleUplinkServer.SimpleUplinkServerInstance.installHandlers(...): app already mounted.");
              this._app = app;
              this._prefix = prefix || "/uplink/";
              server = require("http").Server(app);

              this._io = io(server).of(prefix);
              this._app.get(this._prefix + "*", R.scope(this._handleHttpGet, this));
              this._app.post(this._prefix + "*", bodyParser.json(), R.scope(this._handleHttpPost, this));
              this._io.on("connection", R.scope(this._handleSocketConnection, this));
              this._handleSocketDisconnection = R.scope(this._handleSocketDisconnection, this);
              this._sessionsEvents.addListener("expire", R.scope(this._handleSessionExpire, this));
              _.each(this._specs.store, R.scope(this._bindStoreRoute, this));
              _.each(this._specs.events, R.scope(this._bindEventsRoute, this));
              _.each(this._specs.actions, R.scope(this._bindActionsRoute, this));
              this.bootstrap = R.scope(this._specs.bootstrap, this);
              context$2$0.next = 16;
              return this.bootstrap();

            case 16: return context$2$0.abrupt("return", server);
            case 17:
            case "end": return context$2$0.stop();
          }
        }, installHandlers, this);
      }),
      /**
      * <p>Return the saved data from store</p>
      * <p>Requested from R.Store server-side or client-side</p>
      * @method _handleHttpGet
      * @param {object} req The classical request
      * @param {object} res The response to send
      * @param {object} next
      * @return {string} val The computed json value
      */
      _handleHttpGet: function _handleHttpGet(req, res, next) {
        co(regeneratorRuntime.mark(function callee$2$0() {
          var path, key;
          return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
            while (1) switch (context$3$0.prev = context$3$0.next) {case 0:
                path = req.path.slice(this._prefix.length - 1);
                key = this._storeRouter.match(path);

                R.Debug.dev(function () {
                  console.warn("<<< fetch", path);
                });
                context$3$0.next = 5;
                return this.getStore(key);

              case 5: return context$3$0.abrupt("return", context$3$0.sent);
              case 6:
              case "end": return context$3$0.stop();
            }
          }, callee$2$0, this);
        })).call(this, function (err, val) {
          if (err) {
            if (R.Debug.isDev()) {
              return res.status(500).json({ err: err.toString(), stack: err.stack });
            } else {
              return res.status(500).json({ err: err.toString() });
            }
          } else {
            return res.status(200).json(val);
          }
        });
      },
      /**
      * @method _handleHttpPost
      * @param {object} req The classical request
      * @param {object} res The response to send
      * @return {string} str
      */
      _handleHttpPost: function _handleHttpPost(req, res) {
        co(regeneratorRuntime.mark(function callee$2$0() {
          var path, handler, params;
          return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
            while (1) switch (context$3$0.prev = context$3$0.next) {case 0:
                path = req.path.slice(this._prefix.length - 1);
                handler = this._actionsRouter.match(path);

                assert(_.isObject(req.body), "body: expecting Object.");
                assert(req.body.guid && _.isString(req.body.guid), "guid: expecting String.");
                assert(req.body.params && _.isPlainObject(req.body.params), "params: expecting Object.");

                if (_.has(this._sessions, req.body.guid)) {
                  context$3$0.next = 9;
                  break;
                }

                this._sessions[guid] = new R.SimpleUplinkServer.Session(guid, this._storeEvents, this._eventsEvents, this._sessionsEvents, this.sessionTimeout);
                context$3$0.next = 9;
                return this.sessionCreated(guid);

              case 9:
                params = _.extend({}, { guid: req.body.guid }, req.body.params);

                R.Debug.dev(function () {
                  console.warn("<<< action", path, params);
                });
                context$3$0.next = 13;
                return handler(params);

              case 13: return context$3$0.abrupt("return", context$3$0.sent);
              case 14:
              case "end": return context$3$0.stop();
            }
          }, callee$2$0, this);
        })).call(this, function (err, val) {
          if (err) {
            if (R.Debug.isDev()) {
              return res.status(500).json({ err: err.toString(), stack: err.stack });
            } else {
              return res.status(500).json({ err: err.toString() });
            }
          } else {
            res.status(200).json(val);
          }
        });
      },
      /** 
      * <p> Create a R.SimpleUplinkServer.Connection in order to set up handler items. <br />
      * Triggered when a socket connection is established </p>
      * @method _handleSocketConnection
      * @param {Object} socket The socket used in the connection
      */
      _handleSocketConnection: function _handleSocketConnection(socket) {
        var connection = new R.SimpleUplinkServer.Connection(this._pid, socket, this._handleSocketDisconnection, this._linkSession, this._unlinkSession);
        this._connections[connection.uniqueId] = connection;
      },

      /** 
      * <p> Destroy a R.SimpleUplinkServer.Connection. <br />
      * Triggered when a socket connection is closed </p>
      * @method _handleSocketDisconnection
      * @param {string} uniqueId The unique Id of the connection
      */
      _handleSocketDisconnection: function _handleSocketDisconnection(uniqueId) {
        var guid = this._connections[uniqueId].guid;
        if (guid && this._sessions[guid]) {
          this._sessions[guid].detachConnection();
        }
        delete this._connections[uniqueId];
      },

      /** 
      * <p>Link a Session in order to set up subscribing and unsubscribing methods uplink-server-side</p>
      * @method _linkSession
      * @param {SimpleUplinkServer.Connection} connection The created connection
      * @param {string} guid Unique string GUID
      * @return {object} the object that contains methods subscriptions/unsubscriptions
      */
      _linkSession: regeneratorRuntime.mark(function _linkSession(connection, guid) {
        return regeneratorRuntime.wrap(function _linkSession$(context$2$0) {
          while (1) switch (context$2$0.prev = context$2$0.next) {case 0:

              if (this._sessions[guid]) {
                context$2$0.next = 4;
                break;
              }

              this._sessions[guid] = new R.SimpleUplinkServer.Session(guid, this._storeEvents, this._eventsEvents, this._sessionsEvents, this.sessionTimeout);
              context$2$0.next = 4;
              return this.sessionCreated(guid);

            case 4: return context$2$0.abrupt("return", this._sessions[guid].attachConnection(connection));
            case 5:
            case "end": return context$2$0.stop();
          }
        }, _linkSession, this);
      }),

      /** 
      * <p>Unlink a Session</p>
      * @method _unlinkSession
      * @param {SimpleUplinkServer.Connection} connection 
      * @param {string} guid Unique string GUID
      * @return {Function} fn
      */
      _unlinkSession: function _unlinkSession(connection, guid) {
        return R.scope(function (fn) {
          try {
            if (this._sessions[guid]) {
              this._sessions[guid].terminate();
            }
          } catch (err) {
            return fn(R.Debug.extendError("R.SimpleUplinkServerInstance._unlinkSession(...)"));
          }
          return fn(null);
        }, this);
      },
      /** 
      * @method _handleSessionExpire
      * @param {string} guid Unique string GUID
      */
      _handleSessionExpire: function _handleSessionExpire(guid) {
        R.Debug.dev(R.scope(function () {
          assert(_.has(this._sessions, guid), "R.SimpleUplinkServer._handleSessionExpire(...): no such session.");
        }, this));
        delete this._sessions[guid];
        co(regeneratorRuntime.mark(function callee$2$0() {
          return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
            while (1) switch (context$3$0.prev = context$3$0.next) {case 0:
                context$3$0.next = 2;
                return this.sessionDestroyed(guid);

              case 2:
              case "end": return context$3$0.stop();
            }
          }, callee$2$0, this);
        })).call(this, R.Debug.rethrow("R.SimpleUplinkServer._handleSessionExpire(...)"));
      } },
    /** 
    * <p>Setting up a connection in order to initialies methods and to provides specifics listeners on the socket</p>
    * @method Connection
    * @param {object} pid 
    * @param {object} socket
    * @param {object} handleSocketDisconnection
    * @param {object} linkSession 
    * @param {object} unlinkSession
    */
    Connection: function Connection(pid, socket, handleSocketDisconnection, linkSession, unlinkSession) {
      this._pid = pid;
      this.uniqueId = _.uniqueId("R.SimpleUplinkServer.Connection");
      this._socket = socket;
      this._handleSocketDisconnection = handleSocketDisconnection;
      this._linkSession = linkSession;
      this._unlinkSession = unlinkSession;
      this._bindHandlers();
    },
    _ConnectionProtoProps: /** @lends R.SimpleUplinkServer.Connection.prototype */{
      _socket: null,
      _pid: null,
      uniqueId: null,
      guid: null,
      _handleSocketDisconnection: null,
      _linkSession: null,
      _unlinkSession: null,
      _subscribeTo: null,
      _unsubscribeFrom: null,
      _listenTo: null,
      _unlistenFrom: null,
      _disconnected: null,
      /** 
      * <p>Setting up the specifics listeners for the socket</p>
      * @method _bindHandlers
      */
      _bindHandlers: function _bindHandlers() {
        this._socket.on("handshake", R.scope(this._handleHandshake, this));
        this._socket.on("subscribeTo", R.scope(this._handleSubscribeTo, this));
        this._socket.on("unsubscribeFrom", R.scope(this._handleUnsubscribeFrom, this));
        this._socket.on("listenTo", R.scope(this._handleListenTo, this));
        this._socket.on("unlistenFrom", R.scope(this._handleUnlistenFrom, this));
        this._socket.on("disconnect", R.scope(this._handleDisconnect, this));
        this._socket.on("unhandshake", R.scope(this._handleUnHandshake, this));
      },
      /**
      * <p> Simply emit a specific action on the socket </p>
      * @method emit
      * @param {string} name The name of the action to send
      * @param {object} params The params 
      */
      emit: function emit(name, params) {
        R.Debug.dev(function () {
          console.warn("[C] >>> " + name, params);
        });
        this._socket.emit(name, params);
      },
      /**
      * <p> Triggered by the recently connected client. <br />
      * Combines methods of subscriptions that will be triggered by the client via socket listening</p>
      * @method _handleHandshake
      * @param {String} params Contains the unique string GUID
      */
      _handleHandshake: function _handleHandshake(params) {
        if (!_.has(params, "guid") || !_.isString(params.guid)) {
          this.emit("err", { err: "handshake.params.guid: expected String." });
        } else if (this.guid) {
          this.emit("err", { err: "handshake: session already linked." });
        } else {
          co(regeneratorRuntime.mark(function callee$2$0() {
            var s;
            return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
              while (1) switch (context$3$0.prev = context$3$0.next) {case 0:

                  this.guid = params.guid;
                  context$3$0.next = 3;
                  return this._linkSession(this, this.guid);

                case 3:
                  s = context$3$0.sent;

                  this.emit("handshake-ack", {
                    pid: this._pid,
                    recovered: s.recovered });
                  this._subscribeTo = s.subscribeTo;
                  this._unsubscribeFrom = s.unsubscribeFrom;
                  this._listenTo = s.listenTo;
                  this._unlistenFrom = s.unlistenFrom;

                case 9:
                case "end": return context$3$0.stop();
              }
            }, callee$2$0, this);
          })).call(this, R.Debug.rethrow("R.SimpleUplinkServer.Connection._handleHandshake(...)"));
        }
      },
      /**
      * <p> Triggered by the recently disconnected client. <br />
      * Removes methods of subscriptions</p>
      * @method _handleHandshake
      */
      _handleUnHandshake: function _handleUnHandshake() {
        if (!this.guid) {
          this.emit("err", { err: "unhandshake: no active session." });
        } else {
          co(regeneratorRuntime.mark(function callee$2$0() {
            var s;
            return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
              while (1) switch (context$3$0.prev = context$3$0.next) {case 0:

                  this._subscribeTo = null;
                  this._unsubscribeFrom = null;
                  this._listenTo = null;
                  this._unlistenFrom = null;
                  context$3$0.next = 6;
                  return this._unlinkSession(this, this.guid);

                case 6:
                  s = context$3$0.sent;

                  this.emit("unhandshake-ack");
                  this.guid = null;

                case 9:
                case "end": return context$3$0.stop();
              }
            }, callee$2$0, this);
          })).call(this, R.Debug.rethrow("R.SimpleUplinkServer.Connection._handleUnHandshake(...)"));
        }
      },
      /** 
      * <p>Maps the triggered event with the _subscribeTo methods </p>
      * @method _handleSubscribeTo
      * @param {object} params Contains the key provided by client
      */
      _handleSubscribeTo: function _handleSubscribeTo(params) {
        if (!_.has(params, "key") || !_.isString(params.key)) {
          this.emit("err", { err: "subscribeTo.params.key: expected String." });
        } else if (!this._subscribeTo) {
          this.emit("err", { err: "subscribeTo: requires handshake." });
        } else {
          this._subscribeTo(params.key);
        }
      },
      /** 
      * <p>Maps the triggered event with the _unsubscribeFrom methods</p>
      * @method _handleUnsubscribeFrom
      * @param {object} params Contains the key provided by client
      */
      _handleUnsubscribeFrom: function _handleUnsubscribeFrom(params) {
        if (!_.has(params, "key") || !_.isString(params.key)) {
          this.emit("err", { err: "unsubscribeFrom.params.key: expected String." });
        } else if (!this._unsubscribeFrom) {
          this.emit("err", { err: "unsubscribeFrom: requires handshake." });
        } else {
          this._unsubscribeFrom(params.key);
        }
      },
      /** 
      * <p>Maps the triggered event with the listenTo methods</p>
      * @method _handleListenTo
      * @param {object} params Contains the eventName provided by client
      */
      _handleListenTo: function _handleListenTo(params) {
        if (!_.has(params, "eventName") || !_.isString(params.eventName)) {
          this.emit("err", { err: "listenTo.params.eventName: expected String." });
        } else if (!this._listenTo) {
          this.emit("err", { err: "listenTo: requires handshake." });
        } else {
          this.listenTo(params.eventName);
        }
      },
      /** 
      * <p>Maps the triggered event with the unlistenFrom methods</p>
      * @method _handleUnlistenFrom
      * @param {object} params Contains the eventName provided by client
      */
      _handleUnlistenFrom: function _handleUnlistenFrom(params) {
        if (!_.has(params, "eventName") || !_.isString(params.eventName)) {
          this.emit("err", { err: "unlistenFrom.params.eventName: expected String." });
        } else if (!this.unlistenFrom) {
          this._emit("err", { err: "unlistenFrom: requires handshake." });
        } else {
          this.unlistenFrom(params.eventName);
        }
      },
      /** 
      * <p>Triggered by the recently disconnected client.</p>
      * @method _handleDisconnect
      */
      _handleDisconnect: function _handleDisconnect() {
        this._handleSocketDisconnection(this.uniqueId, false);
      } },
    /** 
    * <p>Setting up a session</p>
    * @method Session
    * @param {object} pid 
    * @param {object} storeEvents
    * @param {object} eventsEvents
    * @param {object} sessionsEvents 
    * @param {object} timeout
    */
    Session: function Session(guid, storeEvents, eventsEvents, sessionsEvents, timeout) {
      this._guid = guid;
      this._storeEvents = storeEvents;
      this._eventsEvents = eventsEvents;
      this._sessionsEvents = sessionsEvents;
      this._messageQueue = [];
      this._timeoutDuration = timeout;
      this._expire = R.scope(this._expire, this);
      this._expireTimeout = setTimeout(this._expire, this._timeoutDuration);
      this._subscriptions = {};
      this._listeners = {};
    },
    _SessionProtoProps: /** @lends R.SimpleUplinkServer.Session.prototype */{
      _guid: null,
      _connection: null,
      _subscriptions: null,
      _listeners: null,
      _storeEvents: null,
      _eventsEvents: null,
      _sessionsEvents: null,
      _messageQueue: null,
      _expireTimeout: null,
      _timeoutDuration: null,
      /**
      * <p>Bind the subscribing and unsubscribing methods when a connection is established <br />
      * Methods that trigger on client issues (like emit("subscribeTo"), emit("unsubscribeFrom"))</p>
      * @method attachConnection
      * @param {SimpleUplinkServer.Connection} connection the current created connection
      * @return {object} the binded object with methods
      */
      attachConnection: function attachConnection(connection) {
        var recovered = (this._connection !== null);
        this.detachConnection();
        this._connection = connection;
        _.each(this._messageQueue, function (m) {
          connection.emit(m.name, m.params);
        });
        this._messageQueue = null;
        clearTimeout(this._expireTimeout);
        return {
          recovered: recovered,
          subscribeTo: R.scope(this.subscribeTo, this),
          unsubscribeFrom: R.scope(this.unsubscribeFrom, this),
          listenTo: R.scope(this.listenTo, this),
          unlistenFrom: R.scope(this.unlistenFrom, this) };
      },
      /**
      * <p>Remove the previously added connection, and clean the message queue </p>
      * @method detachConnection
      */
      detachConnection: function detachConnection() {
        if (this._connection === null) {
          return;
        } else {
          this._connection = null;
          this._messageQueue = [];
          this._expireTimeout = setTimeout(this._expire, this._timeoutDuration);
        }
      },
      /**
      * @method terminate
      */
      terminate: function terminate() {
        this._expire();
      },
      /** 
      * <p>Method invoked by client via socket emit <br />
      * Store the _signalUpdate method in subscription <br />
      * Add a listener that will call _signalUpdate when triggered </p>
      * @method subscribeTo
      * @param {string} key The key to subscribe
      */
      subscribeTo: function subscribeTo(key) {
        R.Debug.dev(R.scope(function () {
          assert(!_.has(this._subscriptions, key), "R.SimpleUplinkServer.Session.subscribeTo(...): already subscribed.");
        }, this));
        this._subscriptions[key] = this._signalUpdate();
        this._storeEvents.addListener("set:" + key, this._subscriptions[key]);
      },

      /** 
      * <p>Method invoked by client via socket emit <br />
      * Remove a listener according to the key</p>
      * @method subscribeTo
      * @param {string} key The key to unsubscribe
      */
      unsubscribeFrom: function unsubscribeFrom(key) {
        R.Debug.dev(R.scope(function () {
          assert(_.has(this._subscriptions, key), "R.SimpleUplinkServer.Session.unsubscribeFrom(...): not subscribed.");
        }, this));
        this._storeEvents.removeListener("set:" + key, this._subscriptions[key]);
        delete this._subscriptions[key];
      },
      /**
      * <p> Simply emit a specific action on the socket </p>
      * @method _emit
      * @param {string} name The name of the action to send
      * @param {object} params The params 
      */
      _emit: function _emit(name, params) {
        R.Debug.dev(function () {
          console.warn("[S] >>> " + name, params);
        });
        if (this._connection !== null) {
          this._connection.emit(name, params);
        } else {
          this._messageQueue.push({
            name: name,
            params: params });
        }
      },
      /** <p>Push an update action on the socket. <br />
      * The client is listening on the action "update" socket </p>
      * @method _signalUpdate
      */
      _signalUpdate: function _signalUpdate() {
        return R.scope(function (patch) {
          this._emit("update", patch);
        }, this);
      },
      /** <p>Push an event action on the socket. <br />
      * The client is listening on the action "event" socket </p>
      * @method _signalEvent
      */
      _signalEvent: function _signalEvent(eventName) {
        return R.scope(function (params) {
          this._emit("event", { eventName: eventName, params: params });
        }, this);
      },
      /**
      * @method _expire
      */
      _expire: function _expire() {
        _.each(_.keys(this._subscriptions), R.scope(this.unsubscribeFrom, this));
        _.each(_.keys(this._listeners), R.scope(this.unlistenFrom, this));
        this._sessionsEvents.emit("expire", this._guid);
      },
      /**
      * <p> Create a listener for the events </p>
      * @method listenTo
      * @param {string} eventName The name of the event that will be registered
      */
      listenTo: function listenTo(eventName) {
        R.Debug.dev(R.scope(function () {
          assert(!_.has(this._listeners, key), "R.SimpleUplinkServer.Session.listenTo(...): already listening.");
        }, this));
        this._listeners[eventName] = this._signalEvent(eventName);
        this._eventsEvents.addListener("emit:" + eventName, this._listeners[eventName]);
      },
      /**
      * <p> Remove a listener from the events </p>
      * @method unlistenFrom
      * @param {string} eventName The name of the event that will be unregistered
      */
      unlistenFrom: function unlistenFrom(eventName) {
        R.Debug.dev(R.scope(function () {
          assert(_.has(this._listeners, eventName), "R.SimpleUplinkServer.Session.unlistenFrom(...): not listening.");
        }, this));
        this._eventsEvents.removeListener("emit:" + eventName, this._listeners[eventName]);
        delete this._listeners[eventName];
      } } };

  _.extend(SimpleUplinkServer.SimpleUplinkServerInstance.prototype, SimpleUplinkServer._SimpleUplinkServerInstanceProtoProps);
  _.extend(SimpleUplinkServer.Connection.prototype, SimpleUplinkServer._ConnectionProtoProps);
  _.extend(SimpleUplinkServer.Session.prototype, SimpleUplinkServer._SessionProtoProps);

  return SimpleUplinkServer;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImQ6L3dvcmtzcGFjZV9yZWZhY3Rvci9yZWFjdC1yYWlscy9zcmMvUi5TaW1wbGVVcGxpbmtTZXJ2ZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7QUFDekIsSUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ3BDLE1BQU0sQ0FBQyxPQUFPLEdBQUcsVUFBUyxDQUFDLEVBQUU7QUFDekIsTUFBSSxFQUFFLEdBQUcsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQzlCLE1BQUksQ0FBQyxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUMxQixNQUFJLE1BQU0sR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDL0IsTUFBSSxFQUFFLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3ZCLE1BQUksWUFBWSxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxZQUFZLENBQUM7QUFDbEQsTUFBSSxVQUFVLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDOzs7Ozs7OztBQVF4QyxNQUFJLGtCQUFrQixHQUFHOzs7Ozs7O0FBT3JCLGdCQUFZLEVBQUUsU0FBUyxZQUFZLENBQUMsS0FBSyxFQUFFO0FBQ3ZDLE9BQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFlBQVc7QUFDbkIsY0FBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEVBQUUsc0VBQXNFLENBQUMsQ0FBQztBQUN0SCxjQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSx1RUFBdUUsQ0FBQyxDQUFDO0FBQ3pILGNBQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLE9B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QyxrQkFBa0IsQ0FBQyxDQUFDOztBQUV0RixTQUFPLGtCQUFrQixDQUFDO0NBQzdCLENBQUMiLCJmaWxlIjoiUi5TaW1wbGVVcGxpbmtTZXJ2ZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJyZXF1aXJlKCc2dG81L3BvbHlmaWxsJyk7XG5jb25zdCBQcm9taXNlID0gcmVxdWlyZSgnYmx1ZWJpcmQnKTtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oUikge1xyXG4gICAgdmFyIGlvID0gcmVxdWlyZShcInNvY2tldC5pb1wiKTtcclxuICAgIHZhciBfID0gcmVxdWlyZShcImxvZGFzaFwiKTtcclxuICAgIHZhciBhc3NlcnQgPSByZXF1aXJlKFwiYXNzZXJ0XCIpO1xyXG4gICAgdmFyIGNvID0gcmVxdWlyZShcImNvXCIpO1xyXG4gICAgdmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoXCJldmVudHNcIikuRXZlbnRFbWl0dGVyO1xyXG4gICAgdmFyIGJvZHlQYXJzZXIgPSByZXF1aXJlKFwiYm9keS1wYXJzZXJcIik7XHJcblxyXG4gICAgLyoqXHJcbiAgICAqIDxwPiBTaW1wbGVVcGxpbmtTZXJ2ZXIgcmVwcmVzZW50cyBhbiB1cGxpbmstc2VydmVyIHRoYXQgd2lsbCBiZSBhYmxlIHRvIHN0b3JlIGRhdGEgdmlhIGFuIG90aGVyIHNlcnZlci48YnIgLz5cclxuICAgICogVGhlcmUgYWxzbyB3aWxsIGJlIGFibGUgdG8gbm90aWZ5IGVhY2ggY2xpZW50IHdobyBzdXNjcmliZXMgdG8gYSBkYXRhIHdoZW4gYW4gdXBkYXRlIHdpbGwgb2NjdXJzIHRoYW5rcyB0byBzb2NrZXQgPC9wPlxyXG4gICAgKiA8cD4gU2ltcGxlVXBsaW5rU2VydmVyIHdpbGwgYmUgcmVxdWVzdGVkIGJ5IEdFVCBvciBQT1NUIHZpYSBSLlVwbGluayBzZXJ2ZXItc2lkZSBhbmQgY2xpZW50LXNpZGVcclxuICAgICogQGNsYXNzIFIuU2ltcGxlVXBsaW5rU2VydmVyXHJcbiAgICAqL1xyXG4gICAgdmFyIFNpbXBsZVVwbGlua1NlcnZlciA9IHtcclxuICAgICAgICAvKipcclxuICAgICAgICAqIDxwPiBJbml0aWFsaXplcyB0aGUgU2ltcGxlVXBsaW5rU2VydmVyIGFjY29yZGluZyB0byB0aGUgc3BlY2lmaWNhdGlvbnMgcHJvdmlkZWQgPC9wPlxyXG4gICAgICAgICogQG1ldGhvZCBjcmVhdGVBcHBcclxuICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBzcGVjcyBBbGwgdGhlIHNwZWNpZmljYXRpb25zIG9mIHRoZSBTaW1wbGVVcGxpbmtTZXJ2ZXJcclxuICAgICAgICAqIEByZXR1cm4ge1NpbXBsZVVwbGlua1NlcnZlckluc3RhbmNlfSBTaW1wbGVVcGxpbmtTZXJ2ZXJJbnN0YW5jZSBUaGUgaW5zdGFuY2Ugb2YgdGhlIGNyZWF0ZWQgU2ltcGxlVXBsaW5rU2VydmVyXHJcbiAgICAgICAgKi9cclxuICAgICAgICBjcmVhdGVTZXJ2ZXI6IGZ1bmN0aW9uIGNyZWF0ZVNlcnZlcihzcGVjcykge1xyXG4gICAgICAgICAgICBSLkRlYnVnLmRldihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIGFzc2VydChzcGVjcy5zdG9yZSAmJiBfLmlzQXJyYXkoc3BlY3Muc3RvcmUpLCBcIlIuU2ltcGxlVXBsaW5rU2VydmVyLmNyZWF0ZVNlcnZlciguLi4pLnNwZWNzLnN0b3JlOiBleHBlY3RpbmcgQXJyYXkuXCIpO1xyXG4gICAgICAgICAgICAgICAgYXNzZXJ0KHNwZWNzLmV2ZW50cyAmJiBfLmlzQXJyYXkoc3BlY3MuZXZlbnRzKSwgXCJSLlNpbXBsZVVwbGlua1NlcnZlci5jcmVhdGVTZXJ2ZXIoLi4uKS5zcGVjcy5ldmVudHM6IGV4cGVjdGluZyBBcnJheS5cIik7XHJcbiAgICAgICAgICAgICAgICBhc3NlcnQoc3BlY3MuYWN0aW9ucyAmJiBfLmlzUGxhaW5PYmplY3Qoc3BlY3MuYWN0aW9ucyksIFwiUi5TaW1wbGVVcGxpbmtTZXJ2ZXIuY3JlYXRlU2VydmVyKC4uLikuc3BlY3MuYWN0aW9uczogZXhwZWN0aW5nIE9iamVjdC5cIik7XHJcbiAgICAgICAgICAgICAgICBhc3NlcnQoc3BlY3Muc2Vzc2lvbkNyZWF0ZWQgJiYgXy5pc0Z1bmN0aW9uKHNwZWNzLnNlc3Npb25DcmVhdGVkKSwgXCJSLlNpbXBsZVVwbGlua1NlcnZlci5jcmVhdGVTZXJ2ZXIoLi4uKS5zcGVjcy5zZXNzaW9uQ3JlYXRlZDogZXhwZWN0aW5nIEZ1bmN0aW9uLlwiKTtcclxuICAgICAgICAgICAgICAgIGFzc2VydChzcGVjcy5zZXNzaW9uRGVzdHJveWVkICYmIF8uaXNGdW5jdGlvbihzcGVjcy5zZXNzaW9uRGVzdHJveWVkKSwgXCJSLlNpbXBsZVVwbGlua1NlcnZlci5jcmVhdGVTZXJ2ZXIoLi4uKS5zcGVjcy5zZXNzaW9uRGVzdHJveWVkOiBleHBlY3RpbmcgRnVuY3Rpb24uXCIpO1xyXG4gICAgICAgICAgICAgICAgYXNzZXJ0KHNwZWNzLnNlc3Npb25UaW1lb3V0ICYmIF8uaXNOdW1iZXIoc3BlY3Muc2Vzc2lvblRpbWVvdXQpLCBcIlIuU2ltcGxlVXBsaW5rU2VydmVyLmNyZWF0ZVNlcnZlciguLi4pLnNwZWNzLnNlc3Npb25UaW1lb3V0OiBleHBlY3RpbmcgTnVtYmVyLlwiKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHZhciBTaW1wbGVVcGxpbmtTZXJ2ZXJJbnN0YW5jZSA9IGZ1bmN0aW9uIFNpbXBsZVVwbGlua1NlcnZlckluc3RhbmNlKCkge1xyXG4gICAgICAgICAgICAgICAgU2ltcGxlVXBsaW5rU2VydmVyLlNpbXBsZVVwbGlua1NlcnZlckluc3RhbmNlLmNhbGwodGhpcyk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9zcGVjcyA9IHNwZWNzO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fcGlkID0gUi5ndWlkKFwiU2ltcGxlVXBsaW5rU2VydmVyXCIpO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBfLmV4dGVuZChTaW1wbGVVcGxpbmtTZXJ2ZXJJbnN0YW5jZS5wcm90b3R5cGUsIFNpbXBsZVVwbGlua1NlcnZlci5TaW1wbGVVcGxpbmtTZXJ2ZXJJbnN0YW5jZS5wcm90b3R5cGUsIHNwZWNzKTtcclxuICAgICAgICAgICAgcmV0dXJuIFNpbXBsZVVwbGlua1NlcnZlckluc3RhbmNlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiA8cD4gU2V0dGluZyB1cCBuZWNlc3NhcnkgbWV0aG9kcyBmb3IgdGhlIFNpbXBsZVVwbGlua1NlcnZlciA8L3A+XHJcbiAgICAgICAgKiBAbWV0aG9kIFNpbXBsZVVwbGlua1NlcnZlckluc3RhbmNlXHJcbiAgICAgICAgKi9cclxuICAgICAgICBTaW1wbGVVcGxpbmtTZXJ2ZXJJbnN0YW5jZTogZnVuY3Rpb24gU2ltcGxlVXBsaW5rU2VydmVySW5zdGFuY2UoKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N0b3JlID0ge307XHJcbiAgICAgICAgICAgIHRoaXMuX2hhc2hlcyA9IHt9O1xyXG4gICAgICAgICAgICB0aGlzLl9zdG9yZVJvdXRlciA9IG5ldyBSLlJvdXRlcigpO1xyXG4gICAgICAgICAgICB0aGlzLl9zdG9yZVJvdXRlci5kZWYoXy5jb25zdGFudCh7XHJcbiAgICAgICAgICAgICAgICBlcnI6IFwiVW5rbm93biBzdG9yZSBrZXlcIixcclxuICAgICAgICAgICAgfSkpO1xyXG4gICAgICAgICAgICB0aGlzLl9zdG9yZUV2ZW50cyA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcclxuICAgICAgICAgICAgdGhpcy5fZXZlbnRzUm91dGVyID0gbmV3IFIuUm91dGVyKCk7XHJcbiAgICAgICAgICAgIHRoaXMuX2V2ZW50c1JvdXRlci5kZWYoXy5jb25zdGFudCh7XHJcbiAgICAgICAgICAgICAgICBlcnI6IFwiVW5rbm93biBldmVudCBuYW1lXCIsXHJcbiAgICAgICAgICAgIH0pKTtcclxuICAgICAgICAgICAgdGhpcy5fZXZlbnRzRXZlbnRzID0gbmV3IEV2ZW50RW1pdHRlcigpO1xyXG4gICAgICAgICAgICB0aGlzLl9hY3Rpb25zUm91dGVyID0gbmV3IFIuUm91dGVyKCk7XHJcbiAgICAgICAgICAgIHRoaXMuX2FjdGlvbnNSb3V0ZXIuZGVmKF8uY29uc3RhbnQoe1xyXG4gICAgICAgICAgICAgICAgZXJyOiBcIlVua25vd24gYWN0aW9uXCIsXHJcbiAgICAgICAgICAgIH0pKTtcclxuICAgICAgICAgICAgdGhpcy5fc2Vzc2lvbnMgPSB7fTtcclxuICAgICAgICAgICAgdGhpcy5fc2Vzc2lvbnNFdmVudHMgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XHJcbiAgICAgICAgICAgIHRoaXMuX2Nvbm5lY3Rpb25zID0ge307XHJcblxyXG4gICAgICAgICAgICB0aGlzLl9saW5rU2Vzc2lvbiA9IFIuc2NvcGUodGhpcy5fbGlua1Nlc3Npb24sIHRoaXMpO1xyXG4gICAgICAgICAgICB0aGlzLl91bmxpbmtTZXNzaW9uID0gUi5zY29wZSh0aGlzLl91bmxpbmtTZXNzaW9uLCB0aGlzKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIF9TaW1wbGVVcGxpbmtTZXJ2ZXJJbnN0YW5jZVByb3RvUHJvcHM6IC8qKiBAbGVuZHMgUi5TaW1wbGVVcGxpbmtTZXJ2ZXIuU2ltcGxlVXBsaW5rU2VydmVySW5zdGFuY2UucHJvdG90eXBlICove1xyXG4gICAgICAgICAgICBfc3BlY3M6IG51bGwsXHJcbiAgICAgICAgICAgIF9waWQ6IG51bGwsXHJcbiAgICAgICAgICAgIF9wcmVmaXg6IG51bGwsXHJcbiAgICAgICAgICAgIF9hcHA6IG51bGwsXHJcbiAgICAgICAgICAgIF9pbzogbnVsbCxcclxuICAgICAgICAgICAgX3N0b3JlOiBudWxsLFxyXG4gICAgICAgICAgICBfc3RvcmVFdmVudHM6IG51bGwsXHJcbiAgICAgICAgICAgIF9zdG9yZVJvdXRlcjogbnVsbCxcclxuICAgICAgICAgICAgX2V2ZW50c1JvdXRlcjogbnVsbCxcclxuICAgICAgICAgICAgX2V2ZW50c0V2ZW50czogbnVsbCxcclxuICAgICAgICAgICAgX2FjdGlvbnNSb3V0ZXI6IG51bGwsXHJcbiAgICAgICAgICAgIF9zZXNzaW9uczogbnVsbCxcclxuICAgICAgICAgICAgX3Nlc3Npb25zRXZlbnRzOiBudWxsLFxyXG4gICAgICAgICAgICBfY29ubmVjdGlvbnM6IG51bGwsXHJcbiAgICAgICAgICAgIGJvb3RzdHJhcDogbnVsbCxcclxuICAgICAgICAgICAgc2Vzc2lvbkNyZWF0ZWQ6IG51bGwsXHJcbiAgICAgICAgICAgIHNlc3Npb25EZXN0cm95ZWQ6IG51bGwsXHJcbiAgICAgICAgICAgIHNlc3Npb25UaW1lb3V0OiBudWxsLFxyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgKiA8cD5TYXZlcyBkYXRhIGluIHN0b3JlLlxyXG4gICAgICAgICAgICAqIENhbGxlZCBieSBhbm90aGVyIHNlcnZlciB0aGF0IHdpbGwgcHJvdmlkZSBkYXRhIGZvciBlYWNoIHVwZGF0ZWQgZGF0YSA8L3A+XHJcbiAgICAgICAgICAgICogQG1ldGhvZCBzZXRTdG9yZVxyXG4gICAgICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIHNwZWNpZmllZCBrZXkgdG8gc2V0XHJcbiAgICAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IHZhbCBUaGUgdmFsdWUgdG8gc2F2ZVxyXG4gICAgICAgICAgICAqIEByZXR1cm4ge2Z1bmN0aW9ufSBcclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgc2V0U3RvcmU6IGZ1bmN0aW9uIHNldFN0b3JlKGtleSwgdmFsKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gUi5zY29wZShmdW5jdGlvbihmbikge1xyXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBwcmV2aW91c1ZhbCA9IHRoaXMuX3N0b3JlW2tleV0gfHwge307XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBwcmV2aW91c0hhc2ggPSB0aGlzLl9oYXNoZXNba2V5XSB8fCBSLmhhc2goSlNPTi5zdHJpbmdpZnkocHJldmlvdXNWYWwpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGRpZmYgPSBSLmRpZmYocHJldmlvdXNWYWwsIHZhbCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBoYXNoID0gUi5oYXNoKEpTT04uc3RyaW5naWZ5KHZhbCkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zdG9yZVtrZXldID0gdmFsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9oYXNoZXNba2V5XSA9IGhhc2g7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3N0b3JlRXZlbnRzLmVtaXQoXCJzZXQ6XCIgKyBrZXksIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGs6IGtleSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGQ6IGRpZmYsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoOiBwcmV2aW91c0hhc2gsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBjYXRjaChlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZuKFIuRGVidWcuZXh0ZW5kRXJyb3IoZXJyLCBcIlIuU2ltcGxlVXBsaW5rU2VydmVyLnNldFN0b3JlKCdcIiArIGtleSArIFwiJywgJ1wiICsgdmFsICsgXCInKVwiKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIF8uZGVmZXIoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZuKG51bGwsIHZhbCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9LCB0aGlzKTtcclxuICAgICAgICAgICAgfSxcclxuXHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAqIDxwPiBQcm92aWRlcyBkYXRhIGZyb20gc3RvcmUuIDxiciAvPlxyXG4gICAgICAgICAgICAqIENhbGxlZCB3aGVuIHRoZSBmZXRjaGluZyBkYXRhIG9jY3Vycy4gPGJyIC8+XHJcbiAgICAgICAgICAgICogUmVxdWVzdGVkIGJ5IEdFVCBmcm9tIFIuU3RvcmUgc2VydmVyLXNpZGUgb3IgY2xpZW50LXNpZGU8L3A+XHJcbiAgICAgICAgICAgICogQG1ldGhvZCBnZXRTdG9yZVxyXG4gICAgICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIHNwZWNpZmllZCBrZXkgdG8gc2V0XHJcbiAgICAgICAgICAgICogQHJldHVybiB7ZnVuY3Rpb259IFxyXG4gICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBnZXRTdG9yZTogZnVuY3Rpb24gZ2V0U3RvcmUoa2V5KSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gUi5zY29wZShmdW5jdGlvbihmbikge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB2YWw7XHJcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoUi5zY29wZShmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKCFfLmhhcyh0aGlzLl9zdG9yZSwga2V5KSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIlIuU2ltcGxlVXBsaW5rU2VydmVyKC4uLikuZ2V0U3RvcmU6IG5vIHN1Y2gga2V5IChcIiArIGtleSArIFwiKVwiKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSwgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWwgPSB0aGlzLl9zdG9yZVtrZXldO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBjYXRjaChlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZuKFIuRGVidWcuZXh0ZW5kRXJyb3IoZXJyLCBcIlIuU2ltcGxlVXBsaW5rU2VydmVyLmdldFN0b3JlKCdcIiArIGtleSArIFwiJylcIikpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBfLmRlZmVyKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmbihudWxsLCB2YWwpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSwgdGhpcyk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAqIEBtZXRob2QgZW1pdEV2ZW50XHJcbiAgICAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50TmFtZVxyXG4gICAgICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBwYXJhbXNcclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgZW1pdEV2ZW50OiBmdW5jdGlvbiBlbWl0RXZlbnQoZXZlbnROYW1lLCBwYXJhbXMpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c0V2ZW50cy5lbWl0KFwiZW1pdDpcIiArIGV2ZW50TmFtZSwgcGFyYW1zKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICogQG1ldGhvZCBlbWl0RGVidWdcclxuICAgICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gZ3VpZFxyXG4gICAgICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBwYXJhbXNcclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgZW1pdERlYnVnOiBmdW5jdGlvbiBlbWl0RGVidWcoZ3VpZCwgcGFyYW1zKSB7XHJcbiAgICAgICAgICAgICAgICBSLkRlYnVnLmRldihSLnNjb3BlKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKHRoaXMuX3Nlc3Npb25zW2d1aWRdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3Nlc3Npb25zW2d1aWRdLmVtaXQoXCJkZWJ1Z1wiLCBwYXJhbXMpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sIHRoaXMpKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICogQG1ldGhvZCBlbWl0TG9nXHJcbiAgICAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGd1aWRcclxuICAgICAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gcGFyYW1zXHJcbiAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIGVtaXRMb2c6IGZ1bmN0aW9uIGVtaXRMb2coZ3VpZCwgcGFyYW1zKSB7XHJcbiAgICAgICAgICAgICAgICBpZih0aGlzLl9zZXNzaW9uc1tndWlkXSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3Nlc3Npb25zW2d1aWRdLmVtaXQoXCJsb2dcIiwgcGFyYW1zKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICogQG1ldGhvZCBlbWl0V2FyblxyXG4gICAgICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBndWlkXHJcbiAgICAgICAgICAgICogQHBhcmFtIHtvYmplY3R9IHBhcmFtc1xyXG4gICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBlbWl0V2FybjogZnVuY3Rpb24gZW1pdExvZyhndWlkLCBwYXJhbXMpIHtcclxuICAgICAgICAgICAgICAgIGlmKHRoaXMuX3Nlc3Npb25zW2d1aWRdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2Vzc2lvbnNbZ3VpZF0uZW1pdChcIndhcm5cIiwgcGFyYW1zKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICogQG1ldGhvZCBlbWl0RXJyb3JcclxuICAgICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gZ3VpZFxyXG4gICAgICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBwYXJhbXNcclxuICAgICAgICAgICAgKi8gICAgICAgICAgICBcclxuICAgICAgICAgICAgZW1pdEVycm9yOiBmdW5jdGlvbiBlbWl0TG9nKGd1aWQsIHBhcmFtcykge1xyXG4gICAgICAgICAgICAgICAgaWYodGhpcy5fc2Vzc2lvbnNbZ3VpZF0pIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXNzaW9uc1tndWlkXS5lbWl0KFwiZXJyXCIsIHBhcmFtcyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIF9leHRyYWN0T3JpZ2luYWxQYXRoOiBmdW5jdGlvbiBfZXh0cmFjdE9yaWdpbmFsUGF0aCgpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBhcmd1bWVudHNbYXJndW1lbnRzLmxlbmd0aCAtIDFdO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBfYmluZFN0b3JlUm91dGU6IGZ1bmN0aW9uIF9iaW5kU3RvcmVSb3V0ZShyb3V0ZSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fc3RvcmVSb3V0ZXIucm91dGUocm91dGUsIHRoaXMuX2V4dHJhY3RPcmlnaW5hbFBhdGgpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBfYmluZEV2ZW50c1JvdXRlOiBmdW5jdGlvbiBfYmluZEV2ZW50c1JvdXRlKHJvdXRlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNSb3V0ZXIucm91dGUocm91dGUsIHRoaXMuX2V4dHJhY3RPcmlnaW5hbFBhdGgpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBfYmluZEFjdGlvbnNSb3V0ZTogZnVuY3Rpb24gX2JpbmRBY3Rpb25zUm91dGUoaGFuZGxlciwgcm91dGUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2FjdGlvbnNSb3V0ZXIucm91dGUocm91dGUsIF8uY29uc3RhbnQoUi5zY29wZShoYW5kbGVyLCB0aGlzKSkpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAvKiogXHJcbiAgICAgICAgICAgICogPHA+IFNldHRpbmcgdXAgVXBsaW5rU2VydmVyLiA8YnIgLz5cclxuICAgICAgICAgICAgKiAtIGNyZWF0ZSB0aGUgc29ja2V0IGNvbm5lY3Rpb24gPGJyIC8+XHJcbiAgICAgICAgICAgICogLSBpbml0IGdldCBhbmQgcG9zdCBhcHAgaW4gb3JkZXIgdG8gcHJvdmlkZSBkYXRhIHZpYSBSLlVwbGluay5mZXRjaDwvcD5cclxuICAgICAgICAgICAgKiBAbWV0aG9kIGluc3RhbGxIYW5kbGVyc1xyXG4gICAgICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBhcHAgVGhlIHNwZWNpZmllZCBBcHBcclxuICAgICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gcHJlZml4IFRoZSBwcmVmaXggc3RyaW5nIHRoYXQgd2lsbCBiZSByZXF1ZXN0ZWQuIFRpcGljYWxseSBcIi91cGxpbmtcIlxyXG4gICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBpbnN0YWxsSGFuZGxlcnM6IGZ1bmN0aW9uKiBpbnN0YWxsSGFuZGxlcnMoYXBwLCBwcmVmaXgpIHtcclxuICAgICAgICAgICAgICAgIGFzc2VydCh0aGlzLl9hcHAgPT09IG51bGwsIFwiUi5TaW1wbGVVcGxpbmtTZXJ2ZXIuU2ltcGxlVXBsaW5rU2VydmVySW5zdGFuY2UuaW5zdGFsbEhhbmRsZXJzKC4uLik6IGFwcCBhbHJlYWR5IG1vdW50ZWQuXCIpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fYXBwID0gYXBwO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fcHJlZml4ID0gcHJlZml4IHx8IFwiL3VwbGluay9cIjtcclxuICAgICAgICAgICAgICAgIHZhciBzZXJ2ZXIgPSByZXF1aXJlKFwiaHR0cFwiKS5TZXJ2ZXIoYXBwKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2lvID0gaW8oc2VydmVyKS5vZihwcmVmaXgpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fYXBwLmdldCh0aGlzLl9wcmVmaXggKyBcIipcIiwgUi5zY29wZSh0aGlzLl9oYW5kbGVIdHRwR2V0LCB0aGlzKSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9hcHAucG9zdCh0aGlzLl9wcmVmaXggKyBcIipcIiwgYm9keVBhcnNlci5qc29uKCksIFIuc2NvcGUodGhpcy5faGFuZGxlSHR0cFBvc3QsIHRoaXMpKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2lvLm9uKFwiY29ubmVjdGlvblwiLCBSLnNjb3BlKHRoaXMuX2hhbmRsZVNvY2tldENvbm5lY3Rpb24sIHRoaXMpKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2hhbmRsZVNvY2tldERpc2Nvbm5lY3Rpb24gPSBSLnNjb3BlKHRoaXMuX2hhbmRsZVNvY2tldERpc2Nvbm5lY3Rpb24sIHRoaXMpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fc2Vzc2lvbnNFdmVudHMuYWRkTGlzdGVuZXIoXCJleHBpcmVcIiwgUi5zY29wZSh0aGlzLl9oYW5kbGVTZXNzaW9uRXhwaXJlLCB0aGlzKSk7XHJcbiAgICAgICAgICAgICAgICBfLmVhY2godGhpcy5fc3BlY3Muc3RvcmUsIFIuc2NvcGUodGhpcy5fYmluZFN0b3JlUm91dGUsIHRoaXMpKTtcclxuICAgICAgICAgICAgICAgIF8uZWFjaCh0aGlzLl9zcGVjcy5ldmVudHMsIFIuc2NvcGUodGhpcy5fYmluZEV2ZW50c1JvdXRlLCB0aGlzKSk7XHJcbiAgICAgICAgICAgICAgICBfLmVhY2godGhpcy5fc3BlY3MuYWN0aW9ucywgUi5zY29wZSh0aGlzLl9iaW5kQWN0aW9uc1JvdXRlLCB0aGlzKSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmJvb3RzdHJhcCA9IFIuc2NvcGUodGhpcy5fc3BlY3MuYm9vdHN0cmFwLCB0aGlzKTtcclxuICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMuYm9vdHN0cmFwKCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gc2VydmVyO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgKiA8cD5SZXR1cm4gdGhlIHNhdmVkIGRhdGEgZnJvbSBzdG9yZTwvcD5cclxuICAgICAgICAgICAgKiA8cD5SZXF1ZXN0ZWQgZnJvbSBSLlN0b3JlIHNlcnZlci1zaWRlIG9yIGNsaWVudC1zaWRlPC9wPlxyXG4gICAgICAgICAgICAqIEBtZXRob2QgX2hhbmRsZUh0dHBHZXRcclxuICAgICAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gcmVxIFRoZSBjbGFzc2ljYWwgcmVxdWVzdFxyXG4gICAgICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSByZXMgVGhlIHJlc3BvbnNlIHRvIHNlbmRcclxuICAgICAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gbmV4dFxyXG4gICAgICAgICAgICAqIEByZXR1cm4ge3N0cmluZ30gdmFsIFRoZSBjb21wdXRlZCBqc29uIHZhbHVlXHJcbiAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIF9oYW5kbGVIdHRwR2V0OiBmdW5jdGlvbiBfaGFuZGxlSHR0cEdldChyZXEsIHJlcywgbmV4dCkge1xyXG4gICAgICAgICAgICAgICAgY28oZnVuY3Rpb24qKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBwYXRoID0gcmVxLnBhdGguc2xpY2UodGhpcy5fcHJlZml4Lmxlbmd0aCAtIDEpOyAvLyBrZWVwIHRoZSBsZWFkaW5nIHNsYXNoXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGtleSA9IHRoaXMuX3N0b3JlUm91dGVyLm1hdGNoKHBhdGgpO1xyXG4gICAgICAgICAgICAgICAgICAgIFIuRGVidWcuZGV2KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCI8PDwgZmV0Y2hcIiwgcGF0aCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHlpZWxkIHRoaXMuZ2V0U3RvcmUoa2V5KTtcclxuICAgICAgICAgICAgICAgIH0pLmNhbGwodGhpcywgZnVuY3Rpb24oZXJyLCB2YWwpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZihlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYoUi5EZWJ1Zy5pc0RldigpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnI6IGVyci50b1N0cmluZygpLCBzdGFjazogZXJyLnN0YWNrIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyOiBlcnIudG9TdHJpbmcoKSB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoMjAwKS5qc29uKHZhbCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAqIEBtZXRob2QgX2hhbmRsZUh0dHBQb3N0XHJcbiAgICAgICAgICAgICogQHBhcmFtIHtvYmplY3R9IHJlcSBUaGUgY2xhc3NpY2FsIHJlcXVlc3RcclxuICAgICAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gcmVzIFRoZSByZXNwb25zZSB0byBzZW5kXHJcbiAgICAgICAgICAgICogQHJldHVybiB7c3RyaW5nfSBzdHJcclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgX2hhbmRsZUh0dHBQb3N0OiBmdW5jdGlvbiBfaGFuZGxlSHR0cFBvc3QocmVxLCByZXMpIHtcclxuICAgICAgICAgICAgICAgIGNvKGZ1bmN0aW9uKigpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgcGF0aCA9IHJlcS5wYXRoLnNsaWNlKHRoaXMuX3ByZWZpeC5sZW5ndGggLSAxKTsgLy8ga2VlcCB0aGUgbGVhZGluZyBzbGFzaFxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBoYW5kbGVyID0gdGhpcy5fYWN0aW9uc1JvdXRlci5tYXRjaChwYXRoKTtcclxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoXy5pc09iamVjdChyZXEuYm9keSksIFwiYm9keTogZXhwZWN0aW5nIE9iamVjdC5cIik7XHJcbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KHJlcS5ib2R5Lmd1aWQgJiYgXy5pc1N0cmluZyhyZXEuYm9keS5ndWlkKSwgXCJndWlkOiBleHBlY3RpbmcgU3RyaW5nLlwiKTtcclxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQocmVxLmJvZHkucGFyYW1zICYmIF8uaXNQbGFpbk9iamVjdChyZXEuYm9keS5wYXJhbXMpLCBcInBhcmFtczogZXhwZWN0aW5nIE9iamVjdC5cIik7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYoIV8uaGFzKHRoaXMuX3Nlc3Npb25zLCByZXEuYm9keS5ndWlkKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXNzaW9uc1tndWlkXSA9IG5ldyBSLlNpbXBsZVVwbGlua1NlcnZlci5TZXNzaW9uKGd1aWQsIHRoaXMuX3N0b3JlRXZlbnRzLCB0aGlzLl9ldmVudHNFdmVudHMsIHRoaXMuX3Nlc3Npb25zRXZlbnRzLCB0aGlzLnNlc3Npb25UaW1lb3V0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zZXNzaW9uQ3JlYXRlZChndWlkKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHBhcmFtcyA9IF8uZXh0ZW5kKHt9LCB7IGd1aWQ6IHJlcS5ib2R5Lmd1aWQgfSwgcmVxLmJvZHkucGFyYW1zKTtcclxuICAgICAgICAgICAgICAgICAgICBSLkRlYnVnLmRldihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiPDw8IGFjdGlvblwiLCBwYXRoLCBwYXJhbXMpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB5aWVsZCBoYW5kbGVyKHBhcmFtcyk7XHJcbiAgICAgICAgICAgICAgICB9KS5jYWxsKHRoaXMsIGZ1bmN0aW9uKGVyciwgdmFsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYoZXJyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKFIuRGVidWcuaXNEZXYoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyOiBlcnIudG9TdHJpbmcoKSwgc3RhY2s6IGVyci5zdGFjayB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycjogZXJyLnRvU3RyaW5nKCkgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcy5zdGF0dXMoMjAwKS5qc29uKHZhbCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIC8qKiBcclxuICAgICAgICAgICAgKiA8cD4gQ3JlYXRlIGEgUi5TaW1wbGVVcGxpbmtTZXJ2ZXIuQ29ubmVjdGlvbiBpbiBvcmRlciB0byBzZXQgdXAgaGFuZGxlciBpdGVtcy4gPGJyIC8+XHJcbiAgICAgICAgICAgICogVHJpZ2dlcmVkIHdoZW4gYSBzb2NrZXQgY29ubmVjdGlvbiBpcyBlc3RhYmxpc2hlZCA8L3A+XHJcbiAgICAgICAgICAgICogQG1ldGhvZCBfaGFuZGxlU29ja2V0Q29ubmVjdGlvblxyXG4gICAgICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBzb2NrZXQgVGhlIHNvY2tldCB1c2VkIGluIHRoZSBjb25uZWN0aW9uXHJcbiAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIF9oYW5kbGVTb2NrZXRDb25uZWN0aW9uOiBmdW5jdGlvbiBfaGFuZGxlU29ja2V0Q29ubmVjdGlvbihzb2NrZXQpIHtcclxuICAgICAgICAgICAgICAgIHZhciBjb25uZWN0aW9uID0gbmV3IFIuU2ltcGxlVXBsaW5rU2VydmVyLkNvbm5lY3Rpb24odGhpcy5fcGlkLCBzb2NrZXQsIHRoaXMuX2hhbmRsZVNvY2tldERpc2Nvbm5lY3Rpb24sIHRoaXMuX2xpbmtTZXNzaW9uLCB0aGlzLl91bmxpbmtTZXNzaW9uKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2Nvbm5lY3Rpb25zW2Nvbm5lY3Rpb24udW5pcXVlSWRdID0gY29ubmVjdGlvbjtcclxuICAgICAgICAgICAgfSxcclxuXHJcbiAgICAgICAgICAgIC8qKiBcclxuICAgICAgICAgICAgKiA8cD4gRGVzdHJveSBhIFIuU2ltcGxlVXBsaW5rU2VydmVyLkNvbm5lY3Rpb24uIDxiciAvPlxyXG4gICAgICAgICAgICAqIFRyaWdnZXJlZCB3aGVuIGEgc29ja2V0IGNvbm5lY3Rpb24gaXMgY2xvc2VkIDwvcD5cclxuICAgICAgICAgICAgKiBAbWV0aG9kIF9oYW5kbGVTb2NrZXREaXNjb25uZWN0aW9uXHJcbiAgICAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IHVuaXF1ZUlkIFRoZSB1bmlxdWUgSWQgb2YgdGhlIGNvbm5lY3Rpb25cclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgX2hhbmRsZVNvY2tldERpc2Nvbm5lY3Rpb246IGZ1bmN0aW9uIF9oYW5kbGVTb2NrZXREaXNjb25uZWN0aW9uKHVuaXF1ZUlkKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgZ3VpZCA9IHRoaXMuX2Nvbm5lY3Rpb25zW3VuaXF1ZUlkXS5ndWlkO1xyXG4gICAgICAgICAgICAgICAgaWYoZ3VpZCAmJiB0aGlzLl9zZXNzaW9uc1tndWlkXSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3Nlc3Npb25zW2d1aWRdLmRldGFjaENvbm5lY3Rpb24oKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9jb25uZWN0aW9uc1t1bmlxdWVJZF07XHJcbiAgICAgICAgICAgIH0sXHJcblxyXG4gICAgICAgICAgICAvKiogXHJcbiAgICAgICAgICAgICogPHA+TGluayBhIFNlc3Npb24gaW4gb3JkZXIgdG8gc2V0IHVwIHN1YnNjcmliaW5nIGFuZCB1bnN1YnNjcmliaW5nIG1ldGhvZHMgdXBsaW5rLXNlcnZlci1zaWRlPC9wPlxyXG4gICAgICAgICAgICAqIEBtZXRob2QgX2xpbmtTZXNzaW9uXHJcbiAgICAgICAgICAgICogQHBhcmFtIHtTaW1wbGVVcGxpbmtTZXJ2ZXIuQ29ubmVjdGlvbn0gY29ubmVjdGlvbiBUaGUgY3JlYXRlZCBjb25uZWN0aW9uXHJcbiAgICAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGd1aWQgVW5pcXVlIHN0cmluZyBHVUlEXHJcbiAgICAgICAgICAgICogQHJldHVybiB7b2JqZWN0fSB0aGUgb2JqZWN0IHRoYXQgY29udGFpbnMgbWV0aG9kcyBzdWJzY3JpcHRpb25zL3Vuc3Vic2NyaXB0aW9uc1xyXG4gICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBfbGlua1Nlc3Npb246IGZ1bmN0aW9uKiBfbGlua1Nlc3Npb24oY29ubmVjdGlvbiwgZ3VpZCkge1xyXG4gICAgICAgICAgICAgICAgaWYoIXRoaXMuX3Nlc3Npb25zW2d1aWRdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2Vzc2lvbnNbZ3VpZF0gPSBuZXcgUi5TaW1wbGVVcGxpbmtTZXJ2ZXIuU2Vzc2lvbihndWlkLCB0aGlzLl9zdG9yZUV2ZW50cywgdGhpcy5fZXZlbnRzRXZlbnRzLCB0aGlzLl9zZXNzaW9uc0V2ZW50cywgdGhpcy5zZXNzaW9uVGltZW91dCk7XHJcbiAgICAgICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zZXNzaW9uQ3JlYXRlZChndWlkKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9zZXNzaW9uc1tndWlkXS5hdHRhY2hDb25uZWN0aW9uKGNvbm5lY3Rpb24pO1xyXG4gICAgICAgICAgICB9LFxyXG5cclxuICAgICAgICAgICAgLyoqIFxyXG4gICAgICAgICAgICAqIDxwPlVubGluayBhIFNlc3Npb248L3A+XHJcbiAgICAgICAgICAgICogQG1ldGhvZCBfdW5saW5rU2Vzc2lvblxyXG4gICAgICAgICAgICAqIEBwYXJhbSB7U2ltcGxlVXBsaW5rU2VydmVyLkNvbm5lY3Rpb259IGNvbm5lY3Rpb24gXHJcbiAgICAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGd1aWQgVW5pcXVlIHN0cmluZyBHVUlEXHJcbiAgICAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259IGZuXHJcbiAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIF91bmxpbmtTZXNzaW9uOiBmdW5jdGlvbiBfdW5saW5rU2Vzc2lvbihjb25uZWN0aW9uLCBndWlkKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gUi5zY29wZShmdW5jdGlvbihmbikge1xyXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKHRoaXMuX3Nlc3Npb25zW2d1aWRdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXNzaW9uc1tndWlkXS50ZXJtaW5hdGUoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBjYXRjaChlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZuKFIuRGVidWcuZXh0ZW5kRXJyb3IoXCJSLlNpbXBsZVVwbGlua1NlcnZlckluc3RhbmNlLl91bmxpbmtTZXNzaW9uKC4uLilcIikpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZm4obnVsbCk7XHJcbiAgICAgICAgICAgICAgICB9LCB0aGlzKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLyoqIFxyXG4gICAgICAgICAgICAqIEBtZXRob2QgX2hhbmRsZVNlc3Npb25FeHBpcmVcclxuICAgICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gZ3VpZCBVbmlxdWUgc3RyaW5nIEdVSURcclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgX2hhbmRsZVNlc3Npb25FeHBpcmU6IGZ1bmN0aW9uIF9oYW5kbGVTZXNzaW9uRXhwaXJlKGd1aWQpIHtcclxuICAgICAgICAgICAgICAgIFIuRGVidWcuZGV2KFIuc2NvcGUoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KF8uaGFzKHRoaXMuX3Nlc3Npb25zLCBndWlkKSwgXCJSLlNpbXBsZVVwbGlua1NlcnZlci5faGFuZGxlU2Vzc2lvbkV4cGlyZSguLi4pOiBubyBzdWNoIHNlc3Npb24uXCIpO1xyXG4gICAgICAgICAgICAgICAgfSwgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3Nlc3Npb25zW2d1aWRdO1xyXG4gICAgICAgICAgICAgICAgY28oZnVuY3Rpb24qKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMuc2Vzc2lvbkRlc3Ryb3llZChndWlkKTtcclxuICAgICAgICAgICAgICAgIH0pLmNhbGwodGhpcywgUi5EZWJ1Zy5yZXRocm93KFwiUi5TaW1wbGVVcGxpbmtTZXJ2ZXIuX2hhbmRsZVNlc3Npb25FeHBpcmUoLi4uKVwiKSk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKiogXHJcbiAgICAgICAgKiA8cD5TZXR0aW5nIHVwIGEgY29ubmVjdGlvbiBpbiBvcmRlciB0byBpbml0aWFsaWVzIG1ldGhvZHMgYW5kIHRvIHByb3ZpZGVzIHNwZWNpZmljcyBsaXN0ZW5lcnMgb24gdGhlIHNvY2tldDwvcD5cclxuICAgICAgICAqIEBtZXRob2QgQ29ubmVjdGlvblxyXG4gICAgICAgICogQHBhcmFtIHtvYmplY3R9IHBpZCBcclxuICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBzb2NrZXRcclxuICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBoYW5kbGVTb2NrZXREaXNjb25uZWN0aW9uXHJcbiAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gbGlua1Nlc3Npb24gXHJcbiAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gdW5saW5rU2Vzc2lvblxyXG4gICAgICAgICovXHJcbiAgICAgICAgQ29ubmVjdGlvbjogZnVuY3Rpb24gQ29ubmVjdGlvbihwaWQsIHNvY2tldCwgaGFuZGxlU29ja2V0RGlzY29ubmVjdGlvbiwgbGlua1Nlc3Npb24sIHVubGlua1Nlc3Npb24pIHtcclxuICAgICAgICAgICAgdGhpcy5fcGlkID0gcGlkO1xyXG4gICAgICAgICAgICB0aGlzLnVuaXF1ZUlkID0gXy51bmlxdWVJZChcIlIuU2ltcGxlVXBsaW5rU2VydmVyLkNvbm5lY3Rpb25cIik7XHJcbiAgICAgICAgICAgIHRoaXMuX3NvY2tldCA9IHNvY2tldDtcclxuICAgICAgICAgICAgdGhpcy5faGFuZGxlU29ja2V0RGlzY29ubmVjdGlvbiA9IGhhbmRsZVNvY2tldERpc2Nvbm5lY3Rpb247XHJcbiAgICAgICAgICAgIHRoaXMuX2xpbmtTZXNzaW9uID0gbGlua1Nlc3Npb247XHJcbiAgICAgICAgICAgIHRoaXMuX3VubGlua1Nlc3Npb24gPSB1bmxpbmtTZXNzaW9uO1xyXG4gICAgICAgICAgICB0aGlzLl9iaW5kSGFuZGxlcnMoKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIF9Db25uZWN0aW9uUHJvdG9Qcm9wczogLyoqIEBsZW5kcyBSLlNpbXBsZVVwbGlua1NlcnZlci5Db25uZWN0aW9uLnByb3RvdHlwZSAqL3tcclxuICAgICAgICAgICAgX3NvY2tldDogbnVsbCxcclxuICAgICAgICAgICAgX3BpZDogbnVsbCxcclxuICAgICAgICAgICAgdW5pcXVlSWQ6IG51bGwsXHJcbiAgICAgICAgICAgIGd1aWQ6IG51bGwsXHJcbiAgICAgICAgICAgIF9oYW5kbGVTb2NrZXREaXNjb25uZWN0aW9uOiBudWxsLFxyXG4gICAgICAgICAgICBfbGlua1Nlc3Npb246IG51bGwsXHJcbiAgICAgICAgICAgIF91bmxpbmtTZXNzaW9uOiBudWxsLFxyXG4gICAgICAgICAgICBfc3Vic2NyaWJlVG86IG51bGwsXHJcbiAgICAgICAgICAgIF91bnN1YnNjcmliZUZyb206IG51bGwsXHJcbiAgICAgICAgICAgIF9saXN0ZW5UbzogbnVsbCxcclxuICAgICAgICAgICAgX3VubGlzdGVuRnJvbTogbnVsbCxcclxuICAgICAgICAgICAgX2Rpc2Nvbm5lY3RlZDogbnVsbCxcclxuICAgICAgICAgICAgLyoqIFxyXG4gICAgICAgICAgICAqIDxwPlNldHRpbmcgdXAgdGhlIHNwZWNpZmljcyBsaXN0ZW5lcnMgZm9yIHRoZSBzb2NrZXQ8L3A+XHJcbiAgICAgICAgICAgICogQG1ldGhvZCBfYmluZEhhbmRsZXJzXHJcbiAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIF9iaW5kSGFuZGxlcnM6IGZ1bmN0aW9uIF9iaW5kSGFuZGxlcnMoKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9zb2NrZXQub24oXCJoYW5kc2hha2VcIiwgUi5zY29wZSh0aGlzLl9oYW5kbGVIYW5kc2hha2UsIHRoaXMpKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3NvY2tldC5vbihcInN1YnNjcmliZVRvXCIsIFIuc2NvcGUodGhpcy5faGFuZGxlU3Vic2NyaWJlVG8sIHRoaXMpKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3NvY2tldC5vbihcInVuc3Vic2NyaWJlRnJvbVwiLCBSLnNjb3BlKHRoaXMuX2hhbmRsZVVuc3Vic2NyaWJlRnJvbSwgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fc29ja2V0Lm9uKFwibGlzdGVuVG9cIiwgUi5zY29wZSh0aGlzLl9oYW5kbGVMaXN0ZW5UbywgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fc29ja2V0Lm9uKFwidW5saXN0ZW5Gcm9tXCIsIFIuc2NvcGUodGhpcy5faGFuZGxlVW5saXN0ZW5Gcm9tLCB0aGlzKSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9zb2NrZXQub24oXCJkaXNjb25uZWN0XCIsIFIuc2NvcGUodGhpcy5faGFuZGxlRGlzY29ubmVjdCwgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fc29ja2V0Lm9uKFwidW5oYW5kc2hha2VcIiwgUi5zY29wZSh0aGlzLl9oYW5kbGVVbkhhbmRzaGFrZSwgdGhpcykpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgKiA8cD4gU2ltcGx5IGVtaXQgYSBzcGVjaWZpYyBhY3Rpb24gb24gdGhlIHNvY2tldCA8L3A+XHJcbiAgICAgICAgICAgICogQG1ldGhvZCBlbWl0XHJcbiAgICAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIGFjdGlvbiB0byBzZW5kXHJcbiAgICAgICAgICAgICogQHBhcmFtIHtvYmplY3R9IHBhcmFtcyBUaGUgcGFyYW1zIFxyXG4gICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBlbWl0OiBmdW5jdGlvbiBlbWl0KG5hbWUsIHBhcmFtcykge1xyXG4gICAgICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiW0NdID4+PiBcIiArIG5hbWUsIHBhcmFtcyk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3NvY2tldC5lbWl0KG5hbWUsIHBhcmFtcyk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAqIDxwPiBUcmlnZ2VyZWQgYnkgdGhlIHJlY2VudGx5IGNvbm5lY3RlZCBjbGllbnQuIDxiciAvPlxyXG4gICAgICAgICAgICAqIENvbWJpbmVzIG1ldGhvZHMgb2Ygc3Vic2NyaXB0aW9ucyB0aGF0IHdpbGwgYmUgdHJpZ2dlcmVkIGJ5IHRoZSBjbGllbnQgdmlhIHNvY2tldCBsaXN0ZW5pbmc8L3A+XHJcbiAgICAgICAgICAgICogQG1ldGhvZCBfaGFuZGxlSGFuZHNoYWtlXHJcbiAgICAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IHBhcmFtcyBDb250YWlucyB0aGUgdW5pcXVlIHN0cmluZyBHVUlEXHJcbiAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIF9oYW5kbGVIYW5kc2hha2U6IGZ1bmN0aW9uIF9oYW5kbGVIYW5kc2hha2UocGFyYW1zKSB7XHJcbiAgICAgICAgICAgICAgICBpZighXy5oYXMocGFyYW1zLCBcImd1aWRcIikgfHwgIV8uaXNTdHJpbmcocGFyYW1zLmd1aWQpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0KFwiZXJyXCIsIHsgZXJyOiBcImhhbmRzaGFrZS5wYXJhbXMuZ3VpZDogZXhwZWN0ZWQgU3RyaW5nLlwifSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIGlmKHRoaXMuZ3VpZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdChcImVyclwiLCB7IGVycjogXCJoYW5kc2hha2U6IHNlc3Npb24gYWxyZWFkeSBsaW5rZWQuXCJ9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvKGZ1bmN0aW9uKigpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5ndWlkID0gcGFyYW1zLmd1aWQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzID0geWllbGQgdGhpcy5fbGlua1Nlc3Npb24odGhpcywgdGhpcy5ndWlkKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0KFwiaGFuZHNoYWtlLWFja1wiLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwaWQ6IHRoaXMuX3BpZCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlY292ZXJlZDogcy5yZWNvdmVyZWQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zdWJzY3JpYmVUbyA9IHMuc3Vic2NyaWJlVG87XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3Vuc3Vic2NyaWJlRnJvbSA9IHMudW5zdWJzY3JpYmVGcm9tO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9saXN0ZW5UbyA9IHMubGlzdGVuVG87XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3VubGlzdGVuRnJvbSA9IHMudW5saXN0ZW5Gcm9tO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pLmNhbGwodGhpcywgUi5EZWJ1Zy5yZXRocm93KFwiUi5TaW1wbGVVcGxpbmtTZXJ2ZXIuQ29ubmVjdGlvbi5faGFuZGxlSGFuZHNoYWtlKC4uLilcIikpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgKiA8cD4gVHJpZ2dlcmVkIGJ5IHRoZSByZWNlbnRseSBkaXNjb25uZWN0ZWQgY2xpZW50LiA8YnIgLz5cclxuICAgICAgICAgICAgKiBSZW1vdmVzIG1ldGhvZHMgb2Ygc3Vic2NyaXB0aW9uczwvcD5cclxuICAgICAgICAgICAgKiBAbWV0aG9kIF9oYW5kbGVIYW5kc2hha2VcclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgX2hhbmRsZVVuSGFuZHNoYWtlOiBmdW5jdGlvbiBfaGFuZGxlVW5IYW5kc2hha2UoKSB7XHJcbiAgICAgICAgICAgICAgICBpZighdGhpcy5ndWlkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0KFwiZXJyXCIsIHsgZXJyOiBcInVuaGFuZHNoYWtlOiBubyBhY3RpdmUgc2Vzc2lvbi5cIn0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY28oZnVuY3Rpb24qKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zdWJzY3JpYmVUbyA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3Vuc3Vic2NyaWJlRnJvbSA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2xpc3RlblRvID0gbnVsbDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fdW5saXN0ZW5Gcm9tID0gbnVsbDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHMgPSB5aWVsZCB0aGlzLl91bmxpbmtTZXNzaW9uKHRoaXMsIHRoaXMuZ3VpZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdChcInVuaGFuZHNoYWtlLWFja1wiKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5ndWlkID0gbnVsbDtcclxuICAgICAgICAgICAgICAgICAgICB9KS5jYWxsKHRoaXMsIFIuRGVidWcucmV0aHJvdyhcIlIuU2ltcGxlVXBsaW5rU2VydmVyLkNvbm5lY3Rpb24uX2hhbmRsZVVuSGFuZHNoYWtlKC4uLilcIikpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAvKiogXHJcbiAgICAgICAgICAgICogPHA+TWFwcyB0aGUgdHJpZ2dlcmVkIGV2ZW50IHdpdGggdGhlIF9zdWJzY3JpYmVUbyBtZXRob2RzIDwvcD5cclxuICAgICAgICAgICAgKiBAbWV0aG9kIF9oYW5kbGVTdWJzY3JpYmVUb1xyXG4gICAgICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBwYXJhbXMgQ29udGFpbnMgdGhlIGtleSBwcm92aWRlZCBieSBjbGllbnRcclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgX2hhbmRsZVN1YnNjcmliZVRvOiBmdW5jdGlvbiBfaGFuZGxlU3Vic2NyaWJlVG8ocGFyYW1zKSB7XHJcbiAgICAgICAgICAgICAgICBpZighXy5oYXMocGFyYW1zLCBcImtleVwiKSB8fCAhXy5pc1N0cmluZyhwYXJhbXMua2V5KSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdChcImVyclwiLCB7IGVycjogXCJzdWJzY3JpYmVUby5wYXJhbXMua2V5OiBleHBlY3RlZCBTdHJpbmcuXCIgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIGlmKCF0aGlzLl9zdWJzY3JpYmVUbykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdChcImVyclwiLCB7IGVycjogXCJzdWJzY3JpYmVUbzogcmVxdWlyZXMgaGFuZHNoYWtlLlwiIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc3Vic2NyaWJlVG8ocGFyYW1zLmtleSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIC8qKiBcclxuICAgICAgICAgICAgKiA8cD5NYXBzIHRoZSB0cmlnZ2VyZWQgZXZlbnQgd2l0aCB0aGUgX3Vuc3Vic2NyaWJlRnJvbSBtZXRob2RzPC9wPlxyXG4gICAgICAgICAgICAqIEBtZXRob2QgX2hhbmRsZVVuc3Vic2NyaWJlRnJvbVxyXG4gICAgICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBwYXJhbXMgQ29udGFpbnMgdGhlIGtleSBwcm92aWRlZCBieSBjbGllbnRcclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgX2hhbmRsZVVuc3Vic2NyaWJlRnJvbTogZnVuY3Rpb24gX2hhbmRsZVVuc3Vic2NyaWJlRnJvbShwYXJhbXMpIHtcclxuICAgICAgICAgICAgICAgIGlmKCFfLmhhcyhwYXJhbXMsIFwia2V5XCIpIHx8ICFfLmlzU3RyaW5nKHBhcmFtcy5rZXkpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0KFwiZXJyXCIsIHsgZXJyOiBcInVuc3Vic2NyaWJlRnJvbS5wYXJhbXMua2V5OiBleHBlY3RlZCBTdHJpbmcuXCIgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIGlmKCF0aGlzLl91bnN1YnNjcmliZUZyb20pIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXQoXCJlcnJcIiwgeyBlcnI6IFwidW5zdWJzY3JpYmVGcm9tOiByZXF1aXJlcyBoYW5kc2hha2UuXCIgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl91bnN1YnNjcmliZUZyb20ocGFyYW1zLmtleSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIC8qKiBcclxuICAgICAgICAgICAgKiA8cD5NYXBzIHRoZSB0cmlnZ2VyZWQgZXZlbnQgd2l0aCB0aGUgbGlzdGVuVG8gbWV0aG9kczwvcD5cclxuICAgICAgICAgICAgKiBAbWV0aG9kIF9oYW5kbGVMaXN0ZW5Ub1xyXG4gICAgICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBwYXJhbXMgQ29udGFpbnMgdGhlIGV2ZW50TmFtZSBwcm92aWRlZCBieSBjbGllbnRcclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgX2hhbmRsZUxpc3RlblRvOiBmdW5jdGlvbiBfaGFuZGxlTGlzdGVuVG8ocGFyYW1zKSB7XHJcbiAgICAgICAgICAgICAgICBpZighXy5oYXMocGFyYW1zLCBcImV2ZW50TmFtZVwiKSB8fCAhXy5pc1N0cmluZyhwYXJhbXMuZXZlbnROYW1lKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdChcImVyclwiLCB7IGVycjogXCJsaXN0ZW5Uby5wYXJhbXMuZXZlbnROYW1lOiBleHBlY3RlZCBTdHJpbmcuXCIgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIGlmKCF0aGlzLl9saXN0ZW5Ubykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdChcImVyclwiLCB7IGVycjogXCJsaXN0ZW5UbzogcmVxdWlyZXMgaGFuZHNoYWtlLlwiIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5saXN0ZW5UbyhwYXJhbXMuZXZlbnROYW1lKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLyoqIFxyXG4gICAgICAgICAgICAqIDxwPk1hcHMgdGhlIHRyaWdnZXJlZCBldmVudCB3aXRoIHRoZSB1bmxpc3RlbkZyb20gbWV0aG9kczwvcD5cclxuICAgICAgICAgICAgKiBAbWV0aG9kIF9oYW5kbGVVbmxpc3RlbkZyb21cclxuICAgICAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gcGFyYW1zIENvbnRhaW5zIHRoZSBldmVudE5hbWUgcHJvdmlkZWQgYnkgY2xpZW50XHJcbiAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIF9oYW5kbGVVbmxpc3RlbkZyb206IGZ1bmN0aW9uIF9oYW5kbGVVbmxpc3RlbkZyb20ocGFyYW1zKSB7XHJcbiAgICAgICAgICAgICAgICBpZighXy5oYXMocGFyYW1zLCBcImV2ZW50TmFtZVwiKSB8fCAhXy5pc1N0cmluZyhwYXJhbXMuZXZlbnROYW1lKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdChcImVyclwiLCB7IGVycjogXCJ1bmxpc3RlbkZyb20ucGFyYW1zLmV2ZW50TmFtZTogZXhwZWN0ZWQgU3RyaW5nLlwiIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSBpZighdGhpcy51bmxpc3RlbkZyb20pIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KFwiZXJyXCIsIHsgZXJyOiBcInVubGlzdGVuRnJvbTogcmVxdWlyZXMgaGFuZHNoYWtlLlwiIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51bmxpc3RlbkZyb20ocGFyYW1zLmV2ZW50TmFtZSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAvKiogXHJcbiAgICAgICAgICAgICogPHA+VHJpZ2dlcmVkIGJ5IHRoZSByZWNlbnRseSBkaXNjb25uZWN0ZWQgY2xpZW50LjwvcD5cclxuICAgICAgICAgICAgKiBAbWV0aG9kIF9oYW5kbGVEaXNjb25uZWN0XHJcbiAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIF9oYW5kbGVEaXNjb25uZWN0OiBmdW5jdGlvbiBfaGFuZGxlRGlzY29ubmVjdCgpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2hhbmRsZVNvY2tldERpc2Nvbm5lY3Rpb24odGhpcy51bmlxdWVJZCwgZmFsc2UpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqIFxyXG4gICAgICAgICogPHA+U2V0dGluZyB1cCBhIHNlc3Npb248L3A+XHJcbiAgICAgICAgKiBAbWV0aG9kIFNlc3Npb25cclxuICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBwaWQgXHJcbiAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gc3RvcmVFdmVudHNcclxuICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBldmVudHNFdmVudHNcclxuICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBzZXNzaW9uc0V2ZW50cyBcclxuICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSB0aW1lb3V0XHJcbiAgICAgICAgKi9cclxuICAgICAgICBTZXNzaW9uOiBmdW5jdGlvbiBTZXNzaW9uKGd1aWQsIHN0b3JlRXZlbnRzLCBldmVudHNFdmVudHMsIHNlc3Npb25zRXZlbnRzLCB0aW1lb3V0KSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2d1aWQgPSBndWlkO1xyXG4gICAgICAgICAgICB0aGlzLl9zdG9yZUV2ZW50cyA9IHN0b3JlRXZlbnRzO1xyXG4gICAgICAgICAgICB0aGlzLl9ldmVudHNFdmVudHMgPSBldmVudHNFdmVudHM7XHJcbiAgICAgICAgICAgIHRoaXMuX3Nlc3Npb25zRXZlbnRzID0gc2Vzc2lvbnNFdmVudHM7XHJcbiAgICAgICAgICAgIHRoaXMuX21lc3NhZ2VRdWV1ZSA9IFtdO1xyXG4gICAgICAgICAgICB0aGlzLl90aW1lb3V0RHVyYXRpb24gPSB0aW1lb3V0O1xyXG4gICAgICAgICAgICB0aGlzLl9leHBpcmUgPSBSLnNjb3BlKHRoaXMuX2V4cGlyZSwgdGhpcyk7XHJcbiAgICAgICAgICAgIHRoaXMuX2V4cGlyZVRpbWVvdXQgPSBzZXRUaW1lb3V0KHRoaXMuX2V4cGlyZSwgdGhpcy5fdGltZW91dER1cmF0aW9uKTtcclxuICAgICAgICAgICAgdGhpcy5fc3Vic2NyaXB0aW9ucyA9IHt9O1xyXG4gICAgICAgICAgICB0aGlzLl9saXN0ZW5lcnMgPSB7fTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIF9TZXNzaW9uUHJvdG9Qcm9wczogLyoqIEBsZW5kcyBSLlNpbXBsZVVwbGlua1NlcnZlci5TZXNzaW9uLnByb3RvdHlwZSAqL3tcclxuICAgICAgICAgICAgX2d1aWQ6IG51bGwsXHJcbiAgICAgICAgICAgIF9jb25uZWN0aW9uOiBudWxsLFxyXG4gICAgICAgICAgICBfc3Vic2NyaXB0aW9uczogbnVsbCxcclxuICAgICAgICAgICAgX2xpc3RlbmVyczogbnVsbCxcclxuICAgICAgICAgICAgX3N0b3JlRXZlbnRzOiBudWxsLFxyXG4gICAgICAgICAgICBfZXZlbnRzRXZlbnRzOiBudWxsLFxyXG4gICAgICAgICAgICBfc2Vzc2lvbnNFdmVudHM6IG51bGwsXHJcbiAgICAgICAgICAgIF9tZXNzYWdlUXVldWU6IG51bGwsXHJcbiAgICAgICAgICAgIF9leHBpcmVUaW1lb3V0OiBudWxsLFxyXG4gICAgICAgICAgICBfdGltZW91dER1cmF0aW9uOiBudWxsLFxyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgKiA8cD5CaW5kIHRoZSBzdWJzY3JpYmluZyBhbmQgdW5zdWJzY3JpYmluZyBtZXRob2RzIHdoZW4gYSBjb25uZWN0aW9uIGlzIGVzdGFibGlzaGVkIDxiciAvPlxyXG4gICAgICAgICAgICAqIE1ldGhvZHMgdGhhdCB0cmlnZ2VyIG9uIGNsaWVudCBpc3N1ZXMgKGxpa2UgZW1pdChcInN1YnNjcmliZVRvXCIpLCBlbWl0KFwidW5zdWJzY3JpYmVGcm9tXCIpKTwvcD5cclxuICAgICAgICAgICAgKiBAbWV0aG9kIGF0dGFjaENvbm5lY3Rpb25cclxuICAgICAgICAgICAgKiBAcGFyYW0ge1NpbXBsZVVwbGlua1NlcnZlci5Db25uZWN0aW9ufSBjb25uZWN0aW9uIHRoZSBjdXJyZW50IGNyZWF0ZWQgY29ubmVjdGlvblxyXG4gICAgICAgICAgICAqIEByZXR1cm4ge29iamVjdH0gdGhlIGJpbmRlZCBvYmplY3Qgd2l0aCBtZXRob2RzXHJcbiAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIGF0dGFjaENvbm5lY3Rpb246IGZ1bmN0aW9uIGF0dGFjaENvbm5lY3Rpb24oY29ubmVjdGlvbikge1xyXG4gICAgICAgICAgICAgICAgdmFyIHJlY292ZXJlZCA9ICh0aGlzLl9jb25uZWN0aW9uICE9PSBudWxsKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuZGV0YWNoQ29ubmVjdGlvbigpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fY29ubmVjdGlvbiA9IGNvbm5lY3Rpb247XHJcbiAgICAgICAgICAgICAgICBfLmVhY2godGhpcy5fbWVzc2FnZVF1ZXVlLCBmdW5jdGlvbihtKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29ubmVjdGlvbi5lbWl0KG0ubmFtZSwgbS5wYXJhbXMpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9tZXNzYWdlUXVldWUgPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX2V4cGlyZVRpbWVvdXQpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgICAgICByZWNvdmVyZWQ6IHJlY292ZXJlZCxcclxuICAgICAgICAgICAgICAgICAgICBzdWJzY3JpYmVUbzogUi5zY29wZSh0aGlzLnN1YnNjcmliZVRvLCB0aGlzKSxcclxuICAgICAgICAgICAgICAgICAgICB1bnN1YnNjcmliZUZyb206IFIuc2NvcGUodGhpcy51bnN1YnNjcmliZUZyb20sIHRoaXMpLFxyXG4gICAgICAgICAgICAgICAgICAgIGxpc3RlblRvOiBSLnNjb3BlKHRoaXMubGlzdGVuVG8sIHRoaXMpLFxyXG4gICAgICAgICAgICAgICAgICAgIHVubGlzdGVuRnJvbTogUi5zY29wZSh0aGlzLnVubGlzdGVuRnJvbSwgdGhpcyksXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgKiA8cD5SZW1vdmUgdGhlIHByZXZpb3VzbHkgYWRkZWQgY29ubmVjdGlvbiwgYW5kIGNsZWFuIHRoZSBtZXNzYWdlIHF1ZXVlIDwvcD5cclxuICAgICAgICAgICAgKiBAbWV0aG9kIGRldGFjaENvbm5lY3Rpb25cclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgZGV0YWNoQ29ubmVjdGlvbjogZnVuY3Rpb24gZGV0YWNoQ29ubmVjdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIGlmKHRoaXMuX2Nvbm5lY3Rpb24gPT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jb25uZWN0aW9uID0gbnVsbDtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tZXNzYWdlUXVldWUgPSBbXTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9leHBpcmVUaW1lb3V0ID0gc2V0VGltZW91dCh0aGlzLl9leHBpcmUsIHRoaXMuX3RpbWVvdXREdXJhdGlvbik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAqIEBtZXRob2QgdGVybWluYXRlXHJcbiAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIHRlcm1pbmF0ZTogZnVuY3Rpb24gdGVybWluYXRlKCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZXhwaXJlKCk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIC8qKiBcclxuICAgICAgICAgICAgKiA8cD5NZXRob2QgaW52b2tlZCBieSBjbGllbnQgdmlhIHNvY2tldCBlbWl0IDxiciAvPlxyXG4gICAgICAgICAgICAqIFN0b3JlIHRoZSBfc2lnbmFsVXBkYXRlIG1ldGhvZCBpbiBzdWJzY3JpcHRpb24gPGJyIC8+XHJcbiAgICAgICAgICAgICogQWRkIGEgbGlzdGVuZXIgdGhhdCB3aWxsIGNhbGwgX3NpZ25hbFVwZGF0ZSB3aGVuIHRyaWdnZXJlZCA8L3A+XHJcbiAgICAgICAgICAgICogQG1ldGhvZCBzdWJzY3JpYmVUb1xyXG4gICAgICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSB0byBzdWJzY3JpYmVcclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgc3Vic2NyaWJlVG86IGZ1bmN0aW9uIHN1YnNjcmliZVRvKGtleSkge1xyXG4gICAgICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoUi5zY29wZShmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoIV8uaGFzKHRoaXMuX3N1YnNjcmlwdGlvbnMsIGtleSksIFwiUi5TaW1wbGVVcGxpbmtTZXJ2ZXIuU2Vzc2lvbi5zdWJzY3JpYmVUbyguLi4pOiBhbHJlYWR5IHN1YnNjcmliZWQuXCIpO1xyXG4gICAgICAgICAgICAgICAgfSwgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fc3Vic2NyaXB0aW9uc1trZXldID0gdGhpcy5fc2lnbmFsVXBkYXRlKCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9zdG9yZUV2ZW50cy5hZGRMaXN0ZW5lcihcInNldDpcIiArIGtleSwgdGhpcy5fc3Vic2NyaXB0aW9uc1trZXldKTtcclxuICAgICAgICAgICAgfSxcclxuXHJcbiAgICAgICAgICAgIC8qKiBcclxuICAgICAgICAgICAgKiA8cD5NZXRob2QgaW52b2tlZCBieSBjbGllbnQgdmlhIHNvY2tldCBlbWl0IDxiciAvPlxyXG4gICAgICAgICAgICAqIFJlbW92ZSBhIGxpc3RlbmVyIGFjY29yZGluZyB0byB0aGUga2V5PC9wPlxyXG4gICAgICAgICAgICAqIEBtZXRob2Qgc3Vic2NyaWJlVG9cclxuICAgICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgdG8gdW5zdWJzY3JpYmVcclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgdW5zdWJzY3JpYmVGcm9tOiBmdW5jdGlvbiB1bnN1YnNjcmliZUZyb20oa2V5KSB7XHJcbiAgICAgICAgICAgICAgICBSLkRlYnVnLmRldihSLnNjb3BlKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGFzc2VydChfLmhhcyh0aGlzLl9zdWJzY3JpcHRpb25zLCBrZXkpLCBcIlIuU2ltcGxlVXBsaW5rU2VydmVyLlNlc3Npb24udW5zdWJzY3JpYmVGcm9tKC4uLik6IG5vdCBzdWJzY3JpYmVkLlwiKTtcclxuICAgICAgICAgICAgICAgIH0sIHRoaXMpKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3N0b3JlRXZlbnRzLnJlbW92ZUxpc3RlbmVyKFwic2V0OlwiICsga2V5LCB0aGlzLl9zdWJzY3JpcHRpb25zW2tleV0pO1xyXG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3N1YnNjcmlwdGlvbnNba2V5XTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICogPHA+IFNpbXBseSBlbWl0IGEgc3BlY2lmaWMgYWN0aW9uIG9uIHRoZSBzb2NrZXQgPC9wPlxyXG4gICAgICAgICAgICAqIEBtZXRob2QgX2VtaXRcclxuICAgICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgYWN0aW9uIHRvIHNlbmRcclxuICAgICAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gcGFyYW1zIFRoZSBwYXJhbXMgXHJcbiAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIF9lbWl0OiBmdW5jdGlvbiBfZW1pdChuYW1lLCBwYXJhbXMpIHtcclxuICAgICAgICAgICAgICAgIFIuRGVidWcuZGV2KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIltTXSA+Pj4gXCIgKyBuYW1lLCBwYXJhbXMpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBpZih0aGlzLl9jb25uZWN0aW9uICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY29ubmVjdGlvbi5lbWl0KG5hbWUsIHBhcmFtcyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tZXNzYWdlUXVldWUucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IG5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmFtczogcGFyYW1zLFxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAvKiogPHA+UHVzaCBhbiB1cGRhdGUgYWN0aW9uIG9uIHRoZSBzb2NrZXQuIDxiciAvPlxyXG4gICAgICAgICAgICAqIFRoZSBjbGllbnQgaXMgbGlzdGVuaW5nIG9uIHRoZSBhY3Rpb24gXCJ1cGRhdGVcIiBzb2NrZXQgPC9wPlxyXG4gICAgICAgICAgICAqIEBtZXRob2QgX3NpZ25hbFVwZGF0ZVxyXG4gICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBfc2lnbmFsVXBkYXRlOiBmdW5jdGlvbiBfc2lnbmFsVXBkYXRlKCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFIuc2NvcGUoZnVuY3Rpb24ocGF0Y2gpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KFwidXBkYXRlXCIsIHBhdGNoKTtcclxuICAgICAgICAgICAgICAgIH0sIHRoaXMpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAvKiogPHA+UHVzaCBhbiBldmVudCBhY3Rpb24gb24gdGhlIHNvY2tldC4gPGJyIC8+XHJcbiAgICAgICAgICAgICogVGhlIGNsaWVudCBpcyBsaXN0ZW5pbmcgb24gdGhlIGFjdGlvbiBcImV2ZW50XCIgc29ja2V0IDwvcD5cclxuICAgICAgICAgICAgKiBAbWV0aG9kIF9zaWduYWxFdmVudFxyXG4gICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBfc2lnbmFsRXZlbnQ6IGZ1bmN0aW9uIF9zaWduYWxFdmVudChldmVudE5hbWUpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBSLnNjb3BlKGZ1bmN0aW9uKHBhcmFtcykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoXCJldmVudFwiLCB7IGV2ZW50TmFtZTogZXZlbnROYW1lLCBwYXJhbXM6IHBhcmFtcyB9KTtcclxuICAgICAgICAgICAgICAgIH0sIHRoaXMpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgKiBAbWV0aG9kIF9leHBpcmVcclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgX2V4cGlyZTogZnVuY3Rpb24gX2V4cGlyZSgpIHtcclxuICAgICAgICAgICAgICAgIF8uZWFjaChfLmtleXModGhpcy5fc3Vic2NyaXB0aW9ucyksIFIuc2NvcGUodGhpcy51bnN1YnNjcmliZUZyb20sIHRoaXMpKTtcclxuICAgICAgICAgICAgICAgIF8uZWFjaChfLmtleXModGhpcy5fbGlzdGVuZXJzKSwgUi5zY29wZSh0aGlzLnVubGlzdGVuRnJvbSwgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fc2Vzc2lvbnNFdmVudHMuZW1pdChcImV4cGlyZVwiLCB0aGlzLl9ndWlkKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICogPHA+IENyZWF0ZSBhIGxpc3RlbmVyIGZvciB0aGUgZXZlbnRzIDwvcD5cclxuICAgICAgICAgICAgKiBAbWV0aG9kIGxpc3RlblRvXHJcbiAgICAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50TmFtZSBUaGUgbmFtZSBvZiB0aGUgZXZlbnQgdGhhdCB3aWxsIGJlIHJlZ2lzdGVyZWRcclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgbGlzdGVuVG86IGZ1bmN0aW9uIGxpc3RlblRvKGV2ZW50TmFtZSkge1xyXG4gICAgICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoUi5zY29wZShmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoIV8uaGFzKHRoaXMuX2xpc3RlbmVycywga2V5KSwgXCJSLlNpbXBsZVVwbGlua1NlcnZlci5TZXNzaW9uLmxpc3RlblRvKC4uLik6IGFscmVhZHkgbGlzdGVuaW5nLlwiKTtcclxuICAgICAgICAgICAgICAgIH0sIHRoaXMpKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdID0gdGhpcy5fc2lnbmFsRXZlbnQoZXZlbnROYW1lKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c0V2ZW50cy5hZGRMaXN0ZW5lcihcImVtaXQ6XCIgKyBldmVudE5hbWUsIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICogPHA+IFJlbW92ZSBhIGxpc3RlbmVyIGZyb20gdGhlIGV2ZW50cyA8L3A+XHJcbiAgICAgICAgICAgICogQG1ldGhvZCB1bmxpc3RlbkZyb21cclxuICAgICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lIFRoZSBuYW1lIG9mIHRoZSBldmVudCB0aGF0IHdpbGwgYmUgdW5yZWdpc3RlcmVkXHJcbiAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIHVubGlzdGVuRnJvbTogZnVuY3Rpb24gdW5saXN0ZW5Gcm9tKGV2ZW50TmFtZSkge1xyXG4gICAgICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoUi5zY29wZShmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoXy5oYXModGhpcy5fbGlzdGVuZXJzLCBldmVudE5hbWUpLCBcIlIuU2ltcGxlVXBsaW5rU2VydmVyLlNlc3Npb24udW5saXN0ZW5Gcm9tKC4uLik6IG5vdCBsaXN0ZW5pbmcuXCIpO1xyXG4gICAgICAgICAgICAgICAgfSwgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzRXZlbnRzLnJlbW92ZUxpc3RlbmVyKFwiZW1pdDpcIiArIGV2ZW50TmFtZSwgdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0pO1xyXG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICB9O1xyXG5cclxuICAgIF8uZXh0ZW5kKFNpbXBsZVVwbGlua1NlcnZlci5TaW1wbGVVcGxpbmtTZXJ2ZXJJbnN0YW5jZS5wcm90b3R5cGUsIFNpbXBsZVVwbGlua1NlcnZlci5fU2ltcGxlVXBsaW5rU2VydmVySW5zdGFuY2VQcm90b1Byb3BzKTtcclxuICAgIF8uZXh0ZW5kKFNpbXBsZVVwbGlua1NlcnZlci5Db25uZWN0aW9uLnByb3RvdHlwZSwgU2ltcGxlVXBsaW5rU2VydmVyLl9Db25uZWN0aW9uUHJvdG9Qcm9wcyk7XHJcbiAgICBfLmV4dGVuZChTaW1wbGVVcGxpbmtTZXJ2ZXIuU2Vzc2lvbi5wcm90b3R5cGUsIFNpbXBsZVVwbGlua1NlcnZlci5fU2Vzc2lvblByb3RvUHJvcHMpO1xyXG5cclxuICAgIHJldHVybiBTaW1wbGVVcGxpbmtTZXJ2ZXI7XHJcbn07XHJcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==