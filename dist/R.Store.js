"use strict";

require("6to5/polyfill");
var Promise = require("bluebird");
module.exports = function (R) {
  var _ = require("lodash");
  var assert = require("assert");
  var co = require("co");

  var count = 0;

  /**
   * @memberOf R
   * R.Store is a generic, abstract Store representation. A Store is defined by its capacity to provide components with data and updates.
   * `get` will be used at getInitialState time.
   * `sub` will be invoked at componentDidMount time.
   * `unsub` will be invoked at componentWillUnmount time.
   * `sub` will trigger a deferred call to the `signalUpdate` function it is passed, so make sure it is wrapped in R.Async.IfMounted if necessary.
   * Provided implementations:
   *     - MemoryStore (Flux-like, changes are pushed via `set`)
   *     - UplinkStore (REST + updates, changes are pushed via `signalUpdate`)
   * @public
   * @class R.Store
   */
  var Store = {
    /**
     * <p> Initializes the Store according to the specifications provided </p>
     * @method createStore
     * @param {Object} specs Options to create the store.
     * @public
     * @return {R.Store.StoreInstance} StoreInstance The instance of the created StoreInstance
     */
    createStore: function createStore(specs) {
      R.Debug.dev(function () {
        assert(_.isObject(specs), "createStore(...): expecting an Object as specs.");
        assert(_.has(specs, "displayName") && _.isString(specs.displayName), "R.Store.createStore(...): requires displayName(String).");
        assert(_.has(specs, "fetch") && _.isFunction(specs.fetch), "R.Store.createStore(...): requires fetch(Function(String): Function.");
        assert(_.has(specs, "get") && _.isFunction(specs.get), "R.Store.createStore(...): requires get(Function(String): *.");
        assert(_.has(specs, "sub") && _.isFunction(specs.sub), "R.Store.createStore(...): requires sub(Function(String, Function): R.Store.Subscription).");
        assert(_.has(specs, "unsub") && _.isFunction(specs.unsub), "R.Store.createStore(...): requires unsub(Function(R.Store.Subscription).");
        assert(_.has(specs, "serialize") && _.isFunction(specs.serialize), "R.Store.createStore(...): requires serialize(): String.");
        assert(_.has(specs, "unserialize") && _.isFunction(specs.unserialize), "R.Store.createStore(...): requires unserialize(String).");
        assert(_.has(specs, "destroy") && _.isFunction(specs.destroy), "R.Store.createStore(...): requires destroy().");
      });
      /**
       * @memberOf R.Store
       * @method StoreInstance
       * @public
       * @abstract
       */
      var StoreInstance = function StoreInstance() {};
      _.extend(StoreInstance.prototype, specs, {
        /**
         * Type dirty-checking
         * @type {Boolean}
         * @private
         * @readOnly
         */
        _isStoreInstance_: true });
      return StoreInstance;
    },
    /**
     * <p> Represents a single subscription into a Store to avoid the pain of passing Functions back and forth. <br />
     * An instance of R.Store.Subscription is returned by sub and should be passed to unsub. </p>
     * @method Subscription
     * @param {string} key 
     * @public
     */
    Subscription: function Subscription(key) {
      this.uniqueId = _.uniqueId("R.Store.Subscription");
      this.key = key;
    },
    /**
     * <p> Implementation of R.Store using a traditionnal, Flux-like memory-based Store. The store is read-only from the components,<br />
     * but is writable from the toplevel using "set". Wire up to a R.Dispatcher.MemoryDispatcher to implement the canonical Flux. </p>
     * @class R.Store.MemoryStore
     * @implements {R.Store}
     */
    createMemoryStore: function createMemoryStore() {
      return function MemoryStore() {
        var _destroyed = false;
        var data = {};
        var subscribers = {};

        /**
        * <p>Fetch data according to a key</p>
        * @method fetch
        * @param {string} key The key
        * @return {Function} fn the yielded fonction
        */
        var fetch = function fetch(key) {
          return function (fn) {
            if (!_destroyed) {
              _.defer(function () {
                if (!_destroyed) {
                  fn(null, data[key]);
                }
              });
            }
          };
        };

        /**
        * <p>Return data according to a key</p>
        * @method get
        * @param {string} key The key
        * @return {Function} fn the yielded fonction
        */
        var get = function get(key) {
          R.Debug.dev(function () {
            if (!_.has(data, key)) {
              console.warn("R.Store.MemoryStore.get(...): data not available. ('" + key + "')");
            }
          });
          return data[key];
        };

        /** 
        * <p>Triggered by the set function. <br />
        * Fetch data according to the given key. <br />
        * Call the saved function contained in subscribers. </p>
        * @method signalUpdate
        * @param {string} key The key to fetch
        */
        var signalUpdate = function signalUpdate(key) {
          if (!_.has(subscribers, key)) {
            return;
          }
          co(regeneratorRuntime.mark(function callee$4$0() {
            var val;
            return regeneratorRuntime.wrap(function callee$4$0$(context$5$0) {
              while (1) switch (context$5$0.prev = context$5$0.next) {case 0:
                  context$5$0.next = 2;
                  return fetch(key);

                case 2:
                  val = context$5$0.sent;

                  _.each(subscribers[key], function (fn) {
                    if (fn) {
                      fn(val);
                    }
                  });

                case 4:
                case "end": return context$5$0.stop();
              }
            }, callee$4$0, this);
          })).call(this, "R.Store.MemoryStore.signalUpdate(...)");
        };

        /**
        * <p>Set data according to a key, then call signalUpdate in order to rerender matching React component</p>
        * @method set
        * @param {string} key The key
        * @param {object} val The val
        */
        var set = function set(key, val) {
          data[key] = val;
          signalUpdate(key);
        };

        /**
         * <p> Subscribe at a specific key </p>
         * @method sub
         * @param {string} key The specific key to subscribe
         * @param {function} _signalUpdate the function that will be call when a data corresponding to a key will be updated
         * @return {Object} subscription The saved subscription
         */
        var sub = function sub(key, _signalUpdate) {
          R.Debug.dev(function () {
            assert(!_destroyed, "R.Store.MemoryStore.sub(...): instance destroyed.");
          });
          var subscription = new R.Store.Subscription(key);
          if (!_.has(subscribers, key)) {
            subscribers[key] = {};
          }
          subscribers[key][subscription.uniqueId] = _signalUpdate;
          co(regeneratorRuntime.mark(function callee$4$0() {
            var val;
            return regeneratorRuntime.wrap(function callee$4$0$(context$5$0) {
              while (1) switch (context$5$0.prev = context$5$0.next) {case 0:
                  context$5$0.next = 2;
                  return fetch(key);

                case 2:
                  val = context$5$0.sent;

                  _.defer(function () {
                    _signalUpdate(val);
                  });

                case 4:
                case "end": return context$5$0.stop();
              }
            }, callee$4$0, this);
          })).call(this, R.Debug.rethrow("R.Store.MemoryStore.sub.fetch(...): couldn't fetch current value"));
          return subscription;
        };
        /**
        * <p>Unsubscribe</p>
        * @method unsub
        * @param {object} subscription The subscription that contains the key to unsuscribe
        */
        var unsub = function unsub(subscription) {
          R.Debug.dev(function () {
            assert(!_destroyed, "R.Store.MemoryStore.unsub(...): instance destroyed.");
            assert(subscription instanceof R.Store.Subscription, "R.Store.MemoryStore.unsub(...): type R.Store.Subscription expected.");
            assert(_.has(subscribers, subscription.key), "R.Store.MemoryStore.unsub(...): no subscribers for this key.");
            assert(_.has(subscribers[subscription.key], subscription.uniqueId), "R.Store.MemoryStore.unsub(...): no such subscription.");
          });
          delete subscribers[subscription.key][subscription.uniqueId];
          if (_.size(subscribers[subscription.key]) === 0) {
            delete subscribers[subscription.key];
          }
        };
        /**
        * <p> Clean UplinkStore store </p>
        * @method destroy
        */
        var destroy = function destroy() {
          R.Debug.dev(function () {
            assert(!_destroyed, "R.Store.MemoryStore.destroy(...): instance destroyed.");
          });
          _.each(subscribers, function (keySubscribers, key) {
            _.each(subscribers[key], function (fn, uniqueId) {
              delete subscribers[key][uniqueId];
            });
            delete subscribers[key];
          });
          subscribers = null;
          _.each(data, function (val, key) {
            delete data[key];
          });
          data = null;
          _destroyed = true;
        };
        /**
        * <p> Serialize the UplinkStore store </p>
        * @method serialize
        * @return {string} data The serialized UplinkStore store
        */
        var serialize = function serialize() {
          return JSON.stringify(data);
        };
        /**
        * <p> Unserialize the MemoryStore store </p>
        * @method unserialize
        * @param {string} str The string to unserialise
        */
        var unserialize = function unserialize(str) {
          _.extend(data, JSON.parse(str));
        };
        return new (R.Store.createStore({
          displayName: "MemoryStore",
          _data: data,
          _subscribers: subscribers,
          fetch: fetch,
          get: get,
          sub: sub,
          unsub: unsub,
          destroy: destroy,
          set: set,
          serialize: serialize,
          unserialize: unserialize }))();
      };
    },
    /**
     * <p> Implementation of R.Store using a remote, HTTP passive Store. The store is read-only from the components, <br />
     * as well as from the Client in general. However, its values may be updated across refreshes/reloads, but the remote <br />
     * backend should be wired-up with R.Dispatcher.HTTPDispatcher to implement a second-class over-the-wire Flux. </p>
     */
    createHTTPStore: function createHTTPStore() {
      return function HTTPStore(http) {
        R.Debug.dev(function () {
          assert(http.fetch && _.isFunction(http.fetch), "R.Store.createHTTPStore(...).http.fetch: expecting Function.");
        });
        var _fetch = http.fetch;
        var _destroyed = false;
        var data = {};
        var subscribers = {};
        var fetch = regeneratorRuntime.mark(function fetch(key) {
          var val;
          return regeneratorRuntime.wrap(function fetch$(context$4$0) {
            while (1) switch (context$4$0.prev = context$4$0.next) {case 0:
                context$4$0.next = 2;
                return _fetch(key);

              case 2:
                val = context$4$0.sent;

                if (_destroyed) {
                  context$4$0.next = 8;
                  break;
                }

                data[key] = val;
                return context$4$0.abrupt("return", val);

              case 8: throw new Error("R.Store.HTTPStore.fetch(...): instance destroyed.");
              case 9:
              case "end": return context$4$0.stop();
            }
          }, fetch, this);
        });

        var get = function get(key) {
          if (!_.has(data, key)) {
            console.warn("R.Store.MemoryStore.get(...): data not available. ('" + key + "')");
          }
          return data[key];
        };

        var sub = function sub(key) {
          var subscription = new R.Store.Subscription(key);
          if (!_.has(subscribers, key)) {
            subscribers[key] = {};
          }
          subscribers[key][subscription.uniqueId] = subscription;
          return subscription;
        };

        var unsub = function unsub(subscription) {
          R.Debug.dev(function () {
            assert(!_destroyed, "R.Store.UplinkStore.unsub(...): instance destroyed.");
            assert(subscription instanceof R.Store.Subscription, "R.Store.UplinkStore.unsub(...): type R.Store.Subscription expected.");
            assert(_.has(subscribers, subscription.key), "R.Store.UplinkStore.unsub(...): no subscribers for this key. ('" + subscription.key + "')");
            assert(_.has(subscribers[subscription.key], subscription.uniqueId), "R.Store.UplinkStore.unsub(...): no such subscription. ('" + subscription.key + "', '" + subscription.uniqueId + "')");
          });
          delete subscribers[subscription.key][subscription.uniqueId];
          if (_.size(subscribers[subscription.key]) === 0) {
            delete subscribers[subscription.key];
            if (_.has(data, subscription.key)) {
              delete data[subscription.key];
            }
          }
        };

        var serialize = function serialize() {
          return JSON.stringify(data);
        };

        var unserialize = function unserialize(str) {
          _.extend(data, JSON.parse(str));
        };

        var destroy = function destroy() {
          R.Debug.dev(function () {
            assert(!_destroyed, "R.Store.UplinkStore.destroy(...): instance destroyed.");
          });
          _.each(subscribers, function (keySubscribers, key) {
            _.each(subscribers[key], unsub);
          });
          _.each(data, function (val, key) {
            delete data[key];
          });
          data = null;
          subscribers = null;
          _destroyed = true;
        };

        return new (R.Store.createStore({
          displayName: "HTTPStore",
          _data: data,
          _subscribers: subscribers,
          fetch: fetch,
          get: get,
          sub: sub,
          unsub: unsub,
          serialize: serialize,
          unserialize: unserialize,
          destroy: destroy }))();
      };
    },
    /**
     * <p>Implementation of R.Store using a remote, REST-like Store. The store is read-only from the components, <br />
     * as well as from the Client in general, but the remote backend should be wired-up with R.Dispatcher.UplinkDispatcher to 
     * implement the over-the-wire Flux. </p>
     * @class R.Store.UplinkStore
     * @implements {R.Store}
     */
    createUplinkStore: function createUplinkStore() {
      return function UplinkStore(uplink) {
        R.Debug.dev(function () {
          assert(uplink.fetch && _.isFunction(uplink.fetch), "R.Store.createUplinkStore(...).uplink.fetch: expecting Function.");
          assert(uplink.subscribeTo && _.isFunction(uplink.subscribeTo), "R.Store.createUplinkStore(...).uplink.subscribeTo: expecting Function.");
          assert(uplink.unsubscribeFrom && _.isFunction(uplink.unsubscribeFrom), "R.Store.createUplinkStore(...).uplink.unsubscribeFrom: expecting Function.");
        });
        var _fetch = uplink.fetch;
        var subscribeTo = uplink.subscribeTo;
        var unsubscribeFrom = uplink.unsubscribeFrom;
        _destroyed = false;
        var data = {};
        var subscribers = {};
        var updaters = {};

        /**
        * <p>Fetch data according to a key</p>
        * @method fetch
        * @param {string} key The key
        * @return {Function} fn the yielded fonction
        */
        var fetch = regeneratorRuntime.mark(function fetch(key) {
          var val;
          return regeneratorRuntime.wrap(function fetch$(context$4$0) {
            while (1) switch (context$4$0.prev = context$4$0.next) {case 0:
                context$4$0.next = 2;
                return _fetch(key);

              case 2:
                val = context$4$0.sent;

                if (_destroyed) {
                  context$4$0.next = 8;
                  break;
                }

                data[key] = val;
                return context$4$0.abrupt("return", val);

              case 8: throw new Error("R.Store.UplinkStore.fetch(...): instance destroyed.");
              case 9:
              case "end": return context$4$0.stop();
            }
          }, fetch, this);
        });
        var get = function get(key) {
          R.Debug.dev(function () {
            if (!_.has(data, key)) {
              console.warn("R.Store.UplinkStore.get(...): data not available. ('" + key + "')");
            }
          });
          return data[key];
        };
        /** 
        * <p>Triggered by the socket.on("update") event in R.Uplink <br />
        * Fetch data according to the given key <br />
        * Call the saved function contained in subscribers </p>
        * @method signalUpdate
        * @param {string} key The key to fetch
        */
        var signalUpdate = function signalUpdate(key, val) {
          if (!_.has(subscribers, key)) {
            return;
          }
          _.each(subscribers[key], function (fn, uniqueId) {
            if (fn) {
              fn(val);
            }
          });
        };
        /**
         * <p> Subscribe at a specific key </p>
         * @method sub
         * @param {string} key The specific key to subscribe
         * @param {function} _signalUpdate the function that will be call when a data corresponding to a key will be updated
         * @return {Object} subscription The saved subscription
         */
        var sub = function sub(key, _signalUpdate) {
          R.Debug.dev(function () {
            assert(!_destroyed, "R.Store.UplinkStore.sub(...): instance destroyed. ('" + key + "')");
          });
          var subscription = new R.Store.Subscription(key);
          if (!_.has(subscribers, key)) {
            subscribers[key] = {};
            // call subscribeTo from R.Uplink => emit "subscribeTo" signal
            updaters[key] = subscribeTo(key, signalUpdate);
          }
          subscribers[key][subscription.uniqueId] = _signalUpdate;
          co(regeneratorRuntime.mark(function callee$4$0() {
            var val;
            return regeneratorRuntime.wrap(function callee$4$0$(context$5$0) {
              while (1) switch (context$5$0.prev = context$5$0.next) {case 0:
                  context$5$0.next = 2;
                  return fetch(key);

                case 2:
                  val = context$5$0.sent;

                  _.defer(function () {
                    _signalUpdate(val);
                  });

                case 4:
                case "end": return context$5$0.stop();
              }
            }, callee$4$0, this);
          })).call(this, R.Debug.rethrow("R.Store.sub.fetch(...): data not available. ('" + key + "')"));
          return subscription;
        };
        /**
        * <p> Unsubscribe</p>
        * @method unsub
        * @param {object} subscription The subscription that contains the key to unsuscribe
        */
        var unsub = function unsub(subscription) {
          R.Debug.dev(function () {
            assert(!_destroyed, "R.Store.UplinkStore.unsub(...): instance destroyed.");
            assert(subscription instanceof R.Store.Subscription, "R.Store.UplinkStore.unsub(...): type R.Store.Subscription expected.");
            assert(_.has(subscribers, subscription.key), "R.Store.UplinkStore.unsub(...): no subscribers for this key. ('" + subscription.key + "')");
            assert(_.has(subscribers[subscription.key], subscription.uniqueId), "R.Store.UplinkStore.unsub(...): no such subscription. ('" + subscription.key + "', '" + subscription.uniqueId + "')");
          });
          delete subscribers[subscription.key][subscription.uniqueId];
          if (_.size(subscribers[subscription.key]) === 0) {
            unsubscribeFrom(subscription.key, updaters[subscription.key]);
            delete subscribers[subscription.key];
            delete updaters[subscription.key];
            if (_.has(data, subscription.key)) {
              delete data[subscription.key];
            }
          }
        };

        /**
        * <p> Serialize the UplinkStore store </p>
        * @method serialize
        * @return {string} data The serialized UplinkStore store
        */
        var serialize = function serialize() {
          return JSON.stringify(data);
        };

        /**
        * <p> Unserialize the UplinkStore store </p>
        * @method unserialize
        * @param {string} str The string to unserialise
        */
        var unserialize = function unserialize(str) {
          _.extend(data, JSON.parse(str));
        };

        /**
        * <p> Clean UplinkStore store </p>
        * @method destroy
        */
        var destroy = function destroy() {
          R.Debug.dev(function () {
            assert(!_destroyed, "R.Store.UplinkStore.destroy(...): instance destroyed.");
          });
          _.each(subscribers, function (keySubscribers, key) {
            _.each(subscribers[key], unsub);
          });
          _.each(data, function (val, key) {
            delete data[key];
          });
          data = null;
          subscribers = null;
          updaters = null;
          _destroyed = true;
        };
        return new (R.Store.createStore({
          displayName: "UplinkStore",
          _data: data,
          _subscribers: subscribers,
          _updaters: updaters,
          fetch: fetch,
          get: get,
          sub: sub,
          unsub: unsub,
          signalUpdate: signalUpdate,
          serialize: serialize,
          unserialize: unserialize,
          destroy: destroy }))();
      };
    } };

  _.extend(Store.Subscription.prototype, /** @lends R.Store.Subscription */{
    /**
     * @public
     * @readOnly
     * @type {String}
     */
    uniqueId: null,
    /**
     * @public
     * @readOnly
     * @type {String}
     */
    key: null });

  return Store;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImQ6L3dvcmtzcGFjZV9yZWZhY3Rvci9yZWFjdC1yYWlscy9zcmMvUi5TdG9yZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUN6QixJQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDcEMsTUFBTSxDQUFDLE9BQU8sR0FBRyxVQUFTLENBQUMsRUFBRTtBQUN6QixNQUFJLENBQUMsR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDMUIsTUFBSSxNQUFNLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQy9CLE1BQUksRUFBRSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQzs7QUFFdkIsTUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDOzs7Ozs7Ozs7Ozs7Ozs7QUFlZCxNQUFJLEtBQUssR0FBRzs7Ozs7Ozs7QUFRUixlQUFXLEVBQUUsU0FBUyxXQUFXLENBQUMsS0FBSyxFQUFFO0FBQ3JDLE9BQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFlBQVc7QUFDbkIsY0FBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEVBQUUsaURBQWlELENBQUMsQ0FBQztBQUM3RSxjQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLEVBQUUseURBQXlELENBQUMsQ0FBQztBQUNoSSxjQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEVBQUUsc0VBQXNFLENBQUMsQ0FBQztBQUNuSSxjQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUs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Q0FBQztBQUNaLHFCQUFXLEdBQUcsSUFBSSxDQUFDO0FBQ25CLGtCQUFRLEdBQUcsSUFBSSxDQUFDO0FBQ2hCLG9CQUFVLEdBQUcsSUFBSSxDQUFDO1NBQ3JCLENBQUM7QUFDRixlQUFPLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQztBQUM1QixxQkFBVyxFQUFFLGFBQWE7QUFDMUIsZUFBSyxFQUFFLElBQUk7QUFDWCxzQkFBWSxFQUFFLFdBQVc7QUFDekIsbUJBQVMsRUFBRSxRQUFRO0FBQ25CLGVBQUssRUFBRSxLQUFLO0FBQ1osYUFBRyxFQUFFLEdBQUc7QUFDUixhQUFHLEVBQUUsR0FBRztBQUNSLGVBQUssRUFBRSxLQUFLO0FBQ1osc0JBQVksRUFBRSxZQUFZO0FBQzFCLG1CQUFTLEVBQUUsU0FBUztBQUNwQixxQkFBVyxFQUFFLFdBQVc7QUFDeEIsaUJBQU8sRUFBRSxPQUFPLEVBQ25CLENBQUMsQ0FBQyxFQUFFLENBQUM7T0FDVCxDQUFDO0tBQ0wsRUFDSixDQUFDOztBQUVGLEdBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxTQUFTLG9DQUFvQzs7Ozs7O0FBTXJFLFlBQVEsRUFBRSxJQUFJOzs7Ozs7QUFNZCxPQUFHLEVBQUUsSUFBSSxFQUNaLENBQUMsQ0FBQzs7QUFFSCxTQUFPLEtBQUssQ0FBQztDQUNoQixDQUFDIiwiZmlsZSI6IlIuU3RvcmUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJyZXF1aXJlKCc2dG81L3BvbHlmaWxsJyk7XG5jb25zdCBQcm9taXNlID0gcmVxdWlyZSgnYmx1ZWJpcmQnKTtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oUikge1xyXG4gICAgdmFyIF8gPSByZXF1aXJlKFwibG9kYXNoXCIpO1xyXG4gICAgdmFyIGFzc2VydCA9IHJlcXVpcmUoXCJhc3NlcnRcIik7XHJcbiAgICB2YXIgY28gPSByZXF1aXJlKFwiY29cIik7XHJcblxyXG4gICAgdmFyIGNvdW50ID0gMDtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEBtZW1iZXJPZiBSXHJcbiAgICAgKiBSLlN0b3JlIGlzIGEgZ2VuZXJpYywgYWJzdHJhY3QgU3RvcmUgcmVwcmVzZW50YXRpb24uIEEgU3RvcmUgaXMgZGVmaW5lZCBieSBpdHMgY2FwYWNpdHkgdG8gcHJvdmlkZSBjb21wb25lbnRzIHdpdGggZGF0YSBhbmQgdXBkYXRlcy5cclxuICAgICAqIGBnZXRgIHdpbGwgYmUgdXNlZCBhdCBnZXRJbml0aWFsU3RhdGUgdGltZS5cclxuICAgICAqIGBzdWJgIHdpbGwgYmUgaW52b2tlZCBhdCBjb21wb25lbnREaWRNb3VudCB0aW1lLlxyXG4gICAgICogYHVuc3ViYCB3aWxsIGJlIGludm9rZWQgYXQgY29tcG9uZW50V2lsbFVubW91bnQgdGltZS5cclxuICAgICAqIGBzdWJgIHdpbGwgdHJpZ2dlciBhIGRlZmVycmVkIGNhbGwgdG8gdGhlIGBzaWduYWxVcGRhdGVgIGZ1bmN0aW9uIGl0IGlzIHBhc3NlZCwgc28gbWFrZSBzdXJlIGl0IGlzIHdyYXBwZWQgaW4gUi5Bc3luYy5JZk1vdW50ZWQgaWYgbmVjZXNzYXJ5LlxyXG4gICAgICogUHJvdmlkZWQgaW1wbGVtZW50YXRpb25zOlxyXG4gICAgICogICAgIC0gTWVtb3J5U3RvcmUgKEZsdXgtbGlrZSwgY2hhbmdlcyBhcmUgcHVzaGVkIHZpYSBgc2V0YClcclxuICAgICAqICAgICAtIFVwbGlua1N0b3JlIChSRVNUICsgdXBkYXRlcywgY2hhbmdlcyBhcmUgcHVzaGVkIHZpYSBgc2lnbmFsVXBkYXRlYClcclxuICAgICAqIEBwdWJsaWNcclxuICAgICAqIEBjbGFzcyBSLlN0b3JlXHJcbiAgICAgKi9cclxuICAgIHZhciBTdG9yZSA9IHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiA8cD4gSW5pdGlhbGl6ZXMgdGhlIFN0b3JlIGFjY29yZGluZyB0byB0aGUgc3BlY2lmaWNhdGlvbnMgcHJvdmlkZWQgPC9wPlxyXG4gICAgICAgICAqIEBtZXRob2QgY3JlYXRlU3RvcmVcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gc3BlY3MgT3B0aW9ucyB0byBjcmVhdGUgdGhlIHN0b3JlLlxyXG4gICAgICAgICAqIEBwdWJsaWNcclxuICAgICAgICAgKiBAcmV0dXJuIHtSLlN0b3JlLlN0b3JlSW5zdGFuY2V9IFN0b3JlSW5zdGFuY2UgVGhlIGluc3RhbmNlIG9mIHRoZSBjcmVhdGVkIFN0b3JlSW5zdGFuY2VcclxuICAgICAgICAgKi9cclxuICAgICAgICBjcmVhdGVTdG9yZTogZnVuY3Rpb24gY3JlYXRlU3RvcmUoc3BlY3MpIHtcclxuICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICBhc3NlcnQoXy5pc09iamVjdChzcGVjcyksIFwiY3JlYXRlU3RvcmUoLi4uKTogZXhwZWN0aW5nIGFuIE9iamVjdCBhcyBzcGVjcy5cIik7XHJcbiAgICAgICAgICAgICAgICBhc3NlcnQoXy5oYXMoc3BlY3MsIFwiZGlzcGxheU5hbWVcIikgJiYgXy5pc1N0cmluZyhzcGVjcy5kaXNwbGF5TmFtZSksIFwiUi5TdG9yZS5jcmVhdGVTdG9yZSguLi4pOiByZXF1aXJlcyBkaXNwbGF5TmFtZShTdHJpbmcpLlwiKTtcclxuICAgICAgICAgICAgICAgIGFzc2VydChfLmhhcyhzcGVjcywgXCJmZXRjaFwiKSAmJiBfLmlzRnVuY3Rpb24oc3BlY3MuZmV0Y2gpLCBcIlIuU3RvcmUuY3JlYXRlU3RvcmUoLi4uKTogcmVxdWlyZXMgZmV0Y2goRnVuY3Rpb24oU3RyaW5nKTogRnVuY3Rpb24uXCIpO1xyXG4gICAgICAgICAgICAgICAgYXNzZXJ0KF8uaGFzKHNwZWNzLCBcImdldFwiKSAmJiBfLmlzRnVuY3Rpb24oc3BlY3MuZ2V0KSwgXCJSLlN0b3JlLmNyZWF0ZVN0b3JlKC4uLik6IHJlcXVpcmVzIGdldChGdW5jdGlvbihTdHJpbmcpOiAqLlwiKTtcclxuICAgICAgICAgICAgICAgIGFzc2VydChfLmhhcyhzcGVjcywgXCJzdWJcIikgJiYgXy5pc0Z1bmN0aW9uKHNwZWNzLnN1YiksIFwiUi5TdG9yZS5jcmVhdGVTdG9yZSguLi4pOiByZXF1aXJlcyBzdWIoRnVuY3Rpb24oU3RyaW5nLCBGdW5jdGlvbik6IFIuU3RvcmUuU3Vic2NyaXB0aW9uKS5cIik7XHJcbiAgICAgICAgICAgICAgICBhc3NlcnQoXy5oYXMoc3BlY3MsIFwidW5zdWJcIikgJiYgXy5pc0Z1bmN0aW9uKHNwZWNzLnVuc3ViKSwgXCJSLlN0b3JlLmNyZWF0ZVN0b3JlKC4uLik6IHJlcXVpcmVzIHVuc3ViKEZ1bmN0aW9uKFIuU3RvcmUuU3Vic2NyaXB0aW9uKS5cIik7XHJcbiAgICAgICAgICAgICAgICBhc3NlcnQoXy5oYXMoc3BlY3MsIFwic2VyaWFsaXplXCIpICYmIF8uaXNGdW5jdGlvbihzcGVjcy5zZXJpYWxpemUpLCBcIlIuU3RvcmUuY3JlYXRlU3RvcmUoLi4uKTogcmVxdWlyZXMgc2VyaWFsaXplKCk6IFN0cmluZy5cIik7XHJcbiAgICAgICAgICAgICAgICBhc3NlcnQoXy5oYXMoc3BlY3MsIFwidW5zZXJpYWxpemVcIikgJiYgXy5pc0Z1bmN0aW9uKHNwZWNzLnVuc2VyaWFsaXplKSwgXCJSLlN0b3JlLmNyZWF0ZVN0b3JlKC4uLik6IHJlcXVpcmVzIHVuc2VyaWFsaXplKFN0cmluZykuXCIpO1xyXG4gICAgICAgICAgICAgICAgYXNzZXJ0KF8uaGFzKHNwZWNzLCBcImRlc3Ryb3lcIikgJiYgXy5pc0Z1bmN0aW9uKHNwZWNzLmRlc3Ryb3kpLCBcIlIuU3RvcmUuY3JlYXRlU3RvcmUoLi4uKTogcmVxdWlyZXMgZGVzdHJveSgpLlwiKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgKiBAbWVtYmVyT2YgUi5TdG9yZVxyXG4gICAgICAgICAgICAgKiBAbWV0aG9kIFN0b3JlSW5zdGFuY2VcclxuICAgICAgICAgICAgICogQHB1YmxpY1xyXG4gICAgICAgICAgICAgKiBAYWJzdHJhY3RcclxuICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIHZhciBTdG9yZUluc3RhbmNlID0gZnVuY3Rpb24gU3RvcmVJbnN0YW5jZSgpIHt9O1xyXG4gICAgICAgICAgICBfLmV4dGVuZChTdG9yZUluc3RhbmNlLnByb3RvdHlwZSwgc3BlY3MsIHtcclxuICAgICAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgICAgICogVHlwZSBkaXJ0eS1jaGVja2luZ1xyXG4gICAgICAgICAgICAgICAgICogQHR5cGUge0Jvb2xlYW59XHJcbiAgICAgICAgICAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICAgICAgICAgICogQHJlYWRPbmx5XHJcbiAgICAgICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgICAgIF9pc1N0b3JlSW5zdGFuY2VfOiB0cnVlLFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuIFN0b3JlSW5zdGFuY2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiA8cD4gUmVwcmVzZW50cyBhIHNpbmdsZSBzdWJzY3JpcHRpb24gaW50byBhIFN0b3JlIHRvIGF2b2lkIHRoZSBwYWluIG9mIHBhc3NpbmcgRnVuY3Rpb25zIGJhY2sgYW5kIGZvcnRoLiA8YnIgLz5cclxuICAgICAgICAgKiBBbiBpbnN0YW5jZSBvZiBSLlN0b3JlLlN1YnNjcmlwdGlvbiBpcyByZXR1cm5lZCBieSBzdWIgYW5kIHNob3VsZCBiZSBwYXNzZWQgdG8gdW5zdWIuIDwvcD5cclxuICAgICAgICAgKiBAbWV0aG9kIFN1YnNjcmlwdGlvblxyXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgXHJcbiAgICAgICAgICogQHB1YmxpY1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIFN1YnNjcmlwdGlvbjogZnVuY3Rpb24gU3Vic2NyaXB0aW9uKGtleSkge1xyXG4gICAgICAgICAgICB0aGlzLnVuaXF1ZUlkID0gXy51bmlxdWVJZChcIlIuU3RvcmUuU3Vic2NyaXB0aW9uXCIpO1xyXG4gICAgICAgICAgICB0aGlzLmtleSA9IGtleTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIDxwPiBJbXBsZW1lbnRhdGlvbiBvZiBSLlN0b3JlIHVzaW5nIGEgdHJhZGl0aW9ubmFsLCBGbHV4LWxpa2UgbWVtb3J5LWJhc2VkIFN0b3JlLiBUaGUgc3RvcmUgaXMgcmVhZC1vbmx5IGZyb20gdGhlIGNvbXBvbmVudHMsPGJyIC8+XHJcbiAgICAgICAgICogYnV0IGlzIHdyaXRhYmxlIGZyb20gdGhlIHRvcGxldmVsIHVzaW5nIFwic2V0XCIuIFdpcmUgdXAgdG8gYSBSLkRpc3BhdGNoZXIuTWVtb3J5RGlzcGF0Y2hlciB0byBpbXBsZW1lbnQgdGhlIGNhbm9uaWNhbCBGbHV4LiA8L3A+XHJcbiAgICAgICAgICogQGNsYXNzIFIuU3RvcmUuTWVtb3J5U3RvcmVcclxuICAgICAgICAgKiBAaW1wbGVtZW50cyB7Ui5TdG9yZX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBjcmVhdGVNZW1vcnlTdG9yZTogZnVuY3Rpb24gY3JlYXRlTWVtb3J5U3RvcmUoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiBNZW1vcnlTdG9yZSgpIHtcclxuICAgICAgICAgICAgICAgIHZhciBfZGVzdHJveWVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB2YXIgZGF0YSA9IHt9O1xyXG4gICAgICAgICAgICAgICAgdmFyIHN1YnNjcmliZXJzID0ge307XHJcblxyXG4gICAgICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAgICAqIDxwPkZldGNoIGRhdGEgYWNjb3JkaW5nIHRvIGEga2V5PC9wPlxyXG4gICAgICAgICAgICAgICAgKiBAbWV0aG9kIGZldGNoXHJcbiAgICAgICAgICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleVxyXG4gICAgICAgICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn0gZm4gdGhlIHlpZWxkZWQgZm9uY3Rpb25cclxuICAgICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgICAgICB2YXIgZmV0Y2ggPSBmdW5jdGlvbiBmZXRjaChrZXkpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYoIV9kZXN0cm95ZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF8uZGVmZXIoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoIV9kZXN0cm95ZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm4obnVsbCwgZGF0YVtrZXldKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgICAgKiA8cD5SZXR1cm4gZGF0YSBhY2NvcmRpbmcgdG8gYSBrZXk8L3A+XHJcbiAgICAgICAgICAgICAgICAqIEBtZXRob2QgZ2V0XHJcbiAgICAgICAgICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleVxyXG4gICAgICAgICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn0gZm4gdGhlIHlpZWxkZWQgZm9uY3Rpb25cclxuICAgICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgICAgICB2YXIgZ2V0ID0gZnVuY3Rpb24gZ2V0KGtleSkge1xyXG4gICAgICAgICAgICAgICAgICAgIFIuRGVidWcuZGV2KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZighXy5oYXMoZGF0YSwga2V5KSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiUi5TdG9yZS5NZW1vcnlTdG9yZS5nZXQoLi4uKTogZGF0YSBub3QgYXZhaWxhYmxlLiAoJ1wiICsga2V5ICsgXCInKVwiKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBkYXRhW2tleV07XHJcbiAgICAgICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgICAgIC8qKiBcclxuICAgICAgICAgICAgICAgICogPHA+VHJpZ2dlcmVkIGJ5IHRoZSBzZXQgZnVuY3Rpb24uIDxiciAvPlxyXG4gICAgICAgICAgICAgICAgKiBGZXRjaCBkYXRhIGFjY29yZGluZyB0byB0aGUgZ2l2ZW4ga2V5LiA8YnIgLz5cclxuICAgICAgICAgICAgICAgICogQ2FsbCB0aGUgc2F2ZWQgZnVuY3Rpb24gY29udGFpbmVkIGluIHN1YnNjcmliZXJzLiA8L3A+XHJcbiAgICAgICAgICAgICAgICAqIEBtZXRob2Qgc2lnbmFsVXBkYXRlXHJcbiAgICAgICAgICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSB0byBmZXRjaFxyXG4gICAgICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgICAgIHZhciBzaWduYWxVcGRhdGUgPSBmdW5jdGlvbiBzaWduYWxVcGRhdGUoa2V5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYoIV8uaGFzKHN1YnNjcmliZXJzLCBrZXkpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgY28oZnVuY3Rpb24qKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsID0geWllbGQgZmV0Y2goa2V5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgXy5lYWNoKHN1YnNjcmliZXJzW2tleV0sIGZ1bmN0aW9uKGZuKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihmbikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZuKHZhbCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pLmNhbGwodGhpcywgXCJSLlN0b3JlLk1lbW9yeVN0b3JlLnNpZ25hbFVwZGF0ZSguLi4pXCIpO1xyXG4gICAgICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICAgICogPHA+U2V0IGRhdGEgYWNjb3JkaW5nIHRvIGEga2V5LCB0aGVuIGNhbGwgc2lnbmFsVXBkYXRlIGluIG9yZGVyIHRvIHJlcmVuZGVyIG1hdGNoaW5nIFJlYWN0IGNvbXBvbmVudDwvcD5cclxuICAgICAgICAgICAgICAgICogQG1ldGhvZCBzZXRcclxuICAgICAgICAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5XHJcbiAgICAgICAgICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSB2YWwgVGhlIHZhbFxyXG4gICAgICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgICAgIHZhciBzZXQgPSBmdW5jdGlvbiBzZXQoa2V5LCB2YWwpIHtcclxuICAgICAgICAgICAgICAgICAgICBkYXRhW2tleV0gPSB2YWw7XHJcbiAgICAgICAgICAgICAgICAgICAgc2lnbmFsVXBkYXRlKGtleSk7XHJcbiAgICAgICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAgICAqIDxwPiBTdWJzY3JpYmUgYXQgYSBzcGVjaWZpYyBrZXkgPC9wPlxyXG4gICAgICAgICAgICAgICAgKiBAbWV0aG9kIHN1YlxyXG4gICAgICAgICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBzcGVjaWZpYyBrZXkgdG8gc3Vic2NyaWJlXHJcbiAgICAgICAgICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IF9zaWduYWxVcGRhdGUgdGhlIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsIHdoZW4gYSBkYXRhIGNvcnJlc3BvbmRpbmcgdG8gYSBrZXkgd2lsbCBiZSB1cGRhdGVkXHJcbiAgICAgICAgICAgICAgICAqIEByZXR1cm4ge09iamVjdH0gc3Vic2NyaXB0aW9uIFRoZSBzYXZlZCBzdWJzY3JpcHRpb25cclxuICAgICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgICAgICB2YXIgc3ViID0gZnVuY3Rpb24gc3ViKGtleSwgX3NpZ25hbFVwZGF0ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIFIuRGVidWcuZGV2KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NlcnQoIV9kZXN0cm95ZWQsIFwiUi5TdG9yZS5NZW1vcnlTdG9yZS5zdWIoLi4uKTogaW5zdGFuY2UgZGVzdHJveWVkLlwiKTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgc3Vic2NyaXB0aW9uID0gbmV3IFIuU3RvcmUuU3Vic2NyaXB0aW9uKGtleSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYoIV8uaGFzKHN1YnNjcmliZXJzLCBrZXkpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1YnNjcmliZXJzW2tleV0gPSB7fTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgc3Vic2NyaWJlcnNba2V5XVtzdWJzY3JpcHRpb24udW5pcXVlSWRdID0gX3NpZ25hbFVwZGF0ZTtcclxuICAgICAgICAgICAgICAgICAgICBjbyhmdW5jdGlvbiooKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB2YWwgPSB5aWVsZCBmZXRjaChrZXkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBfLmRlZmVyKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX3NpZ25hbFVwZGF0ZSh2YWwpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICB9KS5jYWxsKHRoaXMsIFIuRGVidWcucmV0aHJvdyhcIlIuU3RvcmUuTWVtb3J5U3RvcmUuc3ViLmZldGNoKC4uLik6IGNvdWxkbid0IGZldGNoIGN1cnJlbnQgdmFsdWVcIikpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWJzY3JpcHRpb247XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAgICAqIDxwPlVuc3Vic2NyaWJlPC9wPlxyXG4gICAgICAgICAgICAgICAgKiBAbWV0aG9kIHVuc3ViXHJcbiAgICAgICAgICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBzdWJzY3JpcHRpb24gVGhlIHN1YnNjcmlwdGlvbiB0aGF0IGNvbnRhaW5zIHRoZSBrZXkgdG8gdW5zdXNjcmliZVxyXG4gICAgICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgICAgIHZhciB1bnN1YiA9IGZ1bmN0aW9uIHVuc3ViKHN1YnNjcmlwdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIFIuRGVidWcuZGV2KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NlcnQoIV9kZXN0cm95ZWQsIFwiUi5TdG9yZS5NZW1vcnlTdG9yZS51bnN1YiguLi4pOiBpbnN0YW5jZSBkZXN0cm95ZWQuXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NlcnQoc3Vic2NyaXB0aW9uIGluc3RhbmNlb2YgUi5TdG9yZS5TdWJzY3JpcHRpb24sIFwiUi5TdG9yZS5NZW1vcnlTdG9yZS51bnN1YiguLi4pOiB0eXBlIFIuU3RvcmUuU3Vic2NyaXB0aW9uIGV4cGVjdGVkLlwiKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KF8uaGFzKHN1YnNjcmliZXJzLCBzdWJzY3JpcHRpb24ua2V5KSwgXCJSLlN0b3JlLk1lbW9yeVN0b3JlLnVuc3ViKC4uLik6IG5vIHN1YnNjcmliZXJzIGZvciB0aGlzIGtleS5cIik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2VydChfLmhhcyhzdWJzY3JpYmVyc1tzdWJzY3JpcHRpb24ua2V5XSwgc3Vic2NyaXB0aW9uLnVuaXF1ZUlkKSwgXCJSLlN0b3JlLk1lbW9yeVN0b3JlLnVuc3ViKC4uLik6IG5vIHN1Y2ggc3Vic2NyaXB0aW9uLlwiKTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICBkZWxldGUgc3Vic2NyaWJlcnNbc3Vic2NyaXB0aW9uLmtleV1bc3Vic2NyaXB0aW9uLnVuaXF1ZUlkXTtcclxuICAgICAgICAgICAgICAgICAgICBpZihfLnNpemUoc3Vic2NyaWJlcnNbc3Vic2NyaXB0aW9uLmtleV0pID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBzdWJzY3JpYmVyc1tzdWJzY3JpcHRpb24ua2V5XTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAgICAqIDxwPiBDbGVhbiBVcGxpbmtTdG9yZSBzdG9yZSA8L3A+XHJcbiAgICAgICAgICAgICAgICAqIEBtZXRob2QgZGVzdHJveVxyXG4gICAgICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgICAgIHZhciBkZXN0cm95ID0gZnVuY3Rpb24gZGVzdHJveSgpIHtcclxuICAgICAgICAgICAgICAgICAgICBSLkRlYnVnLmRldihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KCFfZGVzdHJveWVkLCBcIlIuU3RvcmUuTWVtb3J5U3RvcmUuZGVzdHJveSguLi4pOiBpbnN0YW5jZSBkZXN0cm95ZWQuXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIF8uZWFjaChzdWJzY3JpYmVycywgZnVuY3Rpb24oa2V5U3Vic2NyaWJlcnMsIGtleSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBfLmVhY2goc3Vic2NyaWJlcnNba2V5XSwgZnVuY3Rpb24oZm4sIHVuaXF1ZUlkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgc3Vic2NyaWJlcnNba2V5XVt1bmlxdWVJZF07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgc3Vic2NyaWJlcnNba2V5XTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICBzdWJzY3JpYmVycyA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgXy5lYWNoKGRhdGEsIGZ1bmN0aW9uKHZhbCwga2V5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBkYXRhW2tleV07XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YSA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgX2Rlc3Ryb3llZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAgICAqIDxwPiBTZXJpYWxpemUgdGhlIFVwbGlua1N0b3JlIHN0b3JlIDwvcD5cclxuICAgICAgICAgICAgICAgICogQG1ldGhvZCBzZXJpYWxpemVcclxuICAgICAgICAgICAgICAgICogQHJldHVybiB7c3RyaW5nfSBkYXRhIFRoZSBzZXJpYWxpemVkIFVwbGlua1N0b3JlIHN0b3JlXHJcbiAgICAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICAgICAgdmFyIHNlcmlhbGl6ZSA9IGZ1bmN0aW9uIHNlcmlhbGl6ZSgpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZGF0YSk7XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAgICAqIDxwPiBVbnNlcmlhbGl6ZSB0aGUgTWVtb3J5U3RvcmUgc3RvcmUgPC9wPlxyXG4gICAgICAgICAgICAgICAgKiBAbWV0aG9kIHVuc2VyaWFsaXplXHJcbiAgICAgICAgICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzdHIgVGhlIHN0cmluZyB0byB1bnNlcmlhbGlzZVxyXG4gICAgICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgICAgIHZhciB1bnNlcmlhbGl6ZSA9IGZ1bmN0aW9uIHVuc2VyaWFsaXplKHN0cikge1xyXG4gICAgICAgICAgICAgICAgICAgIF8uZXh0ZW5kKGRhdGEsIEpTT04ucGFyc2Uoc3RyKSk7XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyAoUi5TdG9yZS5jcmVhdGVTdG9yZSh7XHJcbiAgICAgICAgICAgICAgICAgICAgZGlzcGxheU5hbWU6IFwiTWVtb3J5U3RvcmVcIixcclxuICAgICAgICAgICAgICAgICAgICBfZGF0YTogZGF0YSxcclxuICAgICAgICAgICAgICAgICAgICBfc3Vic2NyaWJlcnM6IHN1YnNjcmliZXJzLFxyXG4gICAgICAgICAgICAgICAgICAgIGZldGNoOiBmZXRjaCxcclxuICAgICAgICAgICAgICAgICAgICBnZXQ6IGdldCxcclxuICAgICAgICAgICAgICAgICAgICBzdWI6IHN1YixcclxuICAgICAgICAgICAgICAgICAgICB1bnN1YjogdW5zdWIsXHJcbiAgICAgICAgICAgICAgICAgICAgZGVzdHJveTogZGVzdHJveSxcclxuICAgICAgICAgICAgICAgICAgICBzZXQ6IHNldCxcclxuICAgICAgICAgICAgICAgICAgICBzZXJpYWxpemU6IHNlcmlhbGl6ZSxcclxuICAgICAgICAgICAgICAgICAgICB1bnNlcmlhbGl6ZTogdW5zZXJpYWxpemUsXHJcbiAgICAgICAgICAgICAgICB9KSkoKTtcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiA8cD4gSW1wbGVtZW50YXRpb24gb2YgUi5TdG9yZSB1c2luZyBhIHJlbW90ZSwgSFRUUCBwYXNzaXZlIFN0b3JlLiBUaGUgc3RvcmUgaXMgcmVhZC1vbmx5IGZyb20gdGhlIGNvbXBvbmVudHMsIDxiciAvPlxyXG4gICAgICAgICAqIGFzIHdlbGwgYXMgZnJvbSB0aGUgQ2xpZW50IGluIGdlbmVyYWwuIEhvd2V2ZXIsIGl0cyB2YWx1ZXMgbWF5IGJlIHVwZGF0ZWQgYWNyb3NzIHJlZnJlc2hlcy9yZWxvYWRzLCBidXQgdGhlIHJlbW90ZSA8YnIgLz5cclxuICAgICAgICAgKiBiYWNrZW5kIHNob3VsZCBiZSB3aXJlZC11cCB3aXRoIFIuRGlzcGF0Y2hlci5IVFRQRGlzcGF0Y2hlciB0byBpbXBsZW1lbnQgYSBzZWNvbmQtY2xhc3Mgb3Zlci10aGUtd2lyZSBGbHV4LiA8L3A+XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgY3JlYXRlSFRUUFN0b3JlOiBmdW5jdGlvbiBjcmVhdGVIVFRQU3RvcmUoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiBIVFRQU3RvcmUoaHR0cCkge1xyXG4gICAgICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KGh0dHAuZmV0Y2ggJiYgXy5pc0Z1bmN0aW9uKGh0dHAuZmV0Y2gpLCBcIlIuU3RvcmUuY3JlYXRlSFRUUFN0b3JlKC4uLikuaHR0cC5mZXRjaDogZXhwZWN0aW5nIEZ1bmN0aW9uLlwiKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgdmFyIF9mZXRjaCA9IGh0dHAuZmV0Y2g7XHJcbiAgICAgICAgICAgICAgICB2YXIgX2Rlc3Ryb3llZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgdmFyIGRhdGEgPSB7fTtcclxuICAgICAgICAgICAgICAgIHZhciBzdWJzY3JpYmVycyA9IHt9O1xyXG4gICAgICAgICAgICAgICAgdmFyIGZldGNoID0gZnVuY3Rpb24qIGZldGNoKGtleSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB2YWwgPSB5aWVsZCBfZmV0Y2goa2V5KTtcclxuICAgICAgICAgICAgICAgICAgICBpZighX2Rlc3Ryb3llZCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhW2tleV0gPSB2YWw7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB2YWw7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJSLlN0b3JlLkhUVFBTdG9yZS5mZXRjaCguLi4pOiBpbnN0YW5jZSBkZXN0cm95ZWQuXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICAgICAgdmFyIGdldCA9IGZ1bmN0aW9uIGdldChrZXkpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZighXy5oYXMoZGF0YSwga2V5KSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJSLlN0b3JlLk1lbW9yeVN0b3JlLmdldCguLi4pOiBkYXRhIG5vdCBhdmFpbGFibGUuICgnXCIgKyBrZXkgKyBcIicpXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVtrZXldO1xyXG4gICAgICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgc3ViID0gZnVuY3Rpb24gc3ViKGtleSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBzdWJzY3JpcHRpb24gPSBuZXcgUi5TdG9yZS5TdWJzY3JpcHRpb24oa2V5KTtcclxuICAgICAgICAgICAgICAgICAgICBpZighXy5oYXMoc3Vic2NyaWJlcnMsIGtleSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3Vic2NyaWJlcnNba2V5XSA9IHt9O1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBzdWJzY3JpYmVyc1trZXldW3N1YnNjcmlwdGlvbi51bmlxdWVJZF0gPSBzdWJzY3JpcHRpb247XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1YnNjcmlwdGlvbjtcclxuICAgICAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICAgICAgdmFyIHVuc3ViID0gZnVuY3Rpb24gdW5zdWIoc3Vic2NyaXB0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2VydCghX2Rlc3Ryb3llZCwgXCJSLlN0b3JlLlVwbGlua1N0b3JlLnVuc3ViKC4uLik6IGluc3RhbmNlIGRlc3Ryb3llZC5cIik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2VydChzdWJzY3JpcHRpb24gaW5zdGFuY2VvZiBSLlN0b3JlLlN1YnNjcmlwdGlvbiwgXCJSLlN0b3JlLlVwbGlua1N0b3JlLnVuc3ViKC4uLik6IHR5cGUgUi5TdG9yZS5TdWJzY3JpcHRpb24gZXhwZWN0ZWQuXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NlcnQoXy5oYXMoc3Vic2NyaWJlcnMsIHN1YnNjcmlwdGlvbi5rZXkpLCBcIlIuU3RvcmUuVXBsaW5rU3RvcmUudW5zdWIoLi4uKTogbm8gc3Vic2NyaWJlcnMgZm9yIHRoaXMga2V5LiAoJ1wiICsgc3Vic2NyaXB0aW9uLmtleSArIFwiJylcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2VydChfLmhhcyhzdWJzY3JpYmVyc1tzdWJzY3JpcHRpb24ua2V5XSwgc3Vic2NyaXB0aW9uLnVuaXF1ZUlkKSwgXCJSLlN0b3JlLlVwbGlua1N0b3JlLnVuc3ViKC4uLik6IG5vIHN1Y2ggc3Vic2NyaXB0aW9uLiAoJ1wiICsgc3Vic2NyaXB0aW9uLmtleSArIFwiJywgJ1wiICsgc3Vic2NyaXB0aW9uLnVuaXF1ZUlkICsgXCInKVwiKTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICBkZWxldGUgc3Vic2NyaWJlcnNbc3Vic2NyaXB0aW9uLmtleV1bc3Vic2NyaXB0aW9uLnVuaXF1ZUlkXTtcclxuICAgICAgICAgICAgICAgICAgICBpZihfLnNpemUoc3Vic2NyaWJlcnNbc3Vic2NyaXB0aW9uLmtleV0pID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBzdWJzY3JpYmVyc1tzdWJzY3JpcHRpb24ua2V5XTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYoXy5oYXMoZGF0YSwgc3Vic2NyaXB0aW9uLmtleSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBkYXRhW3N1YnNjcmlwdGlvbi5rZXldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgc2VyaWFsaXplID0gZnVuY3Rpb24gc2VyaWFsaXplKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShkYXRhKTtcclxuICAgICAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICAgICAgdmFyIHVuc2VyaWFsaXplID0gZnVuY3Rpb24gdW5zZXJpYWxpemUoc3RyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgXy5leHRlbmQoZGF0YSwgSlNPTi5wYXJzZShzdHIpKTtcclxuICAgICAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICAgICAgdmFyIGRlc3Ryb3kgPSBmdW5jdGlvbiBkZXN0cm95KCkge1xyXG4gICAgICAgICAgICAgICAgICAgIFIuRGVidWcuZGV2KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NlcnQoIV9kZXN0cm95ZWQsIFwiUi5TdG9yZS5VcGxpbmtTdG9yZS5kZXN0cm95KC4uLik6IGluc3RhbmNlIGRlc3Ryb3llZC5cIik7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgXy5lYWNoKHN1YnNjcmliZXJzLCBmdW5jdGlvbihrZXlTdWJzY3JpYmVycywga2V5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIF8uZWFjaChzdWJzY3JpYmVyc1trZXldLCB1bnN1Yik7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgXy5lYWNoKGRhdGEsIGZ1bmN0aW9uKHZhbCwga2V5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBkYXRhW2tleV07XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YSA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgc3Vic2NyaWJlcnMgPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgIF9kZXN0cm95ZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IChSLlN0b3JlLmNyZWF0ZVN0b3JlKHtcclxuICAgICAgICAgICAgICAgICAgICBkaXNwbGF5TmFtZTogXCJIVFRQU3RvcmVcIixcclxuICAgICAgICAgICAgICAgICAgICBfZGF0YTogZGF0YSxcclxuICAgICAgICAgICAgICAgICAgICBfc3Vic2NyaWJlcnM6IHN1YnNjcmliZXJzLFxyXG4gICAgICAgICAgICAgICAgICAgIGZldGNoOiBmZXRjaCxcclxuICAgICAgICAgICAgICAgICAgICBnZXQ6IGdldCxcclxuICAgICAgICAgICAgICAgICAgICBzdWI6IHN1YixcclxuICAgICAgICAgICAgICAgICAgICB1bnN1YjogdW5zdWIsXHJcbiAgICAgICAgICAgICAgICAgICAgc2VyaWFsaXplOiBzZXJpYWxpemUsXHJcbiAgICAgICAgICAgICAgICAgICAgdW5zZXJpYWxpemU6IHVuc2VyaWFsaXplLFxyXG4gICAgICAgICAgICAgICAgICAgIGRlc3Ryb3k6IGRlc3Ryb3ksXHJcbiAgICAgICAgICAgICAgICB9KSkoKTtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIDxwPkltcGxlbWVudGF0aW9uIG9mIFIuU3RvcmUgdXNpbmcgYSByZW1vdGUsIFJFU1QtbGlrZSBTdG9yZS4gVGhlIHN0b3JlIGlzIHJlYWQtb25seSBmcm9tIHRoZSBjb21wb25lbnRzLCA8YnIgLz5cclxuICAgICAgICAgKiBhcyB3ZWxsIGFzIGZyb20gdGhlIENsaWVudCBpbiBnZW5lcmFsLCBidXQgdGhlIHJlbW90ZSBiYWNrZW5kIHNob3VsZCBiZSB3aXJlZC11cCB3aXRoIFIuRGlzcGF0Y2hlci5VcGxpbmtEaXNwYXRjaGVyIHRvIFxyXG4gICAgICAgICAqIGltcGxlbWVudCB0aGUgb3Zlci10aGUtd2lyZSBGbHV4LiA8L3A+XHJcbiAgICAgICAgICogQGNsYXNzIFIuU3RvcmUuVXBsaW5rU3RvcmVcclxuICAgICAgICAgKiBAaW1wbGVtZW50cyB7Ui5TdG9yZX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBjcmVhdGVVcGxpbmtTdG9yZTogZnVuY3Rpb24gY3JlYXRlVXBsaW5rU3RvcmUoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiBVcGxpbmtTdG9yZSh1cGxpbmspIHtcclxuICAgICAgICAgICAgICAgIFIuRGVidWcuZGV2KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGFzc2VydCh1cGxpbmsuZmV0Y2ggJiYgXy5pc0Z1bmN0aW9uKHVwbGluay5mZXRjaCksIFwiUi5TdG9yZS5jcmVhdGVVcGxpbmtTdG9yZSguLi4pLnVwbGluay5mZXRjaDogZXhwZWN0aW5nIEZ1bmN0aW9uLlwiKTtcclxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQodXBsaW5rLnN1YnNjcmliZVRvICYmIF8uaXNGdW5jdGlvbih1cGxpbmsuc3Vic2NyaWJlVG8pLCBcIlIuU3RvcmUuY3JlYXRlVXBsaW5rU3RvcmUoLi4uKS51cGxpbmsuc3Vic2NyaWJlVG86IGV4cGVjdGluZyBGdW5jdGlvbi5cIik7XHJcbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KHVwbGluay51bnN1YnNjcmliZUZyb20gJiYgXy5pc0Z1bmN0aW9uKHVwbGluay51bnN1YnNjcmliZUZyb20pLCBcIlIuU3RvcmUuY3JlYXRlVXBsaW5rU3RvcmUoLi4uKS51cGxpbmsudW5zdWJzY3JpYmVGcm9tOiBleHBlY3RpbmcgRnVuY3Rpb24uXCIpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB2YXIgX2ZldGNoID0gdXBsaW5rLmZldGNoO1xyXG4gICAgICAgICAgICAgICAgdmFyIHN1YnNjcmliZVRvID0gdXBsaW5rLnN1YnNjcmliZVRvO1xyXG4gICAgICAgICAgICAgICAgdmFyIHVuc3Vic2NyaWJlRnJvbSA9IHVwbGluay51bnN1YnNjcmliZUZyb207XHJcbiAgICAgICAgICAgICAgICBfZGVzdHJveWVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB2YXIgZGF0YSA9IHt9O1xyXG4gICAgICAgICAgICAgICAgdmFyIHN1YnNjcmliZXJzID0ge307XHJcbiAgICAgICAgICAgICAgICB2YXIgdXBkYXRlcnMgPSB7fTtcclxuXHJcbiAgICAgICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICAgICogPHA+RmV0Y2ggZGF0YSBhY2NvcmRpbmcgdG8gYSBrZXk8L3A+XHJcbiAgICAgICAgICAgICAgICAqIEBtZXRob2QgZmV0Y2hcclxuICAgICAgICAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5XHJcbiAgICAgICAgICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufSBmbiB0aGUgeWllbGRlZCBmb25jdGlvblxyXG4gICAgICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgICAgIHZhciBmZXRjaCA9IGZ1bmN0aW9uKiBmZXRjaChrZXkpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgdmFsID0geWllbGQgX2ZldGNoKGtleSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYoIV9kZXN0cm95ZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtrZXldID0gdmFsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUi5TdG9yZS5VcGxpbmtTdG9yZS5mZXRjaCguLi4pOiBpbnN0YW5jZSBkZXN0cm95ZWQuXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICB2YXIgZ2V0ID0gZnVuY3Rpb24gZ2V0KGtleSkge1xyXG4gICAgICAgICAgICAgICAgICAgIFIuRGVidWcuZGV2KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZighXy5oYXMoZGF0YSwga2V5KSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiUi5TdG9yZS5VcGxpbmtTdG9yZS5nZXQoLi4uKTogZGF0YSBub3QgYXZhaWxhYmxlLiAoJ1wiICsga2V5ICsgXCInKVwiKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBkYXRhW2tleV07XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgLyoqIFxyXG4gICAgICAgICAgICAgICAgKiA8cD5UcmlnZ2VyZWQgYnkgdGhlIHNvY2tldC5vbihcInVwZGF0ZVwiKSBldmVudCBpbiBSLlVwbGluayA8YnIgLz5cclxuICAgICAgICAgICAgICAgICogRmV0Y2ggZGF0YSBhY2NvcmRpbmcgdG8gdGhlIGdpdmVuIGtleSA8YnIgLz5cclxuICAgICAgICAgICAgICAgICogQ2FsbCB0aGUgc2F2ZWQgZnVuY3Rpb24gY29udGFpbmVkIGluIHN1YnNjcmliZXJzIDwvcD5cclxuICAgICAgICAgICAgICAgICogQG1ldGhvZCBzaWduYWxVcGRhdGVcclxuICAgICAgICAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IHRvIGZldGNoXHJcbiAgICAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICAgICAgdmFyIHNpZ25hbFVwZGF0ZSA9IGZ1bmN0aW9uIHNpZ25hbFVwZGF0ZShrZXksIHZhbCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKCFfLmhhcyhzdWJzY3JpYmVycywga2V5KSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIF8uZWFjaChzdWJzY3JpYmVyc1trZXldLCBmdW5jdGlvbihmbiwgdW5pcXVlSWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYoZm4pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZuKHZhbCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgICAgKiA8cD4gU3Vic2NyaWJlIGF0IGEgc3BlY2lmaWMga2V5IDwvcD5cclxuICAgICAgICAgICAgICAgICogQG1ldGhvZCBzdWJcclxuICAgICAgICAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUgc3BlY2lmaWMga2V5IHRvIHN1YnNjcmliZVxyXG4gICAgICAgICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBfc2lnbmFsVXBkYXRlIHRoZSBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbCB3aGVuIGEgZGF0YSBjb3JyZXNwb25kaW5nIHRvIGEga2V5IHdpbGwgYmUgdXBkYXRlZFxyXG4gICAgICAgICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9IHN1YnNjcmlwdGlvbiBUaGUgc2F2ZWQgc3Vic2NyaXB0aW9uXHJcbiAgICAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICAgICAgdmFyIHN1YiA9IGZ1bmN0aW9uIHN1YihrZXksIF9zaWduYWxVcGRhdGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBSLkRlYnVnLmRldihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KCFfZGVzdHJveWVkLCBcIlIuU3RvcmUuVXBsaW5rU3RvcmUuc3ViKC4uLik6IGluc3RhbmNlIGRlc3Ryb3llZC4gKCdcIiArIGtleSArIFwiJylcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHN1YnNjcmlwdGlvbiA9IG5ldyBSLlN0b3JlLlN1YnNjcmlwdGlvbihrZXkpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKCFfLmhhcyhzdWJzY3JpYmVycywga2V5KSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdWJzY3JpYmVyc1trZXldID0ge307XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNhbGwgc3Vic2NyaWJlVG8gZnJvbSBSLlVwbGluayA9PiBlbWl0IFwic3Vic2NyaWJlVG9cIiBzaWduYWxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlcnNba2V5XSA9IHN1YnNjcmliZVRvKGtleSwgc2lnbmFsVXBkYXRlKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgc3Vic2NyaWJlcnNba2V5XVtzdWJzY3JpcHRpb24udW5pcXVlSWRdID0gX3NpZ25hbFVwZGF0ZTtcclxuICAgICAgICAgICAgICAgICAgICBjbyhmdW5jdGlvbiooKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB2YWwgPSB5aWVsZCBmZXRjaChrZXkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBfLmRlZmVyKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX3NpZ25hbFVwZGF0ZSh2YWwpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICB9KS5jYWxsKHRoaXMsIFIuRGVidWcucmV0aHJvdyhcIlIuU3RvcmUuc3ViLmZldGNoKC4uLik6IGRhdGEgbm90IGF2YWlsYWJsZS4gKCdcIiArIGtleSArIFwiJylcIikpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWJzY3JpcHRpb247XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAgICAqIDxwPiBVbnN1YnNjcmliZTwvcD5cclxuICAgICAgICAgICAgICAgICogQG1ldGhvZCB1bnN1YlxyXG4gICAgICAgICAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gc3Vic2NyaXB0aW9uIFRoZSBzdWJzY3JpcHRpb24gdGhhdCBjb250YWlucyB0aGUga2V5IHRvIHVuc3VzY3JpYmVcclxuICAgICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgICAgICB2YXIgdW5zdWIgPSBmdW5jdGlvbiB1bnN1YihzdWJzY3JpcHRpb24pIHtcclxuICAgICAgICAgICAgICAgICAgICBSLkRlYnVnLmRldihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KCFfZGVzdHJveWVkLCBcIlIuU3RvcmUuVXBsaW5rU3RvcmUudW5zdWIoLi4uKTogaW5zdGFuY2UgZGVzdHJveWVkLlwiKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KHN1YnNjcmlwdGlvbiBpbnN0YW5jZW9mIFIuU3RvcmUuU3Vic2NyaXB0aW9uLCBcIlIuU3RvcmUuVXBsaW5rU3RvcmUudW5zdWIoLi4uKTogdHlwZSBSLlN0b3JlLlN1YnNjcmlwdGlvbiBleHBlY3RlZC5cIik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2VydChfLmhhcyhzdWJzY3JpYmVycywgc3Vic2NyaXB0aW9uLmtleSksIFwiUi5TdG9yZS5VcGxpbmtTdG9yZS51bnN1YiguLi4pOiBubyBzdWJzY3JpYmVycyBmb3IgdGhpcyBrZXkuICgnXCIgKyBzdWJzY3JpcHRpb24ua2V5ICsgXCInKVwiKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KF8uaGFzKHN1YnNjcmliZXJzW3N1YnNjcmlwdGlvbi5rZXldLCBzdWJzY3JpcHRpb24udW5pcXVlSWQpLCBcIlIuU3RvcmUuVXBsaW5rU3RvcmUudW5zdWIoLi4uKTogbm8gc3VjaCBzdWJzY3JpcHRpb24uICgnXCIgKyBzdWJzY3JpcHRpb24ua2V5ICsgXCInLCAnXCIgKyBzdWJzY3JpcHRpb24udW5pcXVlSWQgKyBcIicpXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBzdWJzY3JpYmVyc1tzdWJzY3JpcHRpb24ua2V5XVtzdWJzY3JpcHRpb24udW5pcXVlSWRdO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKF8uc2l6ZShzdWJzY3JpYmVyc1tzdWJzY3JpcHRpb24ua2V5XSkgPT09IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdW5zdWJzY3JpYmVGcm9tKHN1YnNjcmlwdGlvbi5rZXksIHVwZGF0ZXJzW3N1YnNjcmlwdGlvbi5rZXldKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHN1YnNjcmliZXJzW3N1YnNjcmlwdGlvbi5rZXldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgdXBkYXRlcnNbc3Vic2NyaXB0aW9uLmtleV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKF8uaGFzKGRhdGEsIHN1YnNjcmlwdGlvbi5rZXkpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgZGF0YVtzdWJzY3JpcHRpb24ua2V5XTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAgICAqIDxwPiBTZXJpYWxpemUgdGhlIFVwbGlua1N0b3JlIHN0b3JlIDwvcD5cclxuICAgICAgICAgICAgICAgICogQG1ldGhvZCBzZXJpYWxpemVcclxuICAgICAgICAgICAgICAgICogQHJldHVybiB7c3RyaW5nfSBkYXRhIFRoZSBzZXJpYWxpemVkIFVwbGlua1N0b3JlIHN0b3JlXHJcbiAgICAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICAgICAgdmFyIHNlcmlhbGl6ZSA9IGZ1bmN0aW9uIHNlcmlhbGl6ZSgpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZGF0YSk7XHJcbiAgICAgICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgICAgKiA8cD4gVW5zZXJpYWxpemUgdGhlIFVwbGlua1N0b3JlIHN0b3JlIDwvcD5cclxuICAgICAgICAgICAgICAgICogQG1ldGhvZCB1bnNlcmlhbGl6ZVxyXG4gICAgICAgICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3RyIFRoZSBzdHJpbmcgdG8gdW5zZXJpYWxpc2VcclxuICAgICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgICAgICB2YXIgdW5zZXJpYWxpemUgPSBmdW5jdGlvbiB1bnNlcmlhbGl6ZShzdHIpIHtcclxuICAgICAgICAgICAgICAgICAgICBfLmV4dGVuZChkYXRhLCBKU09OLnBhcnNlKHN0cikpO1xyXG4gICAgICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICAgICogPHA+IENsZWFuIFVwbGlua1N0b3JlIHN0b3JlIDwvcD5cclxuICAgICAgICAgICAgICAgICogQG1ldGhvZCBkZXN0cm95XHJcbiAgICAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICAgICAgdmFyIGRlc3Ryb3kgPSBmdW5jdGlvbiBkZXN0cm95KCkge1xyXG4gICAgICAgICAgICAgICAgICAgIFIuRGVidWcuZGV2KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NlcnQoIV9kZXN0cm95ZWQsIFwiUi5TdG9yZS5VcGxpbmtTdG9yZS5kZXN0cm95KC4uLik6IGluc3RhbmNlIGRlc3Ryb3llZC5cIik7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgXy5lYWNoKHN1YnNjcmliZXJzLCBmdW5jdGlvbihrZXlTdWJzY3JpYmVycywga2V5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIF8uZWFjaChzdWJzY3JpYmVyc1trZXldLCB1bnN1Yik7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgXy5lYWNoKGRhdGEsIGZ1bmN0aW9uKHZhbCwga2V5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBkYXRhW2tleV07XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YSA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgc3Vic2NyaWJlcnMgPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZXJzID0gbnVsbDtcclxuICAgICAgICAgICAgICAgICAgICBfZGVzdHJveWVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IChSLlN0b3JlLmNyZWF0ZVN0b3JlKHtcclxuICAgICAgICAgICAgICAgICAgICBkaXNwbGF5TmFtZTogXCJVcGxpbmtTdG9yZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIF9kYXRhOiBkYXRhLFxyXG4gICAgICAgICAgICAgICAgICAgIF9zdWJzY3JpYmVyczogc3Vic2NyaWJlcnMsXHJcbiAgICAgICAgICAgICAgICAgICAgX3VwZGF0ZXJzOiB1cGRhdGVycyxcclxuICAgICAgICAgICAgICAgICAgICBmZXRjaDogZmV0Y2gsXHJcbiAgICAgICAgICAgICAgICAgICAgZ2V0OiBnZXQsXHJcbiAgICAgICAgICAgICAgICAgICAgc3ViOiBzdWIsXHJcbiAgICAgICAgICAgICAgICAgICAgdW5zdWI6IHVuc3ViLFxyXG4gICAgICAgICAgICAgICAgICAgIHNpZ25hbFVwZGF0ZTogc2lnbmFsVXBkYXRlLFxyXG4gICAgICAgICAgICAgICAgICAgIHNlcmlhbGl6ZTogc2VyaWFsaXplLFxyXG4gICAgICAgICAgICAgICAgICAgIHVuc2VyaWFsaXplOiB1bnNlcmlhbGl6ZSxcclxuICAgICAgICAgICAgICAgICAgICBkZXN0cm95OiBkZXN0cm95LFxyXG4gICAgICAgICAgICAgICAgfSkpKCk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSxcclxuICAgIH07XHJcblxyXG4gICAgXy5leHRlbmQoU3RvcmUuU3Vic2NyaXB0aW9uLnByb3RvdHlwZSwgLyoqIEBsZW5kcyBSLlN0b3JlLlN1YnNjcmlwdGlvbiAqL3tcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBAcHVibGljXHJcbiAgICAgICAgICogQHJlYWRPbmx5XHJcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICB1bmlxdWVJZDogbnVsbCxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBAcHVibGljXHJcbiAgICAgICAgICogQHJlYWRPbmx5XHJcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICBrZXk6IG51bGwsXHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gU3RvcmU7XHJcbn07XHJcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==