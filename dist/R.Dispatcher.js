"use strict";

require("6to5/polyfill");
var Promise = require("bluebird");
module.exports = function (R) {
  var _ = require("lodash");
  var assert = require("assert");

  /**
  * <p>R.Dispatcher acts as a layer between Store/EventEmitters and components.
  * A React component may submit an action to a dispatcher (such as a click event) and perform updates required.</p>
  * <ul>
  * <li> Dispatcher.createDispatcher => initialize methods according to the specifications provided</li>
  * <li> Dispatcher.addActionListener => add an action listener</li>
  * <li> Dispatcher.removeActionListener => remove an action listener</li>
  * <li> Dispatcher.dispatch => dispatches an action submitted by a React component</li>
  * <li> Dispatcher.destroy => remove all listener previously added</li>
  * </ul>
  * @class R.Dispatcher
  */
  var Dispatcher = {
    /**
    * Initializes the dispatcher according to the specifications provided
    * @method createDispatcher
    * @param {object} specs The specifications
    * @return {DispatcherInstance} DispatcherInstance The created dispatcher instance
    */
    createDispatcher: function createDispatcher(specs) {
      R.Debug.dev(function () {
        assert(_.isObject(specs), "R.Dispatcher.createDispatcher(...).specs: expecting Object.");
        assert(specs.actions && _.isObject(specs.actions), "R.Dispatcher.createDispatcher(...).specs.actions: expecting Object.");
        assert(specs.displayName && _.isString(specs.displayName), "R.Dispatcher.createDispatcher(...).specs.displayName: expecting String.");
      });

      var DispatcherInstance = function DispatcherInstance() {
        this._actionsListeners = {};
        this.addActionListener = R.scope(this.addActionListener, this);
        this.removeActionListener = R.scope(this.removeActionListener, this);
        this.dispatch = R.scope(this.dispatch, this);
        _.each(specs, R.scope(function (val, attr) {
          if (_.isFunction(val)) {
            this[attr] = R.scope(val, this);
          }
        }, this));
        _.each(specs.actions, this.addActionListener);
      };

      _.extend(DispatcherInstance.prototype, specs, R.Dispatcher._DispatcherInstancePrototype);

      return DispatcherInstance;
    },
    _DispatcherInstancePrototype: {
      _isDispatcherInstance_: true,
      displayName: null,
      _actionsListeners: null,
      /**
      * <p>Register an async action listener</p>
      * @method addActionListener
      * @param {object} action The action name
      * @param {Function} fn The function to execute when the listener will be notified
      * @return {Dispatcher.ActionListener} actionListener The created actionListener
      */
      addActionListener: function addActionListener(action, fn) {
        var actionListener = new R.Dispatcher.ActionListener(action);
        if (!_.has(this._actionsListeners, action)) {
          this._actionsListeners[action] = {};
        }
        this._actionsListeners[action][actionListener.uniqueId] = fn;
        return actionListener;
      },
      /**
      * <p>Remove the previously added action listener</p>
      * @method removeActionListener
      * @param {object} actionListener The action name
      */
      removeActionListener: function removeActionListener(actionListener) {
        R.Debug.dev(R.scope(function () {
          assert(actionListener instanceof R.Dispatcher.ActionListener, "R.Dispatcher.DispatcherInstance.removeActionListener(...): type R.Dispatcher.ActionListener expected.");
          assert(_.has(this._actionsListeners, actionListener), "R.Dispatcher.DispatcherInstance.removeActionListener(...): no action listener for this action.");
          assert(_.has(this._actionsListeners[actionListener.action], actionListener.uniqueId), "R.Dispatcher.DispatcherInstance.removeActionListener(...): no such action listener.");
        }, this));
        delete this._actionsListeners[actionListener.action][actionListener.uniqueId];
        if (_.size(this._actionsListeners[actionListener.action]) === 0) {
          delete this._actionsListeners[actionListener.action];
        }
      },
      /**
      * <p>Dispatches an action submitted by a React component</p>
      * @method dispatch
      * @param {action} action The action name of the listener
      * @param {object} params The specifics params necessary for an action
      * @return {*} * the data that may be provided by the listener function
      */
      dispatch: regeneratorRuntime.mark(function dispatch(action, params) {
        return regeneratorRuntime.wrap(function dispatch$(context$2$0) {
          while (1) switch (context$2$0.prev = context$2$0.next) {case 0:

              params = params || {};
              R.Debug.dev(R.scope(function () {
                if (!_.has(this._actionsListeners, action)) {
                  console.warn("R.Dispatcher.DispatcherInstance.dispatch: dispatching an action with no listeners attached.");
                }
              }, this));

              if (!_.has(this._actionsListeners, action)) {
                context$2$0.next = 6;
                break;
              }
              context$2$0.next = 5;
              return _.map(this._actionsListeners[action], function (listener) {
                return listener(params);
              });

            case 5: return context$2$0.abrupt("return", context$2$0.sent);
            case 6:
            case "end": return context$2$0.stop();
          }
        }, dispatch, this);
      }),
      /**
      * <p>Remove all listener previously added </p>
      * @method destroy
      */
      destroy: function destroy() {
        _.each(this._actionsListeners, this.removeActionListener);
      } } };

  Dispatcher.ActionListener = function ActionListener(action) {
    this.uniqueId = _.uniqueId("ActionListener");
    this.action = action;
  };

  _.extend(Dispatcher.ActionListener.prototype, /** @lends R.Dispatcher.ActionListener */{
    /**
     * @property
     * @type {String}
     * @private
     * @readOnly
     */
    uniqueId: null,
    /**
     * @property
     * @type {String}
     * @private
     * @readOnly
     */
    action: null });

  return Dispatcher;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImQ6L3dvcmtzcGFjZV9yZWZhY3Rvci9yZWFjdC1yYWlscy9zcmMvUi5EaXNwYXRjaGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3pCLElBQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNwQyxNQUFNLENBQUMsT0FBTyxHQUFHLFVBQVMsQ0FBQyxFQUFFO0FBQ3pCLE1BQUksQ0FBQyxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUMxQixNQUFJLE1BQU0sR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7Ozs7Ozs7Ozs7Ozs7O0FBYy9CLE1BQUksVUFBVSxHQUFHOzs7Ozs7O0FBT2Isb0JBQWdCLEVBQUUsU0FBUyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUU7QUFDL0MsT0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsWUFBVztBQUNuQixjQUFNLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRSw2REFBNkQsQ0FBQyxDQUFDO0FBQ3pGLGNBQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxFQUFFLHFFQUFxRSxDQUFDLENBQUM7QUFDMUgsY0FBTSxDQUFDLEtBQUssQ0FBQyxXQUFXLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLEVBQUUseUVBQXlFLENBQUMsQ0FBQztPQUN6SSxDQUFDLENBQUM7O0FBRUgsVUFBSSxrQkFBa0IsR0FBRyxTQUFTLGtCQUFrQixHQUFHO0FBQ25ELFlBQUksQ0FBQyxpQkFBaUIsR0FBRyxFQUFFLENBQUM7QUFDNUIsWUFBSSxDQUFDLGlCQUFpQixHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxDQUFDO0FBQy9ELFlBQUksQ0FBQyxv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QyIsImZpbGUiOiJSLkRpc3BhdGNoZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJyZXF1aXJlKCc2dG81L3BvbHlmaWxsJyk7XG5jb25zdCBQcm9taXNlID0gcmVxdWlyZSgnYmx1ZWJpcmQnKTtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oUikge1xyXG4gICAgdmFyIF8gPSByZXF1aXJlKFwibG9kYXNoXCIpO1xyXG4gICAgdmFyIGFzc2VydCA9IHJlcXVpcmUoXCJhc3NlcnRcIik7XHJcblxyXG4gICAgLyoqXHJcbiAgICAqIDxwPlIuRGlzcGF0Y2hlciBhY3RzIGFzIGEgbGF5ZXIgYmV0d2VlbiBTdG9yZS9FdmVudEVtaXR0ZXJzIGFuZCBjb21wb25lbnRzLlxyXG4gICAgKiBBIFJlYWN0IGNvbXBvbmVudCBtYXkgc3VibWl0IGFuIGFjdGlvbiB0byBhIGRpc3BhdGNoZXIgKHN1Y2ggYXMgYSBjbGljayBldmVudCkgYW5kIHBlcmZvcm0gdXBkYXRlcyByZXF1aXJlZC48L3A+XHJcbiAgICAqIDx1bD5cclxuICAgICogPGxpPiBEaXNwYXRjaGVyLmNyZWF0ZURpc3BhdGNoZXIgPT4gaW5pdGlhbGl6ZSBtZXRob2RzIGFjY29yZGluZyB0byB0aGUgc3BlY2lmaWNhdGlvbnMgcHJvdmlkZWQ8L2xpPlxyXG4gICAgKiA8bGk+IERpc3BhdGNoZXIuYWRkQWN0aW9uTGlzdGVuZXIgPT4gYWRkIGFuIGFjdGlvbiBsaXN0ZW5lcjwvbGk+XHJcbiAgICAqIDxsaT4gRGlzcGF0Y2hlci5yZW1vdmVBY3Rpb25MaXN0ZW5lciA9PiByZW1vdmUgYW4gYWN0aW9uIGxpc3RlbmVyPC9saT5cclxuICAgICogPGxpPiBEaXNwYXRjaGVyLmRpc3BhdGNoID0+IGRpc3BhdGNoZXMgYW4gYWN0aW9uIHN1Ym1pdHRlZCBieSBhIFJlYWN0IGNvbXBvbmVudDwvbGk+XHJcbiAgICAqIDxsaT4gRGlzcGF0Y2hlci5kZXN0cm95ID0+IHJlbW92ZSBhbGwgbGlzdGVuZXIgcHJldmlvdXNseSBhZGRlZDwvbGk+XHJcbiAgICAqIDwvdWw+XHJcbiAgICAqIEBjbGFzcyBSLkRpc3BhdGNoZXJcclxuICAgICovXHJcbiAgICB2YXIgRGlzcGF0Y2hlciA9IHtcclxuICAgICAgICAvKipcclxuICAgICAgICAqIEluaXRpYWxpemVzIHRoZSBkaXNwYXRjaGVyIGFjY29yZGluZyB0byB0aGUgc3BlY2lmaWNhdGlvbnMgcHJvdmlkZWRcclxuICAgICAgICAqIEBtZXRob2QgY3JlYXRlRGlzcGF0Y2hlclxyXG4gICAgICAgICogQHBhcmFtIHtvYmplY3R9IHNwZWNzIFRoZSBzcGVjaWZpY2F0aW9uc1xyXG4gICAgICAgICogQHJldHVybiB7RGlzcGF0Y2hlckluc3RhbmNlfSBEaXNwYXRjaGVySW5zdGFuY2UgVGhlIGNyZWF0ZWQgZGlzcGF0Y2hlciBpbnN0YW5jZVxyXG4gICAgICAgICovXHJcbiAgICAgICAgY3JlYXRlRGlzcGF0Y2hlcjogZnVuY3Rpb24gY3JlYXRlRGlzcGF0Y2hlcihzcGVjcykge1xyXG4gICAgICAgICAgICBSLkRlYnVnLmRldihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIGFzc2VydChfLmlzT2JqZWN0KHNwZWNzKSwgXCJSLkRpc3BhdGNoZXIuY3JlYXRlRGlzcGF0Y2hlciguLi4pLnNwZWNzOiBleHBlY3RpbmcgT2JqZWN0LlwiKTtcclxuICAgICAgICAgICAgICAgIGFzc2VydChzcGVjcy5hY3Rpb25zICYmIF8uaXNPYmplY3Qoc3BlY3MuYWN0aW9ucyksIFwiUi5EaXNwYXRjaGVyLmNyZWF0ZURpc3BhdGNoZXIoLi4uKS5zcGVjcy5hY3Rpb25zOiBleHBlY3RpbmcgT2JqZWN0LlwiKTtcclxuICAgICAgICAgICAgICAgIGFzc2VydChzcGVjcy5kaXNwbGF5TmFtZSAmJiBfLmlzU3RyaW5nKHNwZWNzLmRpc3BsYXlOYW1lKSwgXCJSLkRpc3BhdGNoZXIuY3JlYXRlRGlzcGF0Y2hlciguLi4pLnNwZWNzLmRpc3BsYXlOYW1lOiBleHBlY3RpbmcgU3RyaW5nLlwiKTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICB2YXIgRGlzcGF0Y2hlckluc3RhbmNlID0gZnVuY3Rpb24gRGlzcGF0Y2hlckluc3RhbmNlKCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fYWN0aW9uc0xpc3RlbmVycyA9IHt9O1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hZGRBY3Rpb25MaXN0ZW5lciA9IFIuc2NvcGUodGhpcy5hZGRBY3Rpb25MaXN0ZW5lciwgdGhpcyk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnJlbW92ZUFjdGlvbkxpc3RlbmVyID0gUi5zY29wZSh0aGlzLnJlbW92ZUFjdGlvbkxpc3RlbmVyLCB0aGlzKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2ggPSBSLnNjb3BlKHRoaXMuZGlzcGF0Y2gsIHRoaXMpO1xyXG4gICAgICAgICAgICAgICAgXy5lYWNoKHNwZWNzLCBSLnNjb3BlKGZ1bmN0aW9uKHZhbCwgYXR0cikge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKF8uaXNGdW5jdGlvbih2YWwpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXNbYXR0cl0gPSBSLnNjb3BlKHZhbCwgdGhpcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSwgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgXy5lYWNoKHNwZWNzLmFjdGlvbnMsIHRoaXMuYWRkQWN0aW9uTGlzdGVuZXIpO1xyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgXy5leHRlbmQoRGlzcGF0Y2hlckluc3RhbmNlLnByb3RvdHlwZSwgc3BlY3MsIFIuRGlzcGF0Y2hlci5fRGlzcGF0Y2hlckluc3RhbmNlUHJvdG90eXBlKTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBEaXNwYXRjaGVySW5zdGFuY2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBfRGlzcGF0Y2hlckluc3RhbmNlUHJvdG90eXBlOiB7XHJcbiAgICAgICAgICAgIF9pc0Rpc3BhdGNoZXJJbnN0YW5jZV86IHRydWUsXHJcbiAgICAgICAgICAgIGRpc3BsYXlOYW1lOiBudWxsLFxyXG4gICAgICAgICAgICBfYWN0aW9uc0xpc3RlbmVyczogbnVsbCxcclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICogPHA+UmVnaXN0ZXIgYW4gYXN5bmMgYWN0aW9uIGxpc3RlbmVyPC9wPlxyXG4gICAgICAgICAgICAqIEBtZXRob2QgYWRkQWN0aW9uTGlzdGVuZXJcclxuICAgICAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gYWN0aW9uIFRoZSBhY3Rpb24gbmFtZVxyXG4gICAgICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIFRoZSBmdW5jdGlvbiB0byBleGVjdXRlIHdoZW4gdGhlIGxpc3RlbmVyIHdpbGwgYmUgbm90aWZpZWRcclxuICAgICAgICAgICAgKiBAcmV0dXJuIHtEaXNwYXRjaGVyLkFjdGlvbkxpc3RlbmVyfSBhY3Rpb25MaXN0ZW5lciBUaGUgY3JlYXRlZCBhY3Rpb25MaXN0ZW5lclxyXG4gICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBhZGRBY3Rpb25MaXN0ZW5lcjogZnVuY3Rpb24gYWRkQWN0aW9uTGlzdGVuZXIoYWN0aW9uLCBmbikge1xyXG4gICAgICAgICAgICAgICAgdmFyIGFjdGlvbkxpc3RlbmVyID0gbmV3IFIuRGlzcGF0Y2hlci5BY3Rpb25MaXN0ZW5lcihhY3Rpb24pO1xyXG4gICAgICAgICAgICAgICAgaWYoIV8uaGFzKHRoaXMuX2FjdGlvbnNMaXN0ZW5lcnMsIGFjdGlvbikpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hY3Rpb25zTGlzdGVuZXJzW2FjdGlvbl0gPSB7fTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRoaXMuX2FjdGlvbnNMaXN0ZW5lcnNbYWN0aW9uXVthY3Rpb25MaXN0ZW5lci51bmlxdWVJZF0gPSBmbjtcclxuICAgICAgICAgICAgICAgIHJldHVybiBhY3Rpb25MaXN0ZW5lcjtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICogPHA+UmVtb3ZlIHRoZSBwcmV2aW91c2x5IGFkZGVkIGFjdGlvbiBsaXN0ZW5lcjwvcD5cclxuICAgICAgICAgICAgKiBAbWV0aG9kIHJlbW92ZUFjdGlvbkxpc3RlbmVyXHJcbiAgICAgICAgICAgICogQHBhcmFtIHtvYmplY3R9IGFjdGlvbkxpc3RlbmVyIFRoZSBhY3Rpb24gbmFtZVxyXG4gICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICByZW1vdmVBY3Rpb25MaXN0ZW5lcjogZnVuY3Rpb24gcmVtb3ZlQWN0aW9uTGlzdGVuZXIoYWN0aW9uTGlzdGVuZXIpIHtcclxuICAgICAgICAgICAgICAgIFIuRGVidWcuZGV2KFIuc2NvcGUoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KGFjdGlvbkxpc3RlbmVyIGluc3RhbmNlb2YgUi5EaXNwYXRjaGVyLkFjdGlvbkxpc3RlbmVyLCBcIlIuRGlzcGF0Y2hlci5EaXNwYXRjaGVySW5zdGFuY2UucmVtb3ZlQWN0aW9uTGlzdGVuZXIoLi4uKTogdHlwZSBSLkRpc3BhdGNoZXIuQWN0aW9uTGlzdGVuZXIgZXhwZWN0ZWQuXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIGFzc2VydChfLmhhcyh0aGlzLl9hY3Rpb25zTGlzdGVuZXJzLCBhY3Rpb25MaXN0ZW5lciksIFwiUi5EaXNwYXRjaGVyLkRpc3BhdGNoZXJJbnN0YW5jZS5yZW1vdmVBY3Rpb25MaXN0ZW5lciguLi4pOiBubyBhY3Rpb24gbGlzdGVuZXIgZm9yIHRoaXMgYWN0aW9uLlwiKTtcclxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoXy5oYXModGhpcy5fYWN0aW9uc0xpc3RlbmVyc1thY3Rpb25MaXN0ZW5lci5hY3Rpb25dLCBhY3Rpb25MaXN0ZW5lci51bmlxdWVJZCksIFwiUi5EaXNwYXRjaGVyLkRpc3BhdGNoZXJJbnN0YW5jZS5yZW1vdmVBY3Rpb25MaXN0ZW5lciguLi4pOiBubyBzdWNoIGFjdGlvbiBsaXN0ZW5lci5cIik7XHJcbiAgICAgICAgICAgICAgICB9LCB0aGlzKSk7XHJcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fYWN0aW9uc0xpc3RlbmVyc1thY3Rpb25MaXN0ZW5lci5hY3Rpb25dW2FjdGlvbkxpc3RlbmVyLnVuaXF1ZUlkXTtcclxuICAgICAgICAgICAgICAgIGlmKF8uc2l6ZSh0aGlzLl9hY3Rpb25zTGlzdGVuZXJzW2FjdGlvbkxpc3RlbmVyLmFjdGlvbl0pID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2FjdGlvbnNMaXN0ZW5lcnNbYWN0aW9uTGlzdGVuZXIuYWN0aW9uXTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICogPHA+RGlzcGF0Y2hlcyBhbiBhY3Rpb24gc3VibWl0dGVkIGJ5IGEgUmVhY3QgY29tcG9uZW50PC9wPlxyXG4gICAgICAgICAgICAqIEBtZXRob2QgZGlzcGF0Y2hcclxuICAgICAgICAgICAgKiBAcGFyYW0ge2FjdGlvbn0gYWN0aW9uIFRoZSBhY3Rpb24gbmFtZSBvZiB0aGUgbGlzdGVuZXJcclxuICAgICAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gcGFyYW1zIFRoZSBzcGVjaWZpY3MgcGFyYW1zIG5lY2Vzc2FyeSBmb3IgYW4gYWN0aW9uXHJcbiAgICAgICAgICAgICogQHJldHVybiB7Kn0gKiB0aGUgZGF0YSB0aGF0IG1heSBiZSBwcm92aWRlZCBieSB0aGUgbGlzdGVuZXIgZnVuY3Rpb25cclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgZGlzcGF0Y2g6IGZ1bmN0aW9uKiBkaXNwYXRjaChhY3Rpb24sIHBhcmFtcykge1xyXG4gICAgICAgICAgICAgICAgcGFyYW1zID0gcGFyYW1zIHx8IHt9O1xyXG4gICAgICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoUi5zY29wZShmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZighXy5oYXModGhpcy5fYWN0aW9uc0xpc3RlbmVycywgYWN0aW9uKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJSLkRpc3BhdGNoZXIuRGlzcGF0Y2hlckluc3RhbmNlLmRpc3BhdGNoOiBkaXNwYXRjaGluZyBhbiBhY3Rpb24gd2l0aCBubyBsaXN0ZW5lcnMgYXR0YWNoZWQuXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sIHRoaXMpKTtcclxuICAgICAgICAgICAgICAgIGlmKF8uaGFzKHRoaXMuX2FjdGlvbnNMaXN0ZW5lcnMsIGFjdGlvbikpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4geWllbGQgXy5tYXAodGhpcy5fYWN0aW9uc0xpc3RlbmVyc1thY3Rpb25dLCBmdW5jdGlvbihsaXN0ZW5lcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGlzdGVuZXIocGFyYW1zKTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICogPHA+UmVtb3ZlIGFsbCBsaXN0ZW5lciBwcmV2aW91c2x5IGFkZGVkIDwvcD5cclxuICAgICAgICAgICAgKiBAbWV0aG9kIGRlc3Ryb3lcclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgZGVzdHJveTogZnVuY3Rpb24gZGVzdHJveSgpIHtcclxuICAgICAgICAgICAgICAgIF8uZWFjaCh0aGlzLl9hY3Rpb25zTGlzdGVuZXJzLCB0aGlzLnJlbW92ZUFjdGlvbkxpc3RlbmVyKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9LFxyXG4gICAgfTtcclxuXHJcbiAgICBEaXNwYXRjaGVyLkFjdGlvbkxpc3RlbmVyID0gZnVuY3Rpb24gQWN0aW9uTGlzdGVuZXIoYWN0aW9uKSB7XHJcbiAgICAgICAgdGhpcy51bmlxdWVJZCA9IF8udW5pcXVlSWQoXCJBY3Rpb25MaXN0ZW5lclwiKTtcclxuICAgICAgICB0aGlzLmFjdGlvbiA9IGFjdGlvbjtcclxuICAgIH07XHJcblxyXG4gICAgXy5leHRlbmQoRGlzcGF0Y2hlci5BY3Rpb25MaXN0ZW5lci5wcm90b3R5cGUsIC8qKiBAbGVuZHMgUi5EaXNwYXRjaGVyLkFjdGlvbkxpc3RlbmVyICovIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBAcHJvcGVydHlcclxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxyXG4gICAgICAgICAqIEBwcml2YXRlXHJcbiAgICAgICAgICogQHJlYWRPbmx5XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdW5pcXVlSWQ6IG51bGwsXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQHByb3BlcnR5XHJcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cclxuICAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICAqIEByZWFkT25seVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFjdGlvbjogbnVsbCxcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiBEaXNwYXRjaGVyO1xyXG59O1xyXG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=