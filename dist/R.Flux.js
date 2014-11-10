"use strict";

require("6to5/polyfill");
var Promise = require("bluebird");
module.exports = function (R) {
  var _ = require("lodash");
  var assert = require("assert");
  var co = require("co");
  var React = R.React;

  var count = 0;

  var abstractLocationRegExp = /^(.*):\/(.*)$/;

  /**
   * @memberOf R
   * <p>R.Flux represents the data flowing from the backends (either local or remote).
   * To enable isomoprhic rendering, it should be computable either or in the server or in the client.
   * It represents the global state, including but not limited to:</p>
   * <ul>
   * <li>Routing information</li>
   * <li>Session information</li>
   * <li>Navigation information</li>
   * </ul>
   * <p>Inside an App, each components can interact with the Flux instance using Flux.Mixin (generally via Root.Mixin or Component.Mixin).</p>
   * @class R.Flux
   */
  var Flux = {
    /**
    * <p>Returns a Flux constructor</p>
    * @method createFlux
    * @param {object} specs The specifications of the flux
    */
    createFlux: function createFlux(specs) {
      R.Debug.dev(function () {
        assert(_.isObject(specs), "R.createFlux(...): expecting an Object.");
        assert(_.has(specs, "bootstrapInClient") && _.isFunction(specs.bootstrapInClient), "R.createFlux(...): requires bootstrapInClient(Window): Function");
        assert(_.has(specs, "bootstrapInServer") && _.isFunction(specs.bootstrapInServer), "R.createFlux(...): requires bootstrapInServer(http.IncomingMessage): Function");
      });
      var FluxInstance = function () {
        R.Flux.FluxInstance.call(this);
      };
      _.extend(FluxInstance.prototype, R.Flux.FluxInstance.prototype, specs);
      return FluxInstance;
    },
    /**
    * <p>Check if the flux provided by props is an object and a flux instance</p>
    * @param {object} props The props to check
    * @return {Boolean} valid The result boolean of the checked flux
    */
    PropType: function validateFlux(props, propName, componentName) {
      var flux = props.flux;
      var valid = null;
      R.Debug.dev(function () {
        try {
          assert(_.isObject(flux) && flux._isFluxInstance_, "R.Root.createClass(...): expecting a R.Flux.FluxInstance.");
        } catch (err) {
          valid = err;
        }
      });
      return valid;
    },
    FluxInstance: function FluxInstance() {
      this._stores = {};
      this._eventEmitters = {};
      this._dispatchers = {};
    },
    Mixin: {
      _FluxMixinSubscriptions: null,
      _FluxMixinListeners: null,
      /**
      * <p>The getInitialState of React mechanics will be call at:</p>
      *  - React.render() <br />
      *  - React.renderToString() <br />
      * <p>Never return a null object, by default: {}, otherwise return data stocked from the corresponding store</p>
      * @method getInitialState
      * @return {Object} object An object like: [stateKey, data]
      */
      getInitialState: function getInitialState() {
        var subscriptions = this.getFluxStoreSubscriptions(this.props);
        /* Return computed datas from Component's subscriptions */
        if (this.getFlux().shouldInjectFromStores()) {
          return _.object(_.map(subscriptions, R.scope(function (stateKey, location) {
            var r = abstractLocationRegExp.exec(location);
            assert(r !== null, "R.Flux.getInitialState(...): incorrect location ('" + this.displayName + "', '" + location + "', '" + stateKey + "')");
            var storeName = r[1];
            var storeKey = r[2];
            return [stateKey, this.getFluxStore(storeName).get(storeKey)];
          }, this)));
        }
        /* Return stateKey:null values for each subscriptions */
        else {
          return _.object(_.map(subscriptions, function (stateKey) {
            return [stateKey, null];
          }));
        }
      },
      /**
      * <p>The componentWillMount of React mechanics</p>
      * <p>Initialize flux functions for each components when componentWillMount is invoked by React</p>
      * @method componentWillMount
      */
      componentWillMount: function componentWillMount() {
        R.Debug.dev(R.scope(function () {
          assert(this.getFlux && _.isFunction(this.getFlux), "R.Flux.Mixin.componentWillMount(...): requires getFlux(): R.Flux.FluxInstance.");
          assert(this._AsyncMixinHasAsyncMixin, "R.Flux.Mixin.componentWillMount(...): requires R.Async.Mixin.");
        }, this));
        this._FluxMixinListeners = {};
        this._FluxMixinSubscriptions = {};
        this._FluxMixinResponses = {};
        if (!this.getFluxStoreSubscriptions) {
          this.getFluxStoreSubscriptions = this._FluxMixinDefaultGetFluxStoreSubscriptions;
        }
        if (!this.getFluxEventEmittersListeners) {
          this.getFluxEventEmittersListeners = this._FluxMixinDefaultGetFluxEventEmittersListeners;
        }
        if (!this.fluxStoreWillUpdate) {
          this.fluxStoreWillUpdate = this._FluxMixinDefaultFluxStoreWillUpdate;
        }
        if (!this.fluxStoreDidUpdate) {
          this.fluxStoreDidUpdate = this._FluxMixinDefaultFluxStoreDidUpdate;
        }
        if (!this.fluxEventEmitterWillEmit) {
          this.fluxEventEmitterWillEmit = this._FluxMixinDefaultFluxEventEmitterWillEmit;
        }
        if (!this.fluxEventEmitterDidEmit) {
          this.fluxEventEmitterDidEmit = this._FluxMixinDefaultFluxEventEmitterDidEmit;
        }
      },

      /**
      * <p>Call the manager subscriptions when componendDidMount is invoked by React (only client-side)</p>
      * @method componentDidMount
      */
      componentDidMount: function componentDidMount() {
        this._FluxMixinUpdate(this.props);
      },
      componentWillReceiveProps: function componentWillReceiveProps(props) {
        this._FluxMixinUpdate(props);
      },
      componentWillUnmount: function componentWillUnmount() {
        this._FluxMixinClear();
      },
      getFluxStore: function getFluxStore(name) {
        return this.getFlux().getStore(name);
      },
      /**
      * <p>Fetch all components from a root component in order to initialize all data, fill the corresponding stores</p>
      * <p>Executed server-side<p>
      * @method prefetchFluxStores
      * @return {void}
      */
      prefetchFluxStores: regeneratorRuntime.mark(function prefetchFluxStores() {
        var subscriptions, curCount, state, surrogateComponent, renderedComponent, childContext;
        return regeneratorRuntime.wrap(function prefetchFluxStores$(context$2$0) {
          while (1) switch (context$2$0.prev = context$2$0.next) {case 0:
              subscriptions = this.getFluxStoreSubscriptions(this.props);
              curCount = count;
              state = {};
              context$2$0.next = 5;
              return _.map(subscriptions, R.scope(function (stateKey, location) {
                return new Promise(R.scope(function (resolve, reject) {
                  var r = abstractLocationRegExp.exec(location);
                  if (r === null) {
                    return reject(new Error("R.Flux.prefetchFluxStores(...): incorrect location ('" + this.displayName + "', '" + location + "', '" + stateKey + "')"));
                  } else {
                    var storeName = r[1];
                    var storeKey = r[2];
                    co(regeneratorRuntime.mark(function callee$4$0() {
                      return regeneratorRuntime.wrap(function callee$4$0$(context$5$0) {
                        while (1) switch (context$5$0.prev = context$5$0.next) {case 0:
                            context$5$0.next = 2;
                            return this.getFluxStore(storeName).fetch(storeKey);

                          case 2: state[stateKey] = context$5$0.sent;
                          case 3:
                          case "end": return context$5$0.stop();
                        }
                      }, callee$4$0, this);
                    })).call(this, function (err) {
                      if (err) {
                        return reject(R.Debug.extendError(err, "Couldn't prefetch subscription ('" + stateKey + "', '" + location + "')"));
                      } else {
                        return resolve();
                      }
                    });
                  }
                }, this));
              }, this));

            case 5:

              this.getFlux().startInjectingFromStores();

              surrogateComponent = new this.__ReactOnRailsSurrogate(this.context, this.props, state);

              surrogateComponent.componentWillMount();
              this.getFlux().stopInjectingFromStores();

              renderedComponent = surrogateComponent.render();
              childContext = (surrogateComponent.getChildContext ? surrogateComponent.getChildContext() : this.context);

              surrogateComponent.componentWillUnmount();

              context$2$0.next = 14;
              return React.Children.mapTree(renderedComponent, function (childComponent) {
                return new Promise(function (resolve, reject) {
                  if (!_.isObject(childComponent)) {
                    return resolve();
                  }
                  var childType = childComponent.type;
                  if (!_.isObject(childType) || !childType.__ReactOnRailsSurrogate) {
                    return resolve();
                  }
                  //Create the React instance of current child with props, but without computed state
                  var surrogateChildComponent = new childType.__ReactOnRailsSurrogate(childContext, childComponent.props);
                  if (!surrogateChildComponent.componentWillMount) {
                    R.Debug.dev(function () {
                      console.error("Component doesn't have componentWillMount. Maybe you forgot R.Component.Mixin? ('" + surrogateChildComponent.displayName + "')");
                    });
                  }
                  surrogateChildComponent.componentWillMount();
                  co(regeneratorRuntime.mark(function callee$4$0() {
                    return regeneratorRuntime.wrap(function callee$4$0$(context$5$0) {
                      while (1) switch (context$5$0.prev = context$5$0.next) {case 0:
                          context$5$0.next = 2;
                          return surrogateChildComponent.prefetchFluxStores();

                        case 2: surrogateChildComponent.componentWillUnmount();
                        case 3:
                        case "end": return context$5$0.stop();
                      }
                    }, callee$4$0, this);
                  })).call(this, function (err) {
                    if (err) {
                      return reject(R.Debug.extendError(err, "Couldn't prefetch child component"));
                    } else {
                      return resolve();
                    }
                  });
                });
              });

            case 14:
            case "end": return context$2$0.stop();
          }
        }, prefetchFluxStores, this);
      }),
      /**
      * <p>Returns the FluxEventEmitter according the provided name</p>
      * @method getFluxEventEmitter
      * @param {string} name The name
      * @return {object} EventEmitter the EventEmitter
      */
      getFluxEventEmitter: function getFluxEventEmitter(name) {
        return this.getFlux().getEventEmitter(name);
      },
      /**
      * <p>Returns the FluxDispatcher according the provided name</p>
      * @method getFluxDispatcher
      * @param {string} name The name
      * @return {object} Dispatcher the Dispatcher
      */
      getFluxDispatcher: function getFluxDispatcher(name) {
        return this.getFlux().getDispatcher(name);
      },
      /**
      * <p>Get the corresponding dispatcher and dispatch the action submitted by a React component<br />
      * Trigged on event like "click"</p>
      * @param {string} location The url to go (eg. "//History/navigate")
      * @param {object} param The specific data for the action
      * @return {*} * the data that may be provided by the dispatcher
      */
      dispatch: regeneratorRuntime.mark(function dispatch(location, params) {
        var r, entry;
        return regeneratorRuntime.wrap(function dispatch$(context$2$0) {
          while (1) switch (context$2$0.prev = context$2$0.next) {case 0:
              r = abstractLocationRegExp.exec(location);

              assert(r !== null, "R.Flux.dispatch(...): incorrect location ('" + this.displayName + "')");
              entry = {
                dispatcherName: r[1],
                action: r[2] };
              context$2$0.next = 5;
              return this.getFluxDispatcher(entry.dispatcherName).dispatch(entry.action, params);

            case 5: return context$2$0.abrupt("return", context$2$0.sent);
            case 6:
            case "end": return context$2$0.stop();
          }
        }, dispatch, this);
      }),
      _FluxMixinDefaultGetFluxStoreSubscriptions: function getFluxStoreSubscriptions(props) {
        return {};
      },
      _FluxMixinDefaultGetFluxEventEmittersListeners: function getFluxEventEmittersListeners(props) {
        return {};
      },
      _FluxMixinDefaultFluxStoreWillUpdate: function fluxStoreWillUpdate(storeName, storeKey, newVal, oldVal) {
        return void 0;
      },
      _FluxMixinDefaultFluxStoreDidUpdate: function fluxStoreDidUpdate(storeName, storeKey, newVal, oldVal) {
        return void 0;
      },
      _FluxMixinDefaultFluxEventEmitterWillEmit: function fluxEventEmitterWillEmit(eventEmitterName, eventName, params) {
        return void 0;
      },
      _FluxMixinDefaultFluxEventEmitterDidEmit: function fluxEventEmitterDidEmit(eventEmitterName, eventName, params) {
        return void 0;
      },
      _FluxMixinClear: function _FluxMixinClear() {
        _.each(this._FluxMixinSubscriptions, this._FluxMixinUnsubscribe);
        _.each(this._FluxMixinListeners, this.FluxMixinRemoveListener);
      },
      /**
      * <p>Manage subscriptions, unsubscriptions and event emitters</p>
      * @method _FluxMixinUpdate
      * @param {Object} props The props of component
      * @private
      */
      _FluxMixinUpdate: function _FluxMixinUpdate(props) {
        var currentSubscriptions = _.object(_.map(this._FluxMixinSubscriptions, function (entry) {
          return [entry.location, entry.stateKey];
        }));

        var nextSubscriptions = this.getFluxStoreSubscriptions(props);
        _.each(currentSubscriptions, R.scope(function (stateKey, location) {
          if (!nextSubscriptions[location] || nextSubscriptions[location] !== currentSubscriptions[location]) {
            this._FluxMixinUnsubscribe(stateKey, location);
          }
        }, this));
        _.each(nextSubscriptions, R.scope(function (stateKey, location) {
          if (!currentSubscriptions[location] || currentSubscriptions[location] !== stateKey) {
            this._FluxMixinSubscribe(stateKey, location);
          }
        }, this));

        var currentListeners = _.object(_.map(this._FluxMixinListeners, function (entry) {
          return [entry.location, entry.fn];
        }));
        var nextListeners = this.getFluxEventEmittersListeners(props);
        _.each(currentListeners, R.scope(function (fn, location) {
          if (!nextListeners[location] || nextListeners[location] !== currentListeners[location]) {
            this._FluxMixinRemoveListener(fn, location);
          }
        }, this));
        _.each(nextListeners, R.scope(function (fn, location) {
          if (!currentListeners[location] || currentListeners[location] !== fn) {
            this._FluxMixinAddListener(fn, location);
          }
        }, this));
      },
      /**
      * @method _FluxMixinInject
      * @param {string} stateKey The stateKey
      * @param {string} location The location
      * @private
      */
      _FluxMixinInject: function _FluxMixinInject(stateKey, location) {
        var r = abstractLocationRegExp.exec(location);
        assert(r !== null, "R.Flux._FluxMixinInject(...): incorrect location ('" + this.displayName + "', '" + location + "', '" + stateKey + "')");
        var entry = {
          storeName: r[1],
          storeKey: r[2] };
        R.Debug.dev(R.scope(function () {
          assert(this.getFlux().shouldInjectFromStores(), "R.Flux.Mixin._FluxMixinInject(...): should not inject from Stores.");
          assert(_.isPlainObject(entry), "R.Flux.Mixin._FluxMixinInject(...).entry: expecting Object.");
          assert(_.has(entry, "storeName") && _.isString(entry.storeName), "R.Flux.Mixin._FluxMixinInject(...).entry.storeName: expecting String.");
          assert(_.has(entry, "storeKey") && _.isString(entry.storeKey), "R.Flux.Mixin._FluxMixinInject(...).entry.storeKey: expecting String.");
        }, this));
        this.setState(R.record(stateKey, this.getFluxStore(entry.storeName).get(entry.storeKey)));
      },
      /**
      * <p>Allow a React Component to subscribe at any data in order to fill state</p>
      * @method _FluxMixinSubscribe
      * @param {string} stateKey The key to be subscribed
      * @param {string} location The url that will be requested
      * @return {void}
      * @private
      */
      _FluxMixinSubscribe: function _FluxMixinSubscribe(stateKey, location) {
        var r = abstractLocationRegExp.exec(location);
        assert(r !== null, "R.Flux._FluxMixinSubscribe(...): incorrect location ('" + this.displayName + "', '" + location + "', '" + stateKey + "')");
        var entry = {
          storeName: r[1],
          storeKey: r[2] };
        R.Debug.dev(R.scope(function () {
          assert(_.isPlainObject(entry), "R.Flux.Mixin._FluxMixinSubscribe(...).entry: expecting Object.");
          assert(_.has(entry, "storeName") && _.isString(entry.storeName), "R.Flux.Mixin._FluxMixinSubscribe(...).entry.storeName: expecting String.");
          assert(_.has(entry, "storeKey") && _.isString(entry.storeKey), "R.Flux.Mixin._FluxMixinSubscribe(...).entry.storeKey: expecting String.");
        }, this));
        var store = this.getFluxStore(entry.storeName);
        //Subscribe and request Store to get data
        //Call immediatly _FluxMixinStoreSignalUpdate with computed data in order to call setState
        var subscription = store.sub(entry.storeKey, this._FluxMixinStoreSignalUpdate(stateKey, location));

        //Save subscription
        this._FluxMixinSubscriptions[subscription.uniqueId] = {
          location: location,
          stateKey: stateKey,
          storeName: entry.storeName,
          subscription: subscription };
      },
      /**
      * <p>Rerendering a component when data update occurs</p>
      * @method _FluxMixinStoreSignalUpdate
      * @param {String} stateKey The key to be subscribed
      * @param {String} location The url that will be requested
      * @return {Function}
      * @private
      */
      _FluxMixinStoreSignalUpdate: function _FluxMixinStoreSignalUpdate(stateKey, location) {
        return R.scope(function (val) {
          if (!this.isMounted()) {
            return;
          }
          var previousVal = this.state ? this.state[stateKey] : undefined;
          if (_.isEqual(previousVal, val)) {
            return;
          }
          this.fluxStoreWillUpdate(stateKey, location, val, previousVal);
          //Call react API in order to Rerender component
          this.setState(R.record(stateKey, val));
          this.fluxStoreDidUpdate(stateKey, location, val, previousVal);
        }, this);
      },
      /**
      * @method _FluxMixinAddListener
      * @param {Fonction} fn The fn
      * @param {string} location The location
      * @private
      */
      _FluxMixinAddListener: function _FluxMixinAddListener(fn, location) {
        var r = abstractLocationRegExp.exec(location);
        assert(r !== null, "R.Flux._FluxMixinAddListener(...): incorrect location ('" + this.displayName + "', '" + location + "')");
        var entry = {
          eventEmitterName: r[1],
          eventName: r[2] };
        R.Debug.dev(R.scope(function () {
          assert(_.isPlainObject(entry), "R.Flux.Mixin._FluxMixinAddListener(...).entry: expecting Object.");
          assert(_.has(entry, "eventEmitterName") && _.isString(entry.eventEmitterName), "R.Flux.Mixin._FluxMixinAddListener(...).entry.eventEmitterName: expecting String.");
          assert(_.has(entry, "eventName") && _.isString(entry.eventName), "R.Flux.Mixin._FluxMixinAddListener(...).entry.eventName: expecting String.");
          assert(_.has(entry, "fn") && _.isFunction(fn), "R.Flux.Mixin._FluxMixinAddListener(...).entry.fn: expecting Function.");
        }, this));
        var eventEmitter = this.getFluxEventEmitter(entry.eventEmitterName);
        var listener = eventEmitter.addListener(entry.eventName, this._FluxMixinEventEmitterEmit(entry.eventEmitterName, entry.eventName, entry.fn));
        this._FluxMixinListeners[listener.uniqueId] = {
          location: location,
          fn: fn,
          eventEmitterName: entry.eventEmitterName,
          listener: listener };
      },
      /**
      * @method _FluxMixinEventEmitterEmit
      * @param {string} eventEmitterName The eventEmitterName
      * @param {string} eventName The eventName
      * @param {Fonction} fn The fn
      * @private
      */
      _FluxMixinEventEmitterEmit: function _FluxMixinEventEmitterEmit(eventEmitterName, eventName, fn) {
        return R.scope(function (params) {
          if (!this.isMounted()) {
            return;
          }
          this.fluxEventEmitterWillEmit(eventEmitterName, eventName, params);
          fn(params);
          this.fluxEventEmitterDidEmit(eventEmitterName, eventName, params);
        }, this);
      },
      /**
      * @method _FluxMixinUnsubscribe
      * @param {object} entry The entry
      * @param {string} uniqueId The uniqueId
      * @private
      */
      _FluxMixinUnsubscribe: function _FluxMixinUnsubscribe(entry, uniqueId) {
        R.Debug.dev(R.scope(function () {
          assert(_.has(this._FluxMixinSubscriptions, uniqueId), "R.Flux.Mixin._FluxMixinUnsubscribe(...): no such subscription.");
        }, this));
        var subscription = entry.subscription;
        var storeName = entry.storeName;
        this.getFluxStore(storeName).unsub(subscription);
        delete this._FluxMixinSubscriptions[uniqueId];
      },
      /**
      * @method _FluxMixinRemoveListener
      * @param {object} entry The entry
      * @param {string} uniqueId The uniqueId
      * @private
      */
      _FluxMixinRemoveListener: function _FluxMixinRemoveListener(entry, uniqueId) {
        R.Debug.dev(R.scope(function () {
          assert(_.has(this._FluxMixinListeners, uniqueId), "R.Flux.Mixin._FluxMixinRemoveListener(...): no such listener.");
        }, this));
        var listener = entry.listener;
        var eventEmitterName = entry.eventEmitterName;
        this.getFluxEventEmitter(eventEmitterName).removeListener(listener);
        delete this._FluxMixinListeners[uniqueId];
      } } };

  _.extend(Flux.FluxInstance.prototype, /** @lends R.Flux.FluxInstance.prototype */{
    _isFluxInstance_: true,
    _stores: null,
    _eventEmitters: null,
    _dispatchers: null,
    _shouldInjectFromStores: false,
    bootstrapInClient: _.noop,
    bootstrapInServer: _.noop,
    destroyInClient: _.noop,
    destroyInServer: _.noop,
    shouldInjectFromStores: function shouldInjectFromStores() {
      return this._shouldInjectFromStores;
    },
    /**
    * <p>Sets the flag telling all the flux-mixed-in components to attempt to inject pre-fetched values from the cache. Used for pre-rendering magic.</p>
    * @method startInjectingFromStores
    */
    startInjectingFromStores: function startInjectingFromStores() {
      R.Debug.dev(R.scope(function () {
        assert(!this._shouldInjectFromStores, "R.Flux.FluxInstance.startInjectingFromStores(...): should not be injecting from Stores.");
      }, this));
      this._shouldInjectFromStores = true;
    },
    /**
    * <p>Unsets the flag telling all the flux-mixed-in components to attempt to inject pre-fetched values from the cache. Used for pre-rendering magic.</p>
    * @method startInjectingFromStores
    */
    stopInjectingFromStores: function stopInjectingFromStores() {
      R.Debug.dev(R.scope(function () {
        assert(this._shouldInjectFromStores, "R.Flux.FluxInstance.stopInjectingFromStores(...): should be injecting from Stores.");
      }, this));
      this._shouldInjectFromStores = false;
    },
    /**
    * <p>Serialize a serialized flux by the server in order to initialize flux into client</p>
    * @method serialize
    * @return {string} string The serialized string
    */
    serialize: function serialize() {
      return R.Base64.encode(JSON.stringify(_.mapValues(this._stores, function (store) {
        return store.serialize();
      })));
    },
    /**
    * Unserialize a serialized flux by the server in order to initialize flux into client
    * @method unserialize
    * @param {string} str The string to unserialize
    */
    unserialize: function unserialize(str) {
      _.each(JSON.parse(R.Base64.decode(str)), R.scope(function (serializedStore, name) {
        R.Debug.dev(R.scope(function () {
          assert(_.has(this._stores, name), "R.Flux.FluxInstance.unserialize(...): no such Store. (" + name + ")");
        }, this));
        this._stores[name].unserialize(serializedStore);
      }, this));
    },
    /**
    * <p>Getter for the store</p>
    * @method getStore
    * @param {string} name The name of the store
    * @return {object} store The corresponding store
    */
    getStore: function getStore(name) {
      R.Debug.dev(R.scope(function () {
        assert(_.has(this._stores, name), "R.Flux.FluxInstance.getStore(...): no such Store. (" + name + ")");
      }, this));
      return this._stores[name];
    },
    /**
    * <p>Register a store defined in the flux class of App <br />
    * Typically : Memory or Uplink</p>
    * @method registerStore
    * @param {string} name The name to register
    * @param {object} store The store to register
    */
    registerStore: function registerStore(name, store) {
      R.Debug.dev(R.scope(function () {
        assert(store._isStoreInstance_, "R.Flux.FluxInstance.registerStore(...): expecting a R.Store.StoreInstance. (" + name + ")");
        assert(!_.has(this._stores, name), "R.Flux.FluxInstance.registerStore(...): name already assigned. (" + name + ")");
      }, this));
      this._stores[name] = store;
    },
    /**
    * <p>Getter for the event emitter</p>
    * @method getEventEmitter
    * @param {string} name The name of the store
    * @return {object} eventEmitter The corresponding event emitter
    */
    getEventEmitter: function getEventEmitter(name) {
      R.Debug.dev(R.scope(function () {
        assert(_.has(this._eventEmitters, name), "R.Flux.FluxInstance.getEventEmitter(...): no such EventEmitter. (" + name + ")");
      }, this));
      return this._eventEmitters[name];
    },

    /**
    * <p>Register an event emitter defined in the flux class of App</p>
    * @method registerEventEmitter
    * @param {string} name The name to register
    * @param {object} eventEmitter The event emitter to register
    */
    registerEventEmitter: function registerEventEmitter(name, eventEmitter) {
      assert(R.isClient(), "R.Flux.FluxInstance.registerEventEmitter(...): should not be called in the server.");
      R.Debug.dev(R.scope(function () {
        assert(eventEmitter._isEventEmitterInstance_, "R.Flux.FluxInstance.registerEventEmitter(...): expecting a R.EventEmitter.EventEmitterInstance. (" + name + ")");
        assert(!_.has(this._eventEmitters, name), "R.Flux.FluxInstance.registerEventEmitter(...): name already assigned. (" + name + ")");
      }, this));
      this._eventEmitters[name] = eventEmitter;
    },

    /**
    * <p>Getter for the dispatcher</p>
    * @method getDispatcher
    * @param {string} name The name of the store
    * @return {object} dispatcher The corresponding dispatcher
    */
    getDispatcher: function getDispatcher(name) {
      R.Debug.dev(R.scope(function () {
        assert(_.has(this._dispatchers, name), "R.Flux.FluxInstance.getDispatcher(...): no such Dispatcher. (" + name + ")");
      }, this));
      return this._dispatchers[name];
    },
    /**
    * <p>Register a dispatcher defined in the flux class of App</p>
    * @method registerDispatcher
    * @param {string} name The name to register
    * @param {object} dispatcher The dispatcher to register
    */
    registerDispatcher: function registerDispatcher(name, dispatcher) {
      assert(R.isClient(), "R.Flux.FluxInstance.registerDispatcher(...): should not be called in the server. (" + name + ")");
      R.Debug.dev(R.scope(function () {
        assert(dispatcher._isDispatcherInstance_, "R.Flux.FluxInstance.registerDispatcher(...): expecting a R.Dispatcher.DispatcherInstance (" + name + ")");
        assert(!_.has(this._dispatchers, name), "R.Flux.FluxInstance.registerDispatcher(...): name already assigned. (" + name + ")");
      }, this));
      this._dispatchers[name] = dispatcher;
    },

    /**
    * <p>Clears the store by calling either this.destroyInServer or this.destroyInClient and recursively applying destroy on each store/event emittre/dispatcher.<br />
    * Used for pre-rendering magic.</p>
    * @method destroy
    */
    destroy: function destroy() {
      if (R.isClient()) {
        this.destroyInClient();
      }
      if (R.isServer()) {
        this.destroyInServer();
      }
      _.each(this._stores, function (store) {
        store.destroy();
      });
      this._stores = null;
      _.each(this._eventEmitters, function (eventEmitter) {
        eventEmitter.destroy();
      });
      this._eventEmitters = null;
      _.each(this._dispatchers, function (dispatcher) {
        dispatcher.destroy();
      });
      this._dispatchers = null;
    } });

  return Flux;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImQ6L3dvcmtzcGFjZV9yZWZhY3Rvci9yZWFjdC1yYWlscy9zcmMvUi5GbHV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3pCLElBQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNwQyxNQUFNLENBQUMsT0FBTyxHQUFHLFVBQVMsQ0FBQyxFQUFFO0FBQ3pCLE1BQUksQ0FBQyxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUMxQixNQUFJLE1BQU0sR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDL0IsTUFBSSxFQUFFLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3ZCLE1BQUksS0FBSyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUM7O0FBRXBCLE1BQUksS0FBSyxHQUFHLENBQUMsQ0FBQzs7QUFFZCxNQUFJLHNCQUFzQixHQUFHLGVBQWUsQ0FBQzs7Ozs7Ozs7Ozs7Ozs7OztBQWdCN0MsTUFBSSxJQUFJLEdBQUc7Ozs7OztBQU1QLGNBQVUsRUFBRSxTQUFTLFVBQVUsQ0FBQyxLQUFLLEVBQUU7QUFDbkMsT0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsWUFBVztBQUNuQixjQUFNLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRSx5Q0FBeUMsQ0FBQyxDQUFDO0FBQ3JFLGNBQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLGlCQUFpQixDQUFDLEVBQUUsaUVBQWlFLENBQUMsQ0FBQztBQUN0SixjQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLCtFQUErRSxDQUFD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QUFFLENBQUM7T0FDeEIsQ0FBQyxDQUFDO0FBQ0gsVUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUM7S0FDNUIsRUFDSixDQUFDLENBQUM7O0FBRUgsU0FBTyxJQUFJLENBQUM7Q0FDZixDQUFDIiwiZmlsZSI6IlIuRmx1eC5qcyIsInNvdXJjZXNDb250ZW50IjpbInJlcXVpcmUoJzZ0bzUvcG9seWZpbGwnKTtcbmNvbnN0IFByb21pc2UgPSByZXF1aXJlKCdibHVlYmlyZCcpO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihSKSB7XHJcbiAgICB2YXIgXyA9IHJlcXVpcmUoXCJsb2Rhc2hcIik7XHJcbiAgICB2YXIgYXNzZXJ0ID0gcmVxdWlyZShcImFzc2VydFwiKTtcclxuICAgIHZhciBjbyA9IHJlcXVpcmUoXCJjb1wiKTtcclxuICAgIHZhciBSZWFjdCA9IFIuUmVhY3Q7XHJcblxyXG4gICAgdmFyIGNvdW50ID0gMDtcclxuXHJcbiAgICB2YXIgYWJzdHJhY3RMb2NhdGlvblJlZ0V4cCA9IC9eKC4qKTpcXC8oLiopJC87XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQG1lbWJlck9mIFJcclxuICAgICAqIDxwPlIuRmx1eCByZXByZXNlbnRzIHRoZSBkYXRhIGZsb3dpbmcgZnJvbSB0aGUgYmFja2VuZHMgKGVpdGhlciBsb2NhbCBvciByZW1vdGUpLlxyXG4gICAgICogVG8gZW5hYmxlIGlzb21vcHJoaWMgcmVuZGVyaW5nLCBpdCBzaG91bGQgYmUgY29tcHV0YWJsZSBlaXRoZXIgb3IgaW4gdGhlIHNlcnZlciBvciBpbiB0aGUgY2xpZW50LlxyXG4gICAgICogSXQgcmVwcmVzZW50cyB0aGUgZ2xvYmFsIHN0YXRlLCBpbmNsdWRpbmcgYnV0IG5vdCBsaW1pdGVkIHRvOjwvcD5cclxuICAgICAqIDx1bD5cclxuICAgICAqIDxsaT5Sb3V0aW5nIGluZm9ybWF0aW9uPC9saT5cclxuICAgICAqIDxsaT5TZXNzaW9uIGluZm9ybWF0aW9uPC9saT5cclxuICAgICAqIDxsaT5OYXZpZ2F0aW9uIGluZm9ybWF0aW9uPC9saT5cclxuICAgICAqIDwvdWw+XHJcbiAgICAgKiA8cD5JbnNpZGUgYW4gQXBwLCBlYWNoIGNvbXBvbmVudHMgY2FuIGludGVyYWN0IHdpdGggdGhlIEZsdXggaW5zdGFuY2UgdXNpbmcgRmx1eC5NaXhpbiAoZ2VuZXJhbGx5IHZpYSBSb290Lk1peGluIG9yIENvbXBvbmVudC5NaXhpbikuPC9wPlxyXG4gICAgICogQGNsYXNzIFIuRmx1eFxyXG4gICAgICovXHJcbiAgICB2YXIgRmx1eCA9IHtcclxuICAgICAgICAvKipcclxuICAgICAgICAqIDxwPlJldHVybnMgYSBGbHV4IGNvbnN0cnVjdG9yPC9wPlxyXG4gICAgICAgICogQG1ldGhvZCBjcmVhdGVGbHV4XHJcbiAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gc3BlY3MgVGhlIHNwZWNpZmljYXRpb25zIG9mIHRoZSBmbHV4XHJcbiAgICAgICAgKi9cclxuICAgICAgICBjcmVhdGVGbHV4OiBmdW5jdGlvbiBjcmVhdGVGbHV4KHNwZWNzKSB7XHJcbiAgICAgICAgICAgIFIuRGVidWcuZGV2KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgYXNzZXJ0KF8uaXNPYmplY3Qoc3BlY3MpLCBcIlIuY3JlYXRlRmx1eCguLi4pOiBleHBlY3RpbmcgYW4gT2JqZWN0LlwiKTtcclxuICAgICAgICAgICAgICAgIGFzc2VydChfLmhhcyhzcGVjcywgXCJib290c3RyYXBJbkNsaWVudFwiKSAmJiBfLmlzRnVuY3Rpb24oc3BlY3MuYm9vdHN0cmFwSW5DbGllbnQpLCBcIlIuY3JlYXRlRmx1eCguLi4pOiByZXF1aXJlcyBib290c3RyYXBJbkNsaWVudChXaW5kb3cpOiBGdW5jdGlvblwiKTtcclxuICAgICAgICAgICAgICAgIGFzc2VydChfLmhhcyhzcGVjcywgXCJib290c3RyYXBJblNlcnZlclwiKSAmJiBfLmlzRnVuY3Rpb24oc3BlY3MuYm9vdHN0cmFwSW5TZXJ2ZXIpLCBcIlIuY3JlYXRlRmx1eCguLi4pOiByZXF1aXJlcyBib290c3RyYXBJblNlcnZlcihodHRwLkluY29taW5nTWVzc2FnZSk6IEZ1bmN0aW9uXCIpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgdmFyIEZsdXhJbnN0YW5jZSA9IGZ1bmN0aW9uKCkgeyBSLkZsdXguRmx1eEluc3RhbmNlLmNhbGwodGhpcyk7IH07XHJcbiAgICAgICAgICAgIF8uZXh0ZW5kKEZsdXhJbnN0YW5jZS5wcm90b3R5cGUsIFIuRmx1eC5GbHV4SW5zdGFuY2UucHJvdG90eXBlLCBzcGVjcyk7XHJcbiAgICAgICAgICAgIHJldHVybiBGbHV4SW5zdGFuY2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAqIDxwPkNoZWNrIGlmIHRoZSBmbHV4IHByb3ZpZGVkIGJ5IHByb3BzIGlzIGFuIG9iamVjdCBhbmQgYSBmbHV4IGluc3RhbmNlPC9wPlxyXG4gICAgICAgICogQHBhcmFtIHtvYmplY3R9IHByb3BzIFRoZSBwcm9wcyB0byBjaGVja1xyXG4gICAgICAgICogQHJldHVybiB7Qm9vbGVhbn0gdmFsaWQgVGhlIHJlc3VsdCBib29sZWFuIG9mIHRoZSBjaGVja2VkIGZsdXhcclxuICAgICAgICAqL1xyXG4gICAgICAgIFByb3BUeXBlOiBmdW5jdGlvbiB2YWxpZGF0ZUZsdXgocHJvcHMsIHByb3BOYW1lLCBjb21wb25lbnROYW1lKSB7XHJcbiAgICAgICAgICAgIHZhciBmbHV4ID0gcHJvcHMuZmx1eDtcclxuICAgICAgICAgICAgdmFyIHZhbGlkID0gbnVsbDtcclxuICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgIGFzc2VydChfLmlzT2JqZWN0KGZsdXgpICYmIGZsdXguX2lzRmx1eEluc3RhbmNlXywgXCJSLlJvb3QuY3JlYXRlQ2xhc3MoLi4uKTogZXhwZWN0aW5nIGEgUi5GbHV4LkZsdXhJbnN0YW5jZS5cIik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXRjaChlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YWxpZCA9IGVycjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiB2YWxpZDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIEZsdXhJbnN0YW5jZTogZnVuY3Rpb24gRmx1eEluc3RhbmNlKCkge1xyXG4gICAgICAgICAgICB0aGlzLl9zdG9yZXMgPSB7fTtcclxuICAgICAgICAgICAgdGhpcy5fZXZlbnRFbWl0dGVycyA9IHt9O1xyXG4gICAgICAgICAgICB0aGlzLl9kaXNwYXRjaGVycyA9IHt9O1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgTWl4aW46IHtcclxuICAgICAgICAgICAgX0ZsdXhNaXhpblN1YnNjcmlwdGlvbnM6IG51bGwsXHJcbiAgICAgICAgICAgIF9GbHV4TWl4aW5MaXN0ZW5lcnM6IG51bGwsXHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAqIDxwPlRoZSBnZXRJbml0aWFsU3RhdGUgb2YgUmVhY3QgbWVjaGFuaWNzIHdpbGwgYmUgY2FsbCBhdDo8L3A+XHJcbiAgICAgICAgICAgICogIC0gUmVhY3QucmVuZGVyKCkgPGJyIC8+XHJcbiAgICAgICAgICAgICogIC0gUmVhY3QucmVuZGVyVG9TdHJpbmcoKSA8YnIgLz5cclxuICAgICAgICAgICAgKiA8cD5OZXZlciByZXR1cm4gYSBudWxsIG9iamVjdCwgYnkgZGVmYXVsdDoge30sIG90aGVyd2lzZSByZXR1cm4gZGF0YSBzdG9ja2VkIGZyb20gdGhlIGNvcnJlc3BvbmRpbmcgc3RvcmU8L3A+XHJcbiAgICAgICAgICAgICogQG1ldGhvZCBnZXRJbml0aWFsU3RhdGVcclxuICAgICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9IG9iamVjdCBBbiBvYmplY3QgbGlrZTogW3N0YXRlS2V5LCBkYXRhXVxyXG4gICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uIGdldEluaXRpYWxTdGF0ZSgpIHtcclxuICAgICAgICAgICAgICAgIHZhciBzdWJzY3JpcHRpb25zID0gdGhpcy5nZXRGbHV4U3RvcmVTdWJzY3JpcHRpb25zKHRoaXMucHJvcHMpO1xyXG4gICAgICAgICAgICAgICAgLyogUmV0dXJuIGNvbXB1dGVkIGRhdGFzIGZyb20gQ29tcG9uZW50J3Mgc3Vic2NyaXB0aW9ucyAqL1xyXG4gICAgICAgICAgICAgICAgaWYodGhpcy5nZXRGbHV4KCkuc2hvdWxkSW5qZWN0RnJvbVN0b3JlcygpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIF8ub2JqZWN0KF8ubWFwKHN1YnNjcmlwdGlvbnMsIFIuc2NvcGUoZnVuY3Rpb24oc3RhdGVLZXksIGxvY2F0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByID0gYWJzdHJhY3RMb2NhdGlvblJlZ0V4cC5leGVjKGxvY2F0aW9uKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KHIgIT09IG51bGwsIFwiUi5GbHV4LmdldEluaXRpYWxTdGF0ZSguLi4pOiBpbmNvcnJlY3QgbG9jYXRpb24gKCdcIiArIHRoaXMuZGlzcGxheU5hbWUgKyBcIicsICdcIiArIGxvY2F0aW9uICsgXCInLCAnXCIgKyBzdGF0ZUtleSArIFwiJylcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzdG9yZU5hbWUgPSByWzFdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3RvcmVLZXkgPSByWzJdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gW3N0YXRlS2V5LCB0aGlzLmdldEZsdXhTdG9yZShzdG9yZU5hbWUpLmdldChzdG9yZUtleSldO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sIHRoaXMpKSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAvKiBSZXR1cm4gc3RhdGVLZXk6bnVsbCB2YWx1ZXMgZm9yIGVhY2ggc3Vic2NyaXB0aW9ucyAqL1xyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIF8ub2JqZWN0KF8ubWFwKHN1YnNjcmlwdGlvbnMsIGZ1bmN0aW9uKHN0YXRlS2V5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBbc3RhdGVLZXksIG51bGxdO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICogPHA+VGhlIGNvbXBvbmVudFdpbGxNb3VudCBvZiBSZWFjdCBtZWNoYW5pY3M8L3A+XHJcbiAgICAgICAgICAgICogPHA+SW5pdGlhbGl6ZSBmbHV4IGZ1bmN0aW9ucyBmb3IgZWFjaCBjb21wb25lbnRzIHdoZW4gY29tcG9uZW50V2lsbE1vdW50IGlzIGludm9rZWQgYnkgUmVhY3Q8L3A+XHJcbiAgICAgICAgICAgICogQG1ldGhvZCBjb21wb25lbnRXaWxsTW91bnRcclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgY29tcG9uZW50V2lsbE1vdW50OiBmdW5jdGlvbiBjb21wb25lbnRXaWxsTW91bnQoKSB7XHJcbiAgICAgICAgICAgICAgICBSLkRlYnVnLmRldihSLnNjb3BlKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGFzc2VydCh0aGlzLmdldEZsdXggJiYgXy5pc0Z1bmN0aW9uKHRoaXMuZ2V0Rmx1eCksIFwiUi5GbHV4Lk1peGluLmNvbXBvbmVudFdpbGxNb3VudCguLi4pOiByZXF1aXJlcyBnZXRGbHV4KCk6IFIuRmx1eC5GbHV4SW5zdGFuY2UuXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIGFzc2VydCh0aGlzLl9Bc3luY01peGluSGFzQXN5bmNNaXhpbiwgXCJSLkZsdXguTWl4aW4uY29tcG9uZW50V2lsbE1vdW50KC4uLik6IHJlcXVpcmVzIFIuQXN5bmMuTWl4aW4uXCIpO1xyXG4gICAgICAgICAgICAgICAgfSwgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fRmx1eE1peGluTGlzdGVuZXJzID0ge307XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9GbHV4TWl4aW5TdWJzY3JpcHRpb25zID0ge307XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9GbHV4TWl4aW5SZXNwb25zZXMgPSB7fTtcclxuICAgICAgICAgICAgICAgIGlmKCF0aGlzLmdldEZsdXhTdG9yZVN1YnNjcmlwdGlvbnMpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmdldEZsdXhTdG9yZVN1YnNjcmlwdGlvbnMgPSB0aGlzLl9GbHV4TWl4aW5EZWZhdWx0R2V0Rmx1eFN0b3JlU3Vic2NyaXB0aW9ucztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmKCF0aGlzLmdldEZsdXhFdmVudEVtaXR0ZXJzTGlzdGVuZXJzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5nZXRGbHV4RXZlbnRFbWl0dGVyc0xpc3RlbmVycyA9IHRoaXMuX0ZsdXhNaXhpbkRlZmF1bHRHZXRGbHV4RXZlbnRFbWl0dGVyc0xpc3RlbmVycztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmKCF0aGlzLmZsdXhTdG9yZVdpbGxVcGRhdGUpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmZsdXhTdG9yZVdpbGxVcGRhdGUgPSB0aGlzLl9GbHV4TWl4aW5EZWZhdWx0Rmx1eFN0b3JlV2lsbFVwZGF0ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmKCF0aGlzLmZsdXhTdG9yZURpZFVwZGF0ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmx1eFN0b3JlRGlkVXBkYXRlID0gdGhpcy5fRmx1eE1peGluRGVmYXVsdEZsdXhTdG9yZURpZFVwZGF0ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmKCF0aGlzLmZsdXhFdmVudEVtaXR0ZXJXaWxsRW1pdCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmx1eEV2ZW50RW1pdHRlcldpbGxFbWl0ID0gdGhpcy5fRmx1eE1peGluRGVmYXVsdEZsdXhFdmVudEVtaXR0ZXJXaWxsRW1pdDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmKCF0aGlzLmZsdXhFdmVudEVtaXR0ZXJEaWRFbWl0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mbHV4RXZlbnRFbWl0dGVyRGlkRW1pdCA9IHRoaXMuX0ZsdXhNaXhpbkRlZmF1bHRGbHV4RXZlbnRFbWl0dGVyRGlkRW1pdDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuXHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAqIDxwPkNhbGwgdGhlIG1hbmFnZXIgc3Vic2NyaXB0aW9ucyB3aGVuIGNvbXBvbmVuZERpZE1vdW50IGlzIGludm9rZWQgYnkgUmVhY3QgKG9ubHkgY2xpZW50LXNpZGUpPC9wPlxyXG4gICAgICAgICAgICAqIEBtZXRob2QgY29tcG9uZW50RGlkTW91bnRcclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgY29tcG9uZW50RGlkTW91bnQ6IGZ1bmN0aW9uIGNvbXBvbmVudERpZE1vdW50KCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fRmx1eE1peGluVXBkYXRlKHRoaXMucHJvcHMpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBjb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzOiBmdW5jdGlvbiBjb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzKHByb3BzKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9GbHV4TWl4aW5VcGRhdGUocHJvcHMpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBjb21wb25lbnRXaWxsVW5tb3VudDogZnVuY3Rpb24gY29tcG9uZW50V2lsbFVubW91bnQoKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9GbHV4TWl4aW5DbGVhcigpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBnZXRGbHV4U3RvcmU6IGZ1bmN0aW9uIGdldEZsdXhTdG9yZShuYW1lKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5nZXRGbHV4KCkuZ2V0U3RvcmUobmFtZSk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAqIDxwPkZldGNoIGFsbCBjb21wb25lbnRzIGZyb20gYSByb290IGNvbXBvbmVudCBpbiBvcmRlciB0byBpbml0aWFsaXplIGFsbCBkYXRhLCBmaWxsIHRoZSBjb3JyZXNwb25kaW5nIHN0b3JlczwvcD5cclxuICAgICAgICAgICAgKiA8cD5FeGVjdXRlZCBzZXJ2ZXItc2lkZTxwPlxyXG4gICAgICAgICAgICAqIEBtZXRob2QgcHJlZmV0Y2hGbHV4U3RvcmVzXHJcbiAgICAgICAgICAgICogQHJldHVybiB7dm9pZH1cclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgcHJlZmV0Y2hGbHV4U3RvcmVzOiBmdW5jdGlvbiogcHJlZmV0Y2hGbHV4U3RvcmVzKCkge1xyXG4gICAgICAgICAgICAgICAgLy9HZXQgYWxsIHN1YnNjcmlwdGlvbnMgZnJvbSBjdXJyZW50IGNvbXBvbmFudFxyXG4gICAgICAgICAgICAgICAgLy9lZy5cInN0b3JlTmFtZTovc3RvcmVLZXlcIjogXCJzdG9yZUtleVwiLFxyXG4gICAgICAgICAgICAgICAgdmFyIHN1YnNjcmlwdGlvbnMgPSB0aGlzLmdldEZsdXhTdG9yZVN1YnNjcmlwdGlvbnModGhpcy5wcm9wcyk7XHJcbiAgICAgICAgICAgICAgICB2YXIgY3VyQ291bnQgPSBjb3VudDtcclxuICAgICAgICAgICAgICAgIHZhciBzdGF0ZSA9IHt9O1xyXG5cclxuICAgICAgICAgICAgICAgIC8vRm9yIGVhY2ggc3Vic2NyaXB0aW9uLCBjYWxsIHRoZSByZXF1ZXN0IHRvIGdldCBkYXRhIGZyb20gdGhlIFVwbGlua1N0b3JlIG9yIE1lbW9yeVN0b3JlXHJcbiAgICAgICAgICAgICAgICAvL1NhdmVzIHRoZSBkYXRhIGluIGEgdmFyaWFibGUgXCJzdGF0ZVwiIHdoaWNoIHdpbGwgdGhlbiBzZXJ2ZSB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgY29tcG9uZW50XHJcbiAgICAgICAgICAgICAgICB5aWVsZCBfLm1hcChzdWJzY3JpcHRpb25zLCBSLnNjb3BlKGZ1bmN0aW9uKHN0YXRlS2V5LCBsb2NhdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShSLnNjb3BlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgciA9IGFic3RyYWN0TG9jYXRpb25SZWdFeHAuZXhlYyhsb2NhdGlvbik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKHIgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByZWplY3QobmV3IEVycm9yKFwiUi5GbHV4LnByZWZldGNoRmx1eFN0b3JlcyguLi4pOiBpbmNvcnJlY3QgbG9jYXRpb24gKCdcIiArIHRoaXMuZGlzcGxheU5hbWUgKyBcIicsICdcIiArIGxvY2F0aW9uICsgXCInLCAnXCIgKyBzdGF0ZUtleSArIFwiJylcIikpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHN0b3JlTmFtZSA9IHJbMV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3RvcmVLZXkgPSByWzJdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY28oZnVuY3Rpb24qKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vZm9yIFVwbGluaywgcmVxdWVzdGVkIHVybCBpcyA6IC9zdG9yZU5hbWUvc3RvcmVLZXkgb24gdGhlIFVwbGlua1NlcnZlclxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vdGhlIHJlc3BvbnNlIGlzIHN0b3JlZCBpbiBzdGF0ZVtzdGF0ZUtleV1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL2ZvciBNZW1vcnksIGRhdGEgY29tZXMgZnJvbSBpbnN0YWxsZWQgcGx1Z2lucyBsaWtlIFdpbmRvdywgSGlzdG9yeSwgZXRjLlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vZmluYWxseSBkYXRhIGlzIHNhdmVkIGluIHRoaXMuZ2V0Rmx1eFN0b3JlKHN0b3JlTmFtZSkgdGhhdCB3aWxsIGJlIHVzZWQgaW4gZ2V0SW5pdGlhbFN0YXRlIGZvciBjdXJyZW50Q29tcG9uZW50XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdGVbc3RhdGVLZXldID0geWllbGQgdGhpcy5nZXRGbHV4U3RvcmUoc3RvcmVOYW1lKS5mZXRjaChzdG9yZUtleSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KS5jYWxsKHRoaXMsIGZ1bmN0aW9uKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0KFIuRGVidWcuZXh0ZW5kRXJyb3IoZXJyLCBcIkNvdWxkbid0IHByZWZldGNoIHN1YnNjcmlwdGlvbiAoJ1wiICsgc3RhdGVLZXkgKyBcIicsICdcIiArIGxvY2F0aW9uICsgXCInKVwiKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSwgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgfSwgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5nZXRGbHV4KCkuc3RhcnRJbmplY3RpbmdGcm9tU3RvcmVzKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy9DcmVhdGUgdGhlIFJlYWN0IGluc3RhbmNlIG9mIGN1cnJlbnQgY29tcG9uZW50IHdpdGggY29tcHV0ZWQgc3RhdGUgYW5kIHByb3BzXHJcbiAgICAgICAgICAgICAgICAvL0lmIHN0YXRlIG9yIHByb3BzIGFyZSBub3QgY29tcHV0ZWQsIHdlIHdpbGwgbm90IGJlIGFibGUgdG8gY29tcHV0ZSB0aGUgbmV4dCBjaGlsZFxyXG4gICAgICAgICAgICAgICAgdmFyIHN1cnJvZ2F0ZUNvbXBvbmVudCA9IG5ldyB0aGlzLl9fUmVhY3RPblJhaWxzU3Vycm9nYXRlKHRoaXMuY29udGV4dCwgdGhpcy5wcm9wcywgc3RhdGUpO1xyXG4gICAgICAgICAgICAgICAgc3Vycm9nYXRlQ29tcG9uZW50LmNvbXBvbmVudFdpbGxNb3VudCgpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5nZXRGbHV4KCkuc3RvcEluamVjdGluZ0Zyb21TdG9yZXMoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvL1JlbmRlciBjdXJyZW50IGNvbXBvbmVudCBpbiBvcmRlciB0byBnZXQgY2hpbGRzXHJcbiAgICAgICAgICAgICAgICB2YXIgcmVuZGVyZWRDb21wb25lbnQgPSBzdXJyb2dhdGVDb21wb25lbnQucmVuZGVyKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgdmFyIGNoaWxkQ29udGV4dCA9IChzdXJyb2dhdGVDb21wb25lbnQuZ2V0Q2hpbGRDb250ZXh0ID8gc3Vycm9nYXRlQ29tcG9uZW50LmdldENoaWxkQ29udGV4dCgpIDogdGhpcy5jb250ZXh0KTtcclxuXHJcbiAgICAgICAgICAgICAgICBzdXJyb2dhdGVDb21wb25lbnQuY29tcG9uZW50V2lsbFVubW91bnQoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvL0ZldGNoIGNoaWxkcmVuIFJlYWN0IGNvbXBvbmVudCBvZiBjdXJyZW50IGNvbXBvbmVudCBpbiBvcmRlciB0byBjb21wdXRlIHRoZSBuZXh0IGNoaWxkXHJcbiAgICAgICAgICAgICAgICB5aWVsZCBSZWFjdC5DaGlsZHJlbi5tYXBUcmVlKHJlbmRlcmVkQ29tcG9uZW50LCBmdW5jdGlvbihjaGlsZENvbXBvbmVudCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYoIV8uaXNPYmplY3QoY2hpbGRDb21wb25lbnQpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjaGlsZFR5cGUgPSBjaGlsZENvbXBvbmVudC50eXBlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZighXy5pc09iamVjdChjaGlsZFR5cGUpIHx8ICFjaGlsZFR5cGUuX19SZWFjdE9uUmFpbHNTdXJyb2dhdGUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy9DcmVhdGUgdGhlIFJlYWN0IGluc3RhbmNlIG9mIGN1cnJlbnQgY2hpbGQgd2l0aCBwcm9wcywgYnV0IHdpdGhvdXQgY29tcHV0ZWQgc3RhdGVcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHN1cnJvZ2F0ZUNoaWxkQ29tcG9uZW50ID0gbmV3IGNoaWxkVHlwZS5fX1JlYWN0T25SYWlsc1N1cnJvZ2F0ZShjaGlsZENvbnRleHQsIGNoaWxkQ29tcG9uZW50LnByb3BzKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYoIXN1cnJvZ2F0ZUNoaWxkQ29tcG9uZW50LmNvbXBvbmVudFdpbGxNb3VudCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkNvbXBvbmVudCBkb2Vzbid0IGhhdmUgY29tcG9uZW50V2lsbE1vdW50LiBNYXliZSB5b3UgZm9yZ290IFIuQ29tcG9uZW50Lk1peGluPyAoJ1wiICsgc3Vycm9nYXRlQ2hpbGRDb21wb25lbnQuZGlzcGxheU5hbWUgKyBcIicpXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgc3Vycm9nYXRlQ2hpbGRDb21wb25lbnQuY29tcG9uZW50V2lsbE1vdW50KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvKGZ1bmN0aW9uKigpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vUmVjdXJzaXZseSBjYWxsICpwcmVmZXRjaEZsdXhTdG9yZXMqIGZvciB0aGlzIGN1cnJlbnQgY2hpbGQgaW4gb3JkZXIgdG8gY29tcHV0ZSBoaXMgc3RhdGVcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHlpZWxkIHN1cnJvZ2F0ZUNoaWxkQ29tcG9uZW50LnByZWZldGNoRmx1eFN0b3JlcygpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3Vycm9nYXRlQ2hpbGRDb21wb25lbnQuY29tcG9uZW50V2lsbFVubW91bnQoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2FsbCh0aGlzLCBmdW5jdGlvbihlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByZWplY3QoUi5EZWJ1Zy5leHRlbmRFcnJvcihlcnIsIFwiQ291bGRuJ3QgcHJlZmV0Y2ggY2hpbGQgY29tcG9uZW50XCIpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAqIDxwPlJldHVybnMgdGhlIEZsdXhFdmVudEVtaXR0ZXIgYWNjb3JkaW5nIHRoZSBwcm92aWRlZCBuYW1lPC9wPlxyXG4gICAgICAgICAgICAqIEBtZXRob2QgZ2V0Rmx1eEV2ZW50RW1pdHRlclxyXG4gICAgICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIFRoZSBuYW1lXHJcbiAgICAgICAgICAgICogQHJldHVybiB7b2JqZWN0fSBFdmVudEVtaXR0ZXIgdGhlIEV2ZW50RW1pdHRlclxyXG4gICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBnZXRGbHV4RXZlbnRFbWl0dGVyOiBmdW5jdGlvbiBnZXRGbHV4RXZlbnRFbWl0dGVyKG5hbWUpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmdldEZsdXgoKS5nZXRFdmVudEVtaXR0ZXIobmFtZSk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAqIDxwPlJldHVybnMgdGhlIEZsdXhEaXNwYXRjaGVyIGFjY29yZGluZyB0aGUgcHJvdmlkZWQgbmFtZTwvcD5cclxuICAgICAgICAgICAgKiBAbWV0aG9kIGdldEZsdXhEaXNwYXRjaGVyXHJcbiAgICAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgVGhlIG5hbWVcclxuICAgICAgICAgICAgKiBAcmV0dXJuIHtvYmplY3R9IERpc3BhdGNoZXIgdGhlIERpc3BhdGNoZXJcclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgZ2V0Rmx1eERpc3BhdGNoZXI6IGZ1bmN0aW9uIGdldEZsdXhEaXNwYXRjaGVyKG5hbWUpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmdldEZsdXgoKS5nZXREaXNwYXRjaGVyKG5hbWUpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgKiA8cD5HZXQgdGhlIGNvcnJlc3BvbmRpbmcgZGlzcGF0Y2hlciBhbmQgZGlzcGF0Y2ggdGhlIGFjdGlvbiBzdWJtaXR0ZWQgYnkgYSBSZWFjdCBjb21wb25lbnQ8YnIgLz5cclxuICAgICAgICAgICAgKiBUcmlnZ2VkIG9uIGV2ZW50IGxpa2UgXCJjbGlja1wiPC9wPlxyXG4gICAgICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBsb2NhdGlvbiBUaGUgdXJsIHRvIGdvIChlZy4gXCIvL0hpc3RvcnkvbmF2aWdhdGVcIilcclxuICAgICAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gcGFyYW0gVGhlIHNwZWNpZmljIGRhdGEgZm9yIHRoZSBhY3Rpb25cclxuICAgICAgICAgICAgKiBAcmV0dXJuIHsqfSAqIHRoZSBkYXRhIHRoYXQgbWF5IGJlIHByb3ZpZGVkIGJ5IHRoZSBkaXNwYXRjaGVyXHJcbiAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIGRpc3BhdGNoOiBmdW5jdGlvbiogZGlzcGF0Y2gobG9jYXRpb24sIHBhcmFtcykge1xyXG4gICAgICAgICAgICAgICAgdmFyIHIgPSBhYnN0cmFjdExvY2F0aW9uUmVnRXhwLmV4ZWMobG9jYXRpb24pO1xyXG4gICAgICAgICAgICAgICAgYXNzZXJ0KHIgIT09IG51bGwsIFwiUi5GbHV4LmRpc3BhdGNoKC4uLik6IGluY29ycmVjdCBsb2NhdGlvbiAoJ1wiICsgdGhpcy5kaXNwbGF5TmFtZSArIFwiJylcIik7XHJcbiAgICAgICAgICAgICAgICB2YXIgZW50cnkgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZGlzcGF0Y2hlck5hbWU6IHJbMV0sXHJcbiAgICAgICAgICAgICAgICAgICAgYWN0aW9uOiByWzJdLFxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB5aWVsZCB0aGlzLmdldEZsdXhEaXNwYXRjaGVyKGVudHJ5LmRpc3BhdGNoZXJOYW1lKS5kaXNwYXRjaChlbnRyeS5hY3Rpb24sIHBhcmFtcyk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIF9GbHV4TWl4aW5EZWZhdWx0R2V0Rmx1eFN0b3JlU3Vic2NyaXB0aW9uczogZnVuY3Rpb24gZ2V0Rmx1eFN0b3JlU3Vic2NyaXB0aW9ucyhwcm9wcykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHt9O1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBfRmx1eE1peGluRGVmYXVsdEdldEZsdXhFdmVudEVtaXR0ZXJzTGlzdGVuZXJzOiBmdW5jdGlvbiBnZXRGbHV4RXZlbnRFbWl0dGVyc0xpc3RlbmVycyhwcm9wcykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHt9O1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBfRmx1eE1peGluRGVmYXVsdEZsdXhTdG9yZVdpbGxVcGRhdGU6IGZ1bmN0aW9uIGZsdXhTdG9yZVdpbGxVcGRhdGUoc3RvcmVOYW1lLCBzdG9yZUtleSwgbmV3VmFsLCBvbGRWYWwpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB2b2lkIDA7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIF9GbHV4TWl4aW5EZWZhdWx0Rmx1eFN0b3JlRGlkVXBkYXRlOiBmdW5jdGlvbiBmbHV4U3RvcmVEaWRVcGRhdGUoc3RvcmVOYW1lLCBzdG9yZUtleSwgbmV3VmFsLCBvbGRWYWwpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB2b2lkIDA7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIF9GbHV4TWl4aW5EZWZhdWx0Rmx1eEV2ZW50RW1pdHRlcldpbGxFbWl0OiBmdW5jdGlvbiBmbHV4RXZlbnRFbWl0dGVyV2lsbEVtaXQoZXZlbnRFbWl0dGVyTmFtZSwgZXZlbnROYW1lLCBwYXJhbXMpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB2b2lkIDA7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIF9GbHV4TWl4aW5EZWZhdWx0Rmx1eEV2ZW50RW1pdHRlckRpZEVtaXQ6IGZ1bmN0aW9uIGZsdXhFdmVudEVtaXR0ZXJEaWRFbWl0KGV2ZW50RW1pdHRlck5hbWUsIGV2ZW50TmFtZSwgcGFyYW1zKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdm9pZCAwO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBfRmx1eE1peGluQ2xlYXI6IGZ1bmN0aW9uIF9GbHV4TWl4aW5DbGVhcigpIHtcclxuICAgICAgICAgICAgICAgIF8uZWFjaCh0aGlzLl9GbHV4TWl4aW5TdWJzY3JpcHRpb25zLCB0aGlzLl9GbHV4TWl4aW5VbnN1YnNjcmliZSk7XHJcbiAgICAgICAgICAgICAgICBfLmVhY2godGhpcy5fRmx1eE1peGluTGlzdGVuZXJzLCB0aGlzLkZsdXhNaXhpblJlbW92ZUxpc3RlbmVyKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICogPHA+TWFuYWdlIHN1YnNjcmlwdGlvbnMsIHVuc3Vic2NyaXB0aW9ucyBhbmQgZXZlbnQgZW1pdHRlcnM8L3A+XHJcbiAgICAgICAgICAgICogQG1ldGhvZCBfRmx1eE1peGluVXBkYXRlXHJcbiAgICAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHByb3BzIFRoZSBwcm9wcyBvZiBjb21wb25lbnRcclxuICAgICAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBfRmx1eE1peGluVXBkYXRlOiBmdW5jdGlvbiBfRmx1eE1peGluVXBkYXRlKHByb3BzKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgY3VycmVudFN1YnNjcmlwdGlvbnMgPSBfLm9iamVjdChfLm1hcCh0aGlzLl9GbHV4TWl4aW5TdWJzY3JpcHRpb25zLCBmdW5jdGlvbihlbnRyeSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBbZW50cnkubG9jYXRpb24sIGVudHJ5LnN0YXRlS2V5XTtcclxuICAgICAgICAgICAgICAgIH0pKTtcclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgbmV4dFN1YnNjcmlwdGlvbnMgPSB0aGlzLmdldEZsdXhTdG9yZVN1YnNjcmlwdGlvbnMocHJvcHMpO1xyXG4gICAgICAgICAgICAgICAgXy5lYWNoKGN1cnJlbnRTdWJzY3JpcHRpb25zLCBSLnNjb3BlKGZ1bmN0aW9uKHN0YXRlS2V5LCBsb2NhdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKCFuZXh0U3Vic2NyaXB0aW9uc1tsb2NhdGlvbl0gfHwgbmV4dFN1YnNjcmlwdGlvbnNbbG9jYXRpb25dICE9PSBjdXJyZW50U3Vic2NyaXB0aW9uc1tsb2NhdGlvbl0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fRmx1eE1peGluVW5zdWJzY3JpYmUoc3RhdGVLZXksIGxvY2F0aW9uKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LCB0aGlzKSk7XHJcbiAgICAgICAgICAgICAgICBfLmVhY2gobmV4dFN1YnNjcmlwdGlvbnMsIFIuc2NvcGUoZnVuY3Rpb24oc3RhdGVLZXksIGxvY2F0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYoIWN1cnJlbnRTdWJzY3JpcHRpb25zW2xvY2F0aW9uXSB8fCBjdXJyZW50U3Vic2NyaXB0aW9uc1tsb2NhdGlvbl0gIT09IHN0YXRlS2V5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX0ZsdXhNaXhpblN1YnNjcmliZShzdGF0ZUtleSwgbG9jYXRpb24pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sIHRoaXMpKTtcclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgY3VycmVudExpc3RlbmVycyA9IF8ub2JqZWN0KF8ubWFwKHRoaXMuX0ZsdXhNaXhpbkxpc3RlbmVycywgZnVuY3Rpb24oZW50cnkpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gW2VudHJ5LmxvY2F0aW9uLCBlbnRyeS5mbl07XHJcbiAgICAgICAgICAgICAgICB9KSk7XHJcbiAgICAgICAgICAgICAgICB2YXIgbmV4dExpc3RlbmVycyA9IHRoaXMuZ2V0Rmx1eEV2ZW50RW1pdHRlcnNMaXN0ZW5lcnMocHJvcHMpO1xyXG4gICAgICAgICAgICAgICAgXy5lYWNoKGN1cnJlbnRMaXN0ZW5lcnMsIFIuc2NvcGUoZnVuY3Rpb24oZm4sIGxvY2F0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYoIW5leHRMaXN0ZW5lcnNbbG9jYXRpb25dIHx8IG5leHRMaXN0ZW5lcnNbbG9jYXRpb25dICE9PSBjdXJyZW50TGlzdGVuZXJzW2xvY2F0aW9uXSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9GbHV4TWl4aW5SZW1vdmVMaXN0ZW5lcihmbiwgbG9jYXRpb24pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sIHRoaXMpKTtcclxuICAgICAgICAgICAgICAgIF8uZWFjaChuZXh0TGlzdGVuZXJzLCBSLnNjb3BlKGZ1bmN0aW9uKGZuLCBsb2NhdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKCFjdXJyZW50TGlzdGVuZXJzW2xvY2F0aW9uXSB8fCBjdXJyZW50TGlzdGVuZXJzW2xvY2F0aW9uXSAhPT0gZm4pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fRmx1eE1peGluQWRkTGlzdGVuZXIoZm4sIGxvY2F0aW9uKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LCB0aGlzKSk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAqIEBtZXRob2QgX0ZsdXhNaXhpbkluamVjdFxyXG4gICAgICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzdGF0ZUtleSBUaGUgc3RhdGVLZXlcclxuICAgICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gbG9jYXRpb24gVGhlIGxvY2F0aW9uXHJcbiAgICAgICAgICAgICogQHByaXZhdGVcclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgX0ZsdXhNaXhpbkluamVjdDogZnVuY3Rpb24gX0ZsdXhNaXhpbkluamVjdChzdGF0ZUtleSwgbG9jYXRpb24pIHtcclxuICAgICAgICAgICAgICAgIHZhciByID0gYWJzdHJhY3RMb2NhdGlvblJlZ0V4cC5leGVjKGxvY2F0aW9uKTtcclxuICAgICAgICAgICAgICAgIGFzc2VydChyICE9PSBudWxsLCBcIlIuRmx1eC5fRmx1eE1peGluSW5qZWN0KC4uLik6IGluY29ycmVjdCBsb2NhdGlvbiAoJ1wiICsgdGhpcy5kaXNwbGF5TmFtZSArIFwiJywgJ1wiICsgbG9jYXRpb24gKyBcIicsICdcIiArIHN0YXRlS2V5ICsgXCInKVwiKTtcclxuICAgICAgICAgICAgICAgIHZhciBlbnRyeSA9IHtcclxuICAgICAgICAgICAgICAgICAgICBzdG9yZU5hbWU6IHJbMV0sXHJcbiAgICAgICAgICAgICAgICAgICAgc3RvcmVLZXk6IHJbMl0sXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoUi5zY29wZShmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQodGhpcy5nZXRGbHV4KCkuc2hvdWxkSW5qZWN0RnJvbVN0b3JlcygpLCBcIlIuRmx1eC5NaXhpbi5fRmx1eE1peGluSW5qZWN0KC4uLik6IHNob3VsZCBub3QgaW5qZWN0IGZyb20gU3RvcmVzLlwiKTtcclxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoXy5pc1BsYWluT2JqZWN0KGVudHJ5KSwgXCJSLkZsdXguTWl4aW4uX0ZsdXhNaXhpbkluamVjdCguLi4pLmVudHJ5OiBleHBlY3RpbmcgT2JqZWN0LlwiKTtcclxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoXy5oYXMoZW50cnksIFwic3RvcmVOYW1lXCIpICYmIF8uaXNTdHJpbmcoZW50cnkuc3RvcmVOYW1lKSwgXCJSLkZsdXguTWl4aW4uX0ZsdXhNaXhpbkluamVjdCguLi4pLmVudHJ5LnN0b3JlTmFtZTogZXhwZWN0aW5nIFN0cmluZy5cIik7XHJcbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KF8uaGFzKGVudHJ5LCBcInN0b3JlS2V5XCIpICYmIF8uaXNTdHJpbmcoZW50cnkuc3RvcmVLZXkpLCBcIlIuRmx1eC5NaXhpbi5fRmx1eE1peGluSW5qZWN0KC4uLikuZW50cnkuc3RvcmVLZXk6IGV4cGVjdGluZyBTdHJpbmcuXCIpO1xyXG4gICAgICAgICAgICAgICAgfSwgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRTdGF0ZShSLnJlY29yZChzdGF0ZUtleSwgdGhpcy5nZXRGbHV4U3RvcmUoZW50cnkuc3RvcmVOYW1lKS5nZXQoZW50cnkuc3RvcmVLZXkpKSk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAqIDxwPkFsbG93IGEgUmVhY3QgQ29tcG9uZW50IHRvIHN1YnNjcmliZSBhdCBhbnkgZGF0YSBpbiBvcmRlciB0byBmaWxsIHN0YXRlPC9wPlxyXG4gICAgICAgICAgICAqIEBtZXRob2QgX0ZsdXhNaXhpblN1YnNjcmliZVxyXG4gICAgICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzdGF0ZUtleSBUaGUga2V5IHRvIGJlIHN1YnNjcmliZWRcclxuICAgICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gbG9jYXRpb24gVGhlIHVybCB0aGF0IHdpbGwgYmUgcmVxdWVzdGVkXHJcbiAgICAgICAgICAgICogQHJldHVybiB7dm9pZH1cclxuICAgICAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBfRmx1eE1peGluU3Vic2NyaWJlOiBmdW5jdGlvbiBfRmx1eE1peGluU3Vic2NyaWJlKHN0YXRlS2V5LCBsb2NhdGlvbikge1xyXG4gICAgICAgICAgICAgICAgdmFyIHIgPSBhYnN0cmFjdExvY2F0aW9uUmVnRXhwLmV4ZWMobG9jYXRpb24pO1xyXG4gICAgICAgICAgICAgICAgYXNzZXJ0KHIgIT09IG51bGwsIFwiUi5GbHV4Ll9GbHV4TWl4aW5TdWJzY3JpYmUoLi4uKTogaW5jb3JyZWN0IGxvY2F0aW9uICgnXCIgKyB0aGlzLmRpc3BsYXlOYW1lICsgXCInLCAnXCIgKyBsb2NhdGlvbiArIFwiJywgJ1wiICsgc3RhdGVLZXkgKyBcIicpXCIpO1xyXG4gICAgICAgICAgICAgICAgdmFyIGVudHJ5ID0ge1xyXG4gICAgICAgICAgICAgICAgICAgIHN0b3JlTmFtZTogclsxXSxcclxuICAgICAgICAgICAgICAgICAgICBzdG9yZUtleTogclsyXSxcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICBSLkRlYnVnLmRldihSLnNjb3BlKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGFzc2VydChfLmlzUGxhaW5PYmplY3QoZW50cnkpLCBcIlIuRmx1eC5NaXhpbi5fRmx1eE1peGluU3Vic2NyaWJlKC4uLikuZW50cnk6IGV4cGVjdGluZyBPYmplY3QuXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIGFzc2VydChfLmhhcyhlbnRyeSwgXCJzdG9yZU5hbWVcIikgJiYgXy5pc1N0cmluZyhlbnRyeS5zdG9yZU5hbWUpLCBcIlIuRmx1eC5NaXhpbi5fRmx1eE1peGluU3Vic2NyaWJlKC4uLikuZW50cnkuc3RvcmVOYW1lOiBleHBlY3RpbmcgU3RyaW5nLlwiKTtcclxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoXy5oYXMoZW50cnksIFwic3RvcmVLZXlcIikgJiYgXy5pc1N0cmluZyhlbnRyeS5zdG9yZUtleSksIFwiUi5GbHV4Lk1peGluLl9GbHV4TWl4aW5TdWJzY3JpYmUoLi4uKS5lbnRyeS5zdG9yZUtleTogZXhwZWN0aW5nIFN0cmluZy5cIik7XHJcbiAgICAgICAgICAgICAgICB9LCB0aGlzKSk7XHJcbiAgICAgICAgICAgICAgICB2YXIgc3RvcmUgPSB0aGlzLmdldEZsdXhTdG9yZShlbnRyeS5zdG9yZU5hbWUpO1xyXG4gICAgICAgICAgICAgICAgLy9TdWJzY3JpYmUgYW5kIHJlcXVlc3QgU3RvcmUgdG8gZ2V0IGRhdGFcclxuICAgICAgICAgICAgICAgIC8vQ2FsbCBpbW1lZGlhdGx5IF9GbHV4TWl4aW5TdG9yZVNpZ25hbFVwZGF0ZSB3aXRoIGNvbXB1dGVkIGRhdGEgaW4gb3JkZXIgdG8gY2FsbCBzZXRTdGF0ZVxyXG4gICAgICAgICAgICAgICAgdmFyIHN1YnNjcmlwdGlvbiA9IHN0b3JlLnN1YihlbnRyeS5zdG9yZUtleSwgdGhpcy5fRmx1eE1peGluU3RvcmVTaWduYWxVcGRhdGUoc3RhdGVLZXksIGxvY2F0aW9uKSk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy9TYXZlIHN1YnNjcmlwdGlvblxyXG4gICAgICAgICAgICAgICAgdGhpcy5fRmx1eE1peGluU3Vic2NyaXB0aW9uc1tzdWJzY3JpcHRpb24udW5pcXVlSWRdID0ge1xyXG4gICAgICAgICAgICAgICAgICAgIGxvY2F0aW9uOiBsb2NhdGlvbixcclxuICAgICAgICAgICAgICAgICAgICBzdGF0ZUtleTogc3RhdGVLZXksXHJcbiAgICAgICAgICAgICAgICAgICAgc3RvcmVOYW1lOiBlbnRyeS5zdG9yZU5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgc3Vic2NyaXB0aW9uOiBzdWJzY3JpcHRpb24sXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgKiA8cD5SZXJlbmRlcmluZyBhIGNvbXBvbmVudCB3aGVuIGRhdGEgdXBkYXRlIG9jY3VyczwvcD5cclxuICAgICAgICAgICAgKiBAbWV0aG9kIF9GbHV4TWl4aW5TdG9yZVNpZ25hbFVwZGF0ZVxyXG4gICAgICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBzdGF0ZUtleSBUaGUga2V5IHRvIGJlIHN1YnNjcmliZWRcclxuICAgICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gbG9jYXRpb24gVGhlIHVybCB0aGF0IHdpbGwgYmUgcmVxdWVzdGVkXHJcbiAgICAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XHJcbiAgICAgICAgICAgICogQHByaXZhdGVcclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgX0ZsdXhNaXhpblN0b3JlU2lnbmFsVXBkYXRlOiBmdW5jdGlvbiBfRmx1eE1peGluU3RvcmVTaWduYWxVcGRhdGUoc3RhdGVLZXksIGxvY2F0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gUi5zY29wZShmdW5jdGlvbih2YWwpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZighdGhpcy5pc01vdW50ZWQoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBwcmV2aW91c1ZhbCA9IHRoaXMuc3RhdGUgPyB0aGlzLnN0YXRlW3N0YXRlS2V5XSA6IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgICAgICAgICBpZihfLmlzRXF1YWwocHJldmlvdXNWYWwsIHZhbCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmZsdXhTdG9yZVdpbGxVcGRhdGUoc3RhdGVLZXksIGxvY2F0aW9uLCB2YWwsIHByZXZpb3VzVmFsKTtcclxuICAgICAgICAgICAgICAgICAgICAvL0NhbGwgcmVhY3QgQVBJIGluIG9yZGVyIHRvIFJlcmVuZGVyIGNvbXBvbmVudFxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0U3RhdGUoUi5yZWNvcmQoc3RhdGVLZXksIHZhbCkpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmx1eFN0b3JlRGlkVXBkYXRlKHN0YXRlS2V5LCBsb2NhdGlvbiwgdmFsLCBwcmV2aW91c1ZhbCk7XHJcbiAgICAgICAgICAgICAgICB9LCB0aGlzKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICogQG1ldGhvZCBfRmx1eE1peGluQWRkTGlzdGVuZXJcclxuICAgICAgICAgICAgKiBAcGFyYW0ge0ZvbmN0aW9ufSBmbiBUaGUgZm5cclxuICAgICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gbG9jYXRpb24gVGhlIGxvY2F0aW9uXHJcbiAgICAgICAgICAgICogQHByaXZhdGVcclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgX0ZsdXhNaXhpbkFkZExpc3RlbmVyOiBmdW5jdGlvbiBfRmx1eE1peGluQWRkTGlzdGVuZXIoZm4sIGxvY2F0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgciA9IGFic3RyYWN0TG9jYXRpb25SZWdFeHAuZXhlYyhsb2NhdGlvbik7XHJcbiAgICAgICAgICAgICAgICBhc3NlcnQociAhPT0gbnVsbCwgXCJSLkZsdXguX0ZsdXhNaXhpbkFkZExpc3RlbmVyKC4uLik6IGluY29ycmVjdCBsb2NhdGlvbiAoJ1wiICsgdGhpcy5kaXNwbGF5TmFtZSArIFwiJywgJ1wiICsgbG9jYXRpb24gKyBcIicpXCIpO1xyXG4gICAgICAgICAgICAgICAgdmFyIGVudHJ5ID0ge1xyXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50RW1pdHRlck5hbWU6IHJbMV0sXHJcbiAgICAgICAgICAgICAgICAgICAgZXZlbnROYW1lOiByWzJdLFxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgIFIuRGVidWcuZGV2KFIuc2NvcGUoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KF8uaXNQbGFpbk9iamVjdChlbnRyeSksIFwiUi5GbHV4Lk1peGluLl9GbHV4TWl4aW5BZGRMaXN0ZW5lciguLi4pLmVudHJ5OiBleHBlY3RpbmcgT2JqZWN0LlwiKTtcclxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoXy5oYXMoZW50cnksIFwiZXZlbnRFbWl0dGVyTmFtZVwiKSAmJiBfLmlzU3RyaW5nKGVudHJ5LmV2ZW50RW1pdHRlck5hbWUpLCBcIlIuRmx1eC5NaXhpbi5fRmx1eE1peGluQWRkTGlzdGVuZXIoLi4uKS5lbnRyeS5ldmVudEVtaXR0ZXJOYW1lOiBleHBlY3RpbmcgU3RyaW5nLlwiKTtcclxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoXy5oYXMoZW50cnksIFwiZXZlbnROYW1lXCIpICYmIF8uaXNTdHJpbmcoZW50cnkuZXZlbnROYW1lKSwgXCJSLkZsdXguTWl4aW4uX0ZsdXhNaXhpbkFkZExpc3RlbmVyKC4uLikuZW50cnkuZXZlbnROYW1lOiBleHBlY3RpbmcgU3RyaW5nLlwiKTtcclxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoXy5oYXMoZW50cnksIFwiZm5cIikgJiYgXy5pc0Z1bmN0aW9uKGZuKSwgXCJSLkZsdXguTWl4aW4uX0ZsdXhNaXhpbkFkZExpc3RlbmVyKC4uLikuZW50cnkuZm46IGV4cGVjdGluZyBGdW5jdGlvbi5cIik7XHJcbiAgICAgICAgICAgICAgICB9LCB0aGlzKSk7XHJcbiAgICAgICAgICAgICAgICB2YXIgZXZlbnRFbWl0dGVyID0gdGhpcy5nZXRGbHV4RXZlbnRFbWl0dGVyKGVudHJ5LmV2ZW50RW1pdHRlck5hbWUpO1xyXG4gICAgICAgICAgICAgICAgdmFyIGxpc3RlbmVyID0gZXZlbnRFbWl0dGVyLmFkZExpc3RlbmVyKGVudHJ5LmV2ZW50TmFtZSwgdGhpcy5fRmx1eE1peGluRXZlbnRFbWl0dGVyRW1pdChlbnRyeS5ldmVudEVtaXR0ZXJOYW1lLCBlbnRyeS5ldmVudE5hbWUsIGVudHJ5LmZuKSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9GbHV4TWl4aW5MaXN0ZW5lcnNbbGlzdGVuZXIudW5pcXVlSWRdID0ge1xyXG4gICAgICAgICAgICAgICAgICAgIGxvY2F0aW9uOiBsb2NhdGlvbixcclxuICAgICAgICAgICAgICAgICAgICBmbjogZm4sXHJcbiAgICAgICAgICAgICAgICAgICAgZXZlbnRFbWl0dGVyTmFtZTogZW50cnkuZXZlbnRFbWl0dGVyTmFtZSxcclxuICAgICAgICAgICAgICAgICAgICBsaXN0ZW5lcjogbGlzdGVuZXIsXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgKiBAbWV0aG9kIF9GbHV4TWl4aW5FdmVudEVtaXR0ZXJFbWl0XHJcbiAgICAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50RW1pdHRlck5hbWUgVGhlIGV2ZW50RW1pdHRlck5hbWVcclxuICAgICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lIFRoZSBldmVudE5hbWVcclxuICAgICAgICAgICAgKiBAcGFyYW0ge0ZvbmN0aW9ufSBmbiBUaGUgZm5cclxuICAgICAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBfRmx1eE1peGluRXZlbnRFbWl0dGVyRW1pdDogZnVuY3Rpb24gX0ZsdXhNaXhpbkV2ZW50RW1pdHRlckVtaXQoZXZlbnRFbWl0dGVyTmFtZSwgZXZlbnROYW1lLCBmbikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFIuc2NvcGUoZnVuY3Rpb24ocGFyYW1zKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYoIXRoaXMuaXNNb3VudGVkKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmZsdXhFdmVudEVtaXR0ZXJXaWxsRW1pdChldmVudEVtaXR0ZXJOYW1lLCBldmVudE5hbWUsIHBhcmFtcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgZm4ocGFyYW1zKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmZsdXhFdmVudEVtaXR0ZXJEaWRFbWl0KGV2ZW50RW1pdHRlck5hbWUsIGV2ZW50TmFtZSwgcGFyYW1zKTtcclxuICAgICAgICAgICAgICAgIH0sIHRoaXMpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgKiBAbWV0aG9kIF9GbHV4TWl4aW5VbnN1YnNjcmliZVxyXG4gICAgICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBlbnRyeSBUaGUgZW50cnlcclxuICAgICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gdW5pcXVlSWQgVGhlIHVuaXF1ZUlkXHJcbiAgICAgICAgICAgICogQHByaXZhdGVcclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgX0ZsdXhNaXhpblVuc3Vic2NyaWJlOiBmdW5jdGlvbiBfRmx1eE1peGluVW5zdWJzY3JpYmUoZW50cnksIHVuaXF1ZUlkKSB7XHJcbiAgICAgICAgICAgICAgICBSLkRlYnVnLmRldihSLnNjb3BlKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGFzc2VydChfLmhhcyh0aGlzLl9GbHV4TWl4aW5TdWJzY3JpcHRpb25zLCB1bmlxdWVJZCksIFwiUi5GbHV4Lk1peGluLl9GbHV4TWl4aW5VbnN1YnNjcmliZSguLi4pOiBubyBzdWNoIHN1YnNjcmlwdGlvbi5cIik7XHJcbiAgICAgICAgICAgICAgICB9LCB0aGlzKSk7XHJcbiAgICAgICAgICAgICAgICB2YXIgc3Vic2NyaXB0aW9uID0gZW50cnkuc3Vic2NyaXB0aW9uO1xyXG4gICAgICAgICAgICAgICAgdmFyIHN0b3JlTmFtZSA9IGVudHJ5LnN0b3JlTmFtZTtcclxuICAgICAgICAgICAgICAgIHRoaXMuZ2V0Rmx1eFN0b3JlKHN0b3JlTmFtZSkudW5zdWIoc3Vic2NyaXB0aW9uKTtcclxuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9GbHV4TWl4aW5TdWJzY3JpcHRpb25zW3VuaXF1ZUlkXTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICogQG1ldGhvZCBfRmx1eE1peGluUmVtb3ZlTGlzdGVuZXJcclxuICAgICAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gZW50cnkgVGhlIGVudHJ5XHJcbiAgICAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IHVuaXF1ZUlkIFRoZSB1bmlxdWVJZFxyXG4gICAgICAgICAgICAqIEBwcml2YXRlXHJcbiAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIF9GbHV4TWl4aW5SZW1vdmVMaXN0ZW5lcjogZnVuY3Rpb24gX0ZsdXhNaXhpblJlbW92ZUxpc3RlbmVyKGVudHJ5LCB1bmlxdWVJZCkge1xyXG4gICAgICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoUi5zY29wZShmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoXy5oYXModGhpcy5fRmx1eE1peGluTGlzdGVuZXJzLCB1bmlxdWVJZCksIFwiUi5GbHV4Lk1peGluLl9GbHV4TWl4aW5SZW1vdmVMaXN0ZW5lciguLi4pOiBubyBzdWNoIGxpc3RlbmVyLlwiKTtcclxuICAgICAgICAgICAgICAgIH0sIHRoaXMpKTtcclxuICAgICAgICAgICAgICAgIHZhciBsaXN0ZW5lciA9IGVudHJ5Lmxpc3RlbmVyO1xyXG4gICAgICAgICAgICAgICAgdmFyIGV2ZW50RW1pdHRlck5hbWUgPSBlbnRyeS5ldmVudEVtaXR0ZXJOYW1lO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5nZXRGbHV4RXZlbnRFbWl0dGVyKGV2ZW50RW1pdHRlck5hbWUpLnJlbW92ZUxpc3RlbmVyKGxpc3RlbmVyKTtcclxuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9GbHV4TWl4aW5MaXN0ZW5lcnNbdW5pcXVlSWRdO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICB9O1xyXG5cclxuICAgIF8uZXh0ZW5kKEZsdXguRmx1eEluc3RhbmNlLnByb3RvdHlwZSwgLyoqIEBsZW5kcyBSLkZsdXguRmx1eEluc3RhbmNlLnByb3RvdHlwZSAqL3tcclxuICAgICAgICBfaXNGbHV4SW5zdGFuY2VfOiB0cnVlLFxyXG4gICAgICAgIF9zdG9yZXM6IG51bGwsXHJcbiAgICAgICAgX2V2ZW50RW1pdHRlcnM6IG51bGwsXHJcbiAgICAgICAgX2Rpc3BhdGNoZXJzOiBudWxsLFxyXG4gICAgICAgIF9zaG91bGRJbmplY3RGcm9tU3RvcmVzOiBmYWxzZSxcclxuICAgICAgICBib290c3RyYXBJbkNsaWVudDogXy5ub29wLFxyXG4gICAgICAgIGJvb3RzdHJhcEluU2VydmVyOiBfLm5vb3AsXHJcbiAgICAgICAgZGVzdHJveUluQ2xpZW50OiBfLm5vb3AsXHJcbiAgICAgICAgZGVzdHJveUluU2VydmVyOiBfLm5vb3AsXHJcbiAgICAgICAgc2hvdWxkSW5qZWN0RnJvbVN0b3JlczogZnVuY3Rpb24gc2hvdWxkSW5qZWN0RnJvbVN0b3JlcygpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3Nob3VsZEluamVjdEZyb21TdG9yZXM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAqIDxwPlNldHMgdGhlIGZsYWcgdGVsbGluZyBhbGwgdGhlIGZsdXgtbWl4ZWQtaW4gY29tcG9uZW50cyB0byBhdHRlbXB0IHRvIGluamVjdCBwcmUtZmV0Y2hlZCB2YWx1ZXMgZnJvbSB0aGUgY2FjaGUuIFVzZWQgZm9yIHByZS1yZW5kZXJpbmcgbWFnaWMuPC9wPlxyXG4gICAgICAgICogQG1ldGhvZCBzdGFydEluamVjdGluZ0Zyb21TdG9yZXNcclxuICAgICAgICAqL1xyXG4gICAgICAgIHN0YXJ0SW5qZWN0aW5nRnJvbVN0b3JlczogZnVuY3Rpb24gc3RhcnRJbmplY3RpbmdGcm9tU3RvcmVzKCkge1xyXG4gICAgICAgICAgICBSLkRlYnVnLmRldihSLnNjb3BlKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgYXNzZXJ0KCF0aGlzLl9zaG91bGRJbmplY3RGcm9tU3RvcmVzLCBcIlIuRmx1eC5GbHV4SW5zdGFuY2Uuc3RhcnRJbmplY3RpbmdGcm9tU3RvcmVzKC4uLik6IHNob3VsZCBub3QgYmUgaW5qZWN0aW5nIGZyb20gU3RvcmVzLlwiKTtcclxuICAgICAgICAgICAgfSwgdGhpcykpO1xyXG4gICAgICAgICAgICB0aGlzLl9zaG91bGRJbmplY3RGcm9tU3RvcmVzID0gdHJ1ZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICogPHA+VW5zZXRzIHRoZSBmbGFnIHRlbGxpbmcgYWxsIHRoZSBmbHV4LW1peGVkLWluIGNvbXBvbmVudHMgdG8gYXR0ZW1wdCB0byBpbmplY3QgcHJlLWZldGNoZWQgdmFsdWVzIGZyb20gdGhlIGNhY2hlLiBVc2VkIGZvciBwcmUtcmVuZGVyaW5nIG1hZ2ljLjwvcD5cclxuICAgICAgICAqIEBtZXRob2Qgc3RhcnRJbmplY3RpbmdGcm9tU3RvcmVzXHJcbiAgICAgICAgKi9cclxuICAgICAgICBzdG9wSW5qZWN0aW5nRnJvbVN0b3JlczogZnVuY3Rpb24gc3RvcEluamVjdGluZ0Zyb21TdG9yZXMoKSB7XHJcbiAgICAgICAgICAgIFIuRGVidWcuZGV2KFIuc2NvcGUoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICBhc3NlcnQodGhpcy5fc2hvdWxkSW5qZWN0RnJvbVN0b3JlcywgXCJSLkZsdXguRmx1eEluc3RhbmNlLnN0b3BJbmplY3RpbmdGcm9tU3RvcmVzKC4uLik6IHNob3VsZCBiZSBpbmplY3RpbmcgZnJvbSBTdG9yZXMuXCIpO1xyXG4gICAgICAgICAgICB9LCB0aGlzKSk7XHJcbiAgICAgICAgICAgIHRoaXMuX3Nob3VsZEluamVjdEZyb21TdG9yZXMgPSBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICogPHA+U2VyaWFsaXplIGEgc2VyaWFsaXplZCBmbHV4IGJ5IHRoZSBzZXJ2ZXIgaW4gb3JkZXIgdG8gaW5pdGlhbGl6ZSBmbHV4IGludG8gY2xpZW50PC9wPlxyXG4gICAgICAgICogQG1ldGhvZCBzZXJpYWxpemVcclxuICAgICAgICAqIEByZXR1cm4ge3N0cmluZ30gc3RyaW5nIFRoZSBzZXJpYWxpemVkIHN0cmluZ1xyXG4gICAgICAgICovXHJcbiAgICAgICAgc2VyaWFsaXplOiBmdW5jdGlvbiBzZXJpYWxpemUoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBSLkJhc2U2NC5lbmNvZGUoSlNPTi5zdHJpbmdpZnkoXy5tYXBWYWx1ZXModGhpcy5fc3RvcmVzLCBmdW5jdGlvbihzdG9yZSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHN0b3JlLnNlcmlhbGl6ZSgpO1xyXG4gICAgICAgICAgICB9KSkpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiBVbnNlcmlhbGl6ZSBhIHNlcmlhbGl6ZWQgZmx1eCBieSB0aGUgc2VydmVyIGluIG9yZGVyIHRvIGluaXRpYWxpemUgZmx1eCBpbnRvIGNsaWVudFxyXG4gICAgICAgICogQG1ldGhvZCB1bnNlcmlhbGl6ZVxyXG4gICAgICAgICogQHBhcmFtIHtzdHJpbmd9IHN0ciBUaGUgc3RyaW5nIHRvIHVuc2VyaWFsaXplXHJcbiAgICAgICAgKi9cclxuICAgICAgICB1bnNlcmlhbGl6ZTogZnVuY3Rpb24gdW5zZXJpYWxpemUoc3RyKSB7XHJcbiAgICAgICAgICAgIF8uZWFjaChKU09OLnBhcnNlKFIuQmFzZTY0LmRlY29kZShzdHIpKSwgUi5zY29wZShmdW5jdGlvbihzZXJpYWxpemVkU3RvcmUsIG5hbWUpIHtcclxuICAgICAgICAgICAgICAgIFIuRGVidWcuZGV2KFIuc2NvcGUoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KF8uaGFzKHRoaXMuX3N0b3JlcywgbmFtZSksIFwiUi5GbHV4LkZsdXhJbnN0YW5jZS51bnNlcmlhbGl6ZSguLi4pOiBubyBzdWNoIFN0b3JlLiAoXCIgKyBuYW1lICsgXCIpXCIpO1xyXG4gICAgICAgICAgICAgICAgfSwgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fc3RvcmVzW25hbWVdLnVuc2VyaWFsaXplKHNlcmlhbGl6ZWRTdG9yZSk7XHJcbiAgICAgICAgICAgIH0sIHRoaXMpKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICogPHA+R2V0dGVyIGZvciB0aGUgc3RvcmU8L3A+XHJcbiAgICAgICAgKiBAbWV0aG9kIGdldFN0b3JlXHJcbiAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgc3RvcmVcclxuICAgICAgICAqIEByZXR1cm4ge29iamVjdH0gc3RvcmUgVGhlIGNvcnJlc3BvbmRpbmcgc3RvcmVcclxuICAgICAgICAqL1xyXG4gICAgICAgIGdldFN0b3JlOiBmdW5jdGlvbiBnZXRTdG9yZShuYW1lKSB7XHJcbiAgICAgICAgICAgIFIuRGVidWcuZGV2KFIuc2NvcGUoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICBhc3NlcnQoXy5oYXModGhpcy5fc3RvcmVzLCBuYW1lKSwgXCJSLkZsdXguRmx1eEluc3RhbmNlLmdldFN0b3JlKC4uLik6IG5vIHN1Y2ggU3RvcmUuIChcIiArIG5hbWUgKyBcIilcIik7XHJcbiAgICAgICAgICAgIH0sIHRoaXMpKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3N0b3Jlc1tuYW1lXTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICogPHA+UmVnaXN0ZXIgYSBzdG9yZSBkZWZpbmVkIGluIHRoZSBmbHV4IGNsYXNzIG9mIEFwcCA8YnIgLz5cclxuICAgICAgICAqIFR5cGljYWxseSA6IE1lbW9yeSBvciBVcGxpbms8L3A+XHJcbiAgICAgICAgKiBAbWV0aG9kIHJlZ2lzdGVyU3RvcmVcclxuICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIFRoZSBuYW1lIHRvIHJlZ2lzdGVyXHJcbiAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gc3RvcmUgVGhlIHN0b3JlIHRvIHJlZ2lzdGVyXHJcbiAgICAgICAgKi9cclxuICAgICAgICByZWdpc3RlclN0b3JlOiBmdW5jdGlvbiByZWdpc3RlclN0b3JlKG5hbWUsIHN0b3JlKSB7XHJcbiAgICAgICAgICAgIFIuRGVidWcuZGV2KFIuc2NvcGUoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICBhc3NlcnQoc3RvcmUuX2lzU3RvcmVJbnN0YW5jZV8sIFwiUi5GbHV4LkZsdXhJbnN0YW5jZS5yZWdpc3RlclN0b3JlKC4uLik6IGV4cGVjdGluZyBhIFIuU3RvcmUuU3RvcmVJbnN0YW5jZS4gKFwiICsgbmFtZSArIFwiKVwiKTtcclxuICAgICAgICAgICAgICAgIGFzc2VydCghXy5oYXModGhpcy5fc3RvcmVzLCBuYW1lKSwgXCJSLkZsdXguRmx1eEluc3RhbmNlLnJlZ2lzdGVyU3RvcmUoLi4uKTogbmFtZSBhbHJlYWR5IGFzc2lnbmVkLiAoXCIgKyBuYW1lICsgXCIpXCIpO1xyXG4gICAgICAgICAgICB9LCB0aGlzKSk7XHJcbiAgICAgICAgICAgIHRoaXMuX3N0b3Jlc1tuYW1lXSA9IHN0b3JlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiA8cD5HZXR0ZXIgZm9yIHRoZSBldmVudCBlbWl0dGVyPC9wPlxyXG4gICAgICAgICogQG1ldGhvZCBnZXRFdmVudEVtaXR0ZXJcclxuICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBzdG9yZVxyXG4gICAgICAgICogQHJldHVybiB7b2JqZWN0fSBldmVudEVtaXR0ZXIgVGhlIGNvcnJlc3BvbmRpbmcgZXZlbnQgZW1pdHRlclxyXG4gICAgICAgICovXHJcbiAgICAgICAgZ2V0RXZlbnRFbWl0dGVyOiBmdW5jdGlvbiBnZXRFdmVudEVtaXR0ZXIobmFtZSkge1xyXG4gICAgICAgICAgICBSLkRlYnVnLmRldihSLnNjb3BlKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgYXNzZXJ0KF8uaGFzKHRoaXMuX2V2ZW50RW1pdHRlcnMsIG5hbWUpLCBcIlIuRmx1eC5GbHV4SW5zdGFuY2UuZ2V0RXZlbnRFbWl0dGVyKC4uLik6IG5vIHN1Y2ggRXZlbnRFbWl0dGVyLiAoXCIgKyBuYW1lICsgXCIpXCIpO1xyXG4gICAgICAgICAgICB9LCB0aGlzKSk7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9ldmVudEVtaXR0ZXJzW25hbWVdO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICogPHA+UmVnaXN0ZXIgYW4gZXZlbnQgZW1pdHRlciBkZWZpbmVkIGluIHRoZSBmbHV4IGNsYXNzIG9mIEFwcDwvcD5cclxuICAgICAgICAqIEBtZXRob2QgcmVnaXN0ZXJFdmVudEVtaXR0ZXJcclxuICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIFRoZSBuYW1lIHRvIHJlZ2lzdGVyXHJcbiAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gZXZlbnRFbWl0dGVyIFRoZSBldmVudCBlbWl0dGVyIHRvIHJlZ2lzdGVyXHJcbiAgICAgICAgKi9cclxuICAgICAgICByZWdpc3RlckV2ZW50RW1pdHRlcjogZnVuY3Rpb24gcmVnaXN0ZXJFdmVudEVtaXR0ZXIobmFtZSwgZXZlbnRFbWl0dGVyKSB7XHJcbiAgICAgICAgICAgIGFzc2VydChSLmlzQ2xpZW50KCksIFwiUi5GbHV4LkZsdXhJbnN0YW5jZS5yZWdpc3RlckV2ZW50RW1pdHRlciguLi4pOiBzaG91bGQgbm90IGJlIGNhbGxlZCBpbiB0aGUgc2VydmVyLlwiKTtcclxuICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoUi5zY29wZShmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIGFzc2VydChldmVudEVtaXR0ZXIuX2lzRXZlbnRFbWl0dGVySW5zdGFuY2VfLCBcIlIuRmx1eC5GbHV4SW5zdGFuY2UucmVnaXN0ZXJFdmVudEVtaXR0ZXIoLi4uKTogZXhwZWN0aW5nIGEgUi5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVySW5zdGFuY2UuIChcIiArIG5hbWUgKyBcIilcIik7XHJcbiAgICAgICAgICAgICAgICBhc3NlcnQoIV8uaGFzKHRoaXMuX2V2ZW50RW1pdHRlcnMsIG5hbWUpLCBcIlIuRmx1eC5GbHV4SW5zdGFuY2UucmVnaXN0ZXJFdmVudEVtaXR0ZXIoLi4uKTogbmFtZSBhbHJlYWR5IGFzc2lnbmVkLiAoXCIgKyBuYW1lICsgXCIpXCIpO1xyXG4gICAgICAgICAgICB9LCB0aGlzKSk7XHJcbiAgICAgICAgICAgIHRoaXMuX2V2ZW50RW1pdHRlcnNbbmFtZV0gPSBldmVudEVtaXR0ZXI7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiA8cD5HZXR0ZXIgZm9yIHRoZSBkaXNwYXRjaGVyPC9wPlxyXG4gICAgICAgICogQG1ldGhvZCBnZXREaXNwYXRjaGVyXHJcbiAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgc3RvcmVcclxuICAgICAgICAqIEByZXR1cm4ge29iamVjdH0gZGlzcGF0Y2hlciBUaGUgY29ycmVzcG9uZGluZyBkaXNwYXRjaGVyXHJcbiAgICAgICAgKi9cclxuICAgICAgICBnZXREaXNwYXRjaGVyOiBmdW5jdGlvbiBnZXREaXNwYXRjaGVyKG5hbWUpIHtcclxuICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoUi5zY29wZShmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIGFzc2VydChfLmhhcyh0aGlzLl9kaXNwYXRjaGVycywgbmFtZSksIFwiUi5GbHV4LkZsdXhJbnN0YW5jZS5nZXREaXNwYXRjaGVyKC4uLik6IG5vIHN1Y2ggRGlzcGF0Y2hlci4gKFwiICsgbmFtZSArIFwiKVwiKTtcclxuICAgICAgICAgICAgfSwgdGhpcykpO1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fZGlzcGF0Y2hlcnNbbmFtZV07XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAqIDxwPlJlZ2lzdGVyIGEgZGlzcGF0Y2hlciBkZWZpbmVkIGluIHRoZSBmbHV4IGNsYXNzIG9mIEFwcDwvcD5cclxuICAgICAgICAqIEBtZXRob2QgcmVnaXN0ZXJEaXNwYXRjaGVyXHJcbiAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBUaGUgbmFtZSB0byByZWdpc3RlclxyXG4gICAgICAgICogQHBhcmFtIHtvYmplY3R9IGRpc3BhdGNoZXIgVGhlIGRpc3BhdGNoZXIgdG8gcmVnaXN0ZXJcclxuICAgICAgICAqL1xyXG4gICAgICAgIHJlZ2lzdGVyRGlzcGF0Y2hlcjogZnVuY3Rpb24gcmVnaXN0ZXJEaXNwYXRjaGVyKG5hbWUsIGRpc3BhdGNoZXIpIHtcclxuICAgICAgICAgICAgYXNzZXJ0KFIuaXNDbGllbnQoKSwgXCJSLkZsdXguRmx1eEluc3RhbmNlLnJlZ2lzdGVyRGlzcGF0Y2hlciguLi4pOiBzaG91bGQgbm90IGJlIGNhbGxlZCBpbiB0aGUgc2VydmVyLiAoXCIgKyBuYW1lICsgXCIpXCIpO1xyXG4gICAgICAgICAgICBSLkRlYnVnLmRldihSLnNjb3BlKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgYXNzZXJ0KGRpc3BhdGNoZXIuX2lzRGlzcGF0Y2hlckluc3RhbmNlXywgXCJSLkZsdXguRmx1eEluc3RhbmNlLnJlZ2lzdGVyRGlzcGF0Y2hlciguLi4pOiBleHBlY3RpbmcgYSBSLkRpc3BhdGNoZXIuRGlzcGF0Y2hlckluc3RhbmNlIChcIiArIG5hbWUgKyBcIilcIik7XHJcbiAgICAgICAgICAgICAgICBhc3NlcnQoIV8uaGFzKHRoaXMuX2Rpc3BhdGNoZXJzLCBuYW1lKSwgXCJSLkZsdXguRmx1eEluc3RhbmNlLnJlZ2lzdGVyRGlzcGF0Y2hlciguLi4pOiBuYW1lIGFscmVhZHkgYXNzaWduZWQuIChcIiArIG5hbWUgKyBcIilcIik7XHJcbiAgICAgICAgICAgIH0sIHRoaXMpKTtcclxuICAgICAgICAgICAgdGhpcy5fZGlzcGF0Y2hlcnNbbmFtZV0gPSBkaXNwYXRjaGVyO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICogPHA+Q2xlYXJzIHRoZSBzdG9yZSBieSBjYWxsaW5nIGVpdGhlciB0aGlzLmRlc3Ryb3lJblNlcnZlciBvciB0aGlzLmRlc3Ryb3lJbkNsaWVudCBhbmQgcmVjdXJzaXZlbHkgYXBwbHlpbmcgZGVzdHJveSBvbiBlYWNoIHN0b3JlL2V2ZW50IGVtaXR0cmUvZGlzcGF0Y2hlci48YnIgLz5cclxuICAgICAgICAqIFVzZWQgZm9yIHByZS1yZW5kZXJpbmcgbWFnaWMuPC9wPlxyXG4gICAgICAgICogQG1ldGhvZCBkZXN0cm95XHJcbiAgICAgICAgKi9cclxuICAgICAgICBkZXN0cm95OiBmdW5jdGlvbiBkZXN0cm95KCkge1xyXG4gICAgICAgICAgICBpZihSLmlzQ2xpZW50KCkpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZGVzdHJveUluQ2xpZW50KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYoUi5pc1NlcnZlcigpKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmRlc3Ryb3lJblNlcnZlcigpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIF8uZWFjaCh0aGlzLl9zdG9yZXMsIGZ1bmN0aW9uKHN0b3JlKSB7XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5kZXN0cm95KCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB0aGlzLl9zdG9yZXMgPSBudWxsO1xyXG4gICAgICAgICAgICBfLmVhY2godGhpcy5fZXZlbnRFbWl0dGVycywgZnVuY3Rpb24oZXZlbnRFbWl0dGVyKSB7XHJcbiAgICAgICAgICAgICAgICBldmVudEVtaXR0ZXIuZGVzdHJveSgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgdGhpcy5fZXZlbnRFbWl0dGVycyA9IG51bGw7XHJcbiAgICAgICAgICAgIF8uZWFjaCh0aGlzLl9kaXNwYXRjaGVycywgZnVuY3Rpb24oZGlzcGF0Y2hlcikge1xyXG4gICAgICAgICAgICAgICAgZGlzcGF0Y2hlci5kZXN0cm95KCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB0aGlzLl9kaXNwYXRjaGVycyA9IG51bGw7XHJcbiAgICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiBGbHV4O1xyXG59O1xyXG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=