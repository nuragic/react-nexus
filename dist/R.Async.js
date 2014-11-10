"use strict";

require("6to5/polyfill");
var Promise = require("bluebird");
module.exports = function (R) {
  var _ = require("lodash");
  var assert = require("assert");
  var requestAnimationFrame = require("raf");
  require("setimmediate");

  var clearAnimationFrame = function clearAnimationFrame(handle) {
    requestAnimationFrame.cancel(handle);
  };

  /**
   * Utilities for dealing with asynchronous callbacks in components.
   * @memberOf R
   * @public
   * @class R.Async
   */
  var Async = {
    /**
     * React mixin allowing the usage of the R.Async decorators: IfMounted, Deferred, DeferredImmediate and DeferredAnimationFrame.
     * @type Mixin
     * @mixin
     * @public
     */
    Mixin: null,
    /**
     * Decorates a method so that upon invocation, it is only actually invoked if the component has not unmounted.
     * @method IfMounted
     * @param {Function}
     * @return {Function}
     * @public
     */
    IfMounted: function IfMounted(fn) {
      return function () {
        R.Debug.dev(R.scope(function () {
          assert(this._AsyncMixinHasAsyncMixin, "R.Async.IfMounted(...): requies R.Async.Mixin.");
        }, this));
        if (!this._AsyncMixinHasUnmounted) {
          return fn.apply(this, arguments);
        } else {
          return void 0;
        }
      };
    },
    /**
     * @method _DeferToNextImmediate
     * @param {Function}
     * @return {Function}
     * @private
     */
    _DeferToNextImmediate: function _DeferToNextImmediate(fn) {
      return function () {
        var args = arguments;
        var u = _.uniqueId("setImmediate");
        var q = setImmediate(R.scope(function () {
          delete this._AsyncMixinQueuedImmediates[u];
          return fn.apply(this, args);
        }, this));
        this._AsyncMixinQueuedImmediates[u] = q;
      };
    },
    /**
     * @method  _DeferToNextAnimationFrame
     * @param {Function}
     * @return {Function}
     * @private
     */
    _DeferToNextAnimationFrame: function _DeferToNextAnimationFrame(fn) {
      return function () {
        var args = arguments;
        var u = _.uniqueId("requestAnimationFrame");
        var q = requestAnimationFrame(R.scope(function () {
          delete this._AsyncMixinQueuedAnimationFrames[u];
          return fn.apply(this, args);
        }, this));
        this._AsyncMixinQueuedAnimationFrames[u] = q;
      };
    },
    /**
     * @method _DeferToTimeout
     * @param {Number}
     * @return {Function(Function): Function}
     * @private
     */
    _DeferToTimeout: function _DeferToTimeout(delay) {
      /**
       * @param {Function}
       * @return {Function}
       */
      return function (fn) {
        return function () {
          var args = arguments;
          var u = _.uniqueId("setTimeout");
          var q = setTimeout(R.scope(function () {
            delete this._AsyncMixinQueuedTimeouts[u];
            return fn.apply(this, args);
          }, this));
          this._AsyncMixinQueuedTimeouts[u] = q;
        };
      };
    },
    /**
     * Decorates a method so that upon invocation, it is actually invoked after a timeout and only the component has not unmounted.
     * If no timeout is provided, then it will defer to setImmediate.
     * @method Deferred
     * @param {Function}
     * @return {Function}
     * @public
     */
    Deferred: function Deferred(fn, delay) {
      fn = R.Async.IfMounted(fn);
      if (!delay) {
        return R.Async.DeferredImmediate(fn);
      } else {
        return R.Async._DeferToTimeout(fn, delay);
      }
    },
    /**
     * Decorates a method so that upon invocation, it is actually invoked after deferral and only the component has not unmounted.
     * @method DeferredImmediate
     * @param {Function}
     * @return {Function}
     * @public
     */
    DeferredImmediate: function Deferred(fn) {
      fn = R.Async.IfMounted(fn);
      return R.Async._DeferToNextImmediate(fn);
    },
    /**
     * Decorates a method so that upon invocation, it is actually invoked upon the next animation frame and only the component has not unmounted.
     * @method DeferredAnimationFrame
     * @param {Function}
     * @return {Function}
     * @public
     */
    DeferredAnimationFrame: function DeferredAnimationFrame(fn) {
      fn = R.Async.IfMounted(fn);
      return R.Async._DeferToNextAnimationFrame(fn);
    } };

  Async.Mixin = {
    _AsyncMixinHasUnmounted: false,
    _AsyncMixinHasAsyncMixin: true,
    _AsyncMixinQueuedTimeouts: null,
    _AsyncMixinQueuedImmediates: null,
    _AsyncMixinQueuedAnimationFrames: null,
    componentWillMount: function componentWillMount() {
      this._AsyncMixinQueuedTimeouts = {};
      this._AsyncMixinQueuedImmediates = {};
      this._AsyncMixinQueuedAnimationFrames = {};
    },
    componentWillUnmount: function componentWillUnmount() {
      _.each(this._AsyncMixinQueuedTimeouts, clearTimeout);
      _.each(this._AsyncMixinQueuedImmediates, clearImmediate);
      _.each(this._AsyncMixinQueuedAnimationFrames, clearAnimationFrame);
      this._AsyncMixinHasUnmounted = true;
    },
    setStateIfMounted: Async.IfMounted(function setStateIfMounted(state) {
      this.setState(state);
    }) };

  return Async;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImQ6L3dvcmtzcGFjZV9yZWZhY3Rvci9yZWFjdC1yYWlscy9zcmMvUi5Bc3luYy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUN6QixJQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDcEMsTUFBTSxDQUFDLE9BQU8sR0FBRyxVQUFTLENBQUMsRUFBRTtBQUN6QixNQUFJLENBQUMsR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDMUIsTUFBSSxNQUFNLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQy9CLE1BQUkscUJBQXFCLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzNDLFNBQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQzs7QUFFeEIsTUFBSSxtQkFBbUIsR0FBRyxTQUFTLG1CQUFtQixDQUFDLE1BQU0sRUFBRTtBQUMzRCx5QkFBcUIsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7R0FDeEMsQ0FBQzs7Ozs7Ozs7QUFRRixNQUFJLEtBQUssR0FBRzs7Ozs7OztBQU9SLFNBQUssRUFBRSxJQUFJOzs7Ozs7OztBQVFYLGFBQVMsRUFBRSxTQUFTLFNBQVMsQ0FBQyxFQUFFLEVBQUU7QUFDOUIsYUFBTyxZQUFXO0FBQ2QsU0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxZQUFXO0FBQzNCLGdCQUFNLENBQUMsSUFBSSxDQUFDLHdCQUF3QixFQUFFLGdEQUFnRCxDQUFDLENBQUM7U0FDM0YsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ1YsWUFBRyxDQUFDLElBQUksQ0FBQyx1QkFBdUIsRUFBRTtBQUM5QixpQkFBTyxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQztTQUNwQyxNQUNJO0FBQ0QsaUJBQU8sS0FBSyxDQUFDLENBQUM7U0FDakI7T0FDSixD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cmVxdWlyZSgnNnRvNS9wb2x5ZmlsbCcpO1xuY29uc3QgUHJvbWlzZSA9IHJlcXVpcmUoJ2JsdWViaXJkJyk7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKFIpIHtcclxuICAgIHZhciBfID0gcmVxdWlyZShcImxvZGFzaFwiKTtcclxuICAgIHZhciBhc3NlcnQgPSByZXF1aXJlKFwiYXNzZXJ0XCIpO1xyXG4gICAgdmFyIHJlcXVlc3RBbmltYXRpb25GcmFtZSA9IHJlcXVpcmUoXCJyYWZcIik7XHJcbiAgICByZXF1aXJlKFwic2V0aW1tZWRpYXRlXCIpO1xyXG5cclxuICAgIHZhciBjbGVhckFuaW1hdGlvbkZyYW1lID0gZnVuY3Rpb24gY2xlYXJBbmltYXRpb25GcmFtZShoYW5kbGUpIHtcclxuICAgICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUuY2FuY2VsKGhhbmRsZSk7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVXRpbGl0aWVzIGZvciBkZWFsaW5nIHdpdGggYXN5bmNocm9ub3VzIGNhbGxiYWNrcyBpbiBjb21wb25lbnRzLlxyXG4gICAgICogQG1lbWJlck9mIFJcclxuICAgICAqIEBwdWJsaWNcclxuICAgICAqIEBjbGFzcyBSLkFzeW5jXHJcbiAgICAgKi9cclxuICAgIHZhciBBc3luYyA9IHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBSZWFjdCBtaXhpbiBhbGxvd2luZyB0aGUgdXNhZ2Ugb2YgdGhlIFIuQXN5bmMgZGVjb3JhdG9yczogSWZNb3VudGVkLCBEZWZlcnJlZCwgRGVmZXJyZWRJbW1lZGlhdGUgYW5kIERlZmVycmVkQW5pbWF0aW9uRnJhbWUuXHJcbiAgICAgICAgICogQHR5cGUgTWl4aW5cclxuICAgICAgICAgKiBAbWl4aW5cclxuICAgICAgICAgKiBAcHVibGljXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgTWl4aW46IG51bGwsXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogRGVjb3JhdGVzIGEgbWV0aG9kIHNvIHRoYXQgdXBvbiBpbnZvY2F0aW9uLCBpdCBpcyBvbmx5IGFjdHVhbGx5IGludm9rZWQgaWYgdGhlIGNvbXBvbmVudCBoYXMgbm90IHVubW91bnRlZC5cclxuICAgICAgICAgKiBAbWV0aG9kIElmTW91bnRlZFxyXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259XHJcbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XHJcbiAgICAgICAgICogQHB1YmxpY1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIElmTW91bnRlZDogZnVuY3Rpb24gSWZNb3VudGVkKGZuKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIFIuRGVidWcuZGV2KFIuc2NvcGUoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KHRoaXMuX0FzeW5jTWl4aW5IYXNBc3luY01peGluLCBcIlIuQXN5bmMuSWZNb3VudGVkKC4uLik6IHJlcXVpZXMgUi5Bc3luYy5NaXhpbi5cIik7XHJcbiAgICAgICAgICAgICAgICB9LCB0aGlzKSk7XHJcbiAgICAgICAgICAgICAgICBpZighdGhpcy5fQXN5bmNNaXhpbkhhc1VubW91bnRlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZvaWQgMDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEBtZXRob2QgX0RlZmVyVG9OZXh0SW1tZWRpYXRlXHJcbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn1cclxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cclxuICAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIF9EZWZlclRvTmV4dEltbWVkaWF0ZTogZnVuY3Rpb24gX0RlZmVyVG9OZXh0SW1tZWRpYXRlKGZuKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIHZhciBhcmdzID0gYXJndW1lbnRzO1xyXG4gICAgICAgICAgICAgICAgdmFyIHUgPSBfLnVuaXF1ZUlkKFwic2V0SW1tZWRpYXRlXCIpO1xyXG4gICAgICAgICAgICAgICAgdmFyIHEgPSBzZXRJbW1lZGlhdGUoUi5zY29wZShmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fQXN5bmNNaXhpblF1ZXVlZEltbWVkaWF0ZXNbdV07XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3MpO1xyXG4gICAgICAgICAgICAgICAgfSwgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fQXN5bmNNaXhpblF1ZXVlZEltbWVkaWF0ZXNbdV0gPSBxO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQG1ldGhvZCAgX0RlZmVyVG9OZXh0QW5pbWF0aW9uRnJhbWVcclxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufVxyXG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxyXG4gICAgICAgICAqIEBwcml2YXRlXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgX0RlZmVyVG9OZXh0QW5pbWF0aW9uRnJhbWU6IGZ1bmN0aW9uIF9EZWZlclRvTmV4dEFuaW1hdGlvbkZyYW1lKGZuKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIHZhciBhcmdzID0gYXJndW1lbnRzO1xyXG4gICAgICAgICAgICAgICAgdmFyIHUgPSBfLnVuaXF1ZUlkKFwicmVxdWVzdEFuaW1hdGlvbkZyYW1lXCIpO1xyXG4gICAgICAgICAgICAgICAgdmFyIHEgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoUi5zY29wZShmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fQXN5bmNNaXhpblF1ZXVlZEFuaW1hdGlvbkZyYW1lc1t1XTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZm4uYXBwbHkodGhpcywgYXJncyk7XHJcbiAgICAgICAgICAgICAgICB9LCB0aGlzKSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9Bc3luY01peGluUXVldWVkQW5pbWF0aW9uRnJhbWVzW3VdID0gcTtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEBtZXRob2QgX0RlZmVyVG9UaW1lb3V0XHJcbiAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ9XHJcbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb24oRnVuY3Rpb24pOiBGdW5jdGlvbn1cclxuICAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIF9EZWZlclRvVGltZW91dDogZnVuY3Rpb24gX0RlZmVyVG9UaW1lb3V0KGRlbGF5KSB7XHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufVxyXG4gICAgICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cclxuICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihmbikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBhcmdzID0gYXJndW1lbnRzO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB1ID0gXy51bmlxdWVJZChcInNldFRpbWVvdXRcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHEgPSBzZXRUaW1lb3V0KFIuc2NvcGUoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9Bc3luY01peGluUXVldWVkVGltZW91dHNbdV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmbi5hcHBseSh0aGlzLCBhcmdzKTtcclxuICAgICAgICAgICAgICAgICAgICB9LCB0aGlzKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fQXN5bmNNaXhpblF1ZXVlZFRpbWVvdXRzW3VdID0gcTtcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBEZWNvcmF0ZXMgYSBtZXRob2Qgc28gdGhhdCB1cG9uIGludm9jYXRpb24sIGl0IGlzIGFjdHVhbGx5IGludm9rZWQgYWZ0ZXIgYSB0aW1lb3V0IGFuZCBvbmx5IHRoZSBjb21wb25lbnQgaGFzIG5vdCB1bm1vdW50ZWQuXHJcbiAgICAgICAgICogSWYgbm8gdGltZW91dCBpcyBwcm92aWRlZCwgdGhlbiBpdCB3aWxsIGRlZmVyIHRvIHNldEltbWVkaWF0ZS5cclxuICAgICAgICAgKiBAbWV0aG9kIERlZmVycmVkXHJcbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn1cclxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cclxuICAgICAgICAgKiBAcHVibGljXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgRGVmZXJyZWQ6IGZ1bmN0aW9uIERlZmVycmVkKGZuLCBkZWxheSkge1xyXG4gICAgICAgICAgICBmbiA9IFIuQXN5bmMuSWZNb3VudGVkKGZuKTtcclxuICAgICAgICAgICAgaWYoIWRlbGF5KSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gUi5Bc3luYy5EZWZlcnJlZEltbWVkaWF0ZShmbik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gUi5Bc3luYy5fRGVmZXJUb1RpbWVvdXQoZm4sIGRlbGF5KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogRGVjb3JhdGVzIGEgbWV0aG9kIHNvIHRoYXQgdXBvbiBpbnZvY2F0aW9uLCBpdCBpcyBhY3R1YWxseSBpbnZva2VkIGFmdGVyIGRlZmVycmFsIGFuZCBvbmx5IHRoZSBjb21wb25lbnQgaGFzIG5vdCB1bm1vdW50ZWQuXHJcbiAgICAgICAgICogQG1ldGhvZCBEZWZlcnJlZEltbWVkaWF0ZVxyXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259XHJcbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XHJcbiAgICAgICAgICogQHB1YmxpY1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIERlZmVycmVkSW1tZWRpYXRlOiBmdW5jdGlvbiBEZWZlcnJlZChmbikge1xyXG4gICAgICAgICAgICBmbiA9IFIuQXN5bmMuSWZNb3VudGVkKGZuKTtcclxuICAgICAgICAgICAgcmV0dXJuIFIuQXN5bmMuX0RlZmVyVG9OZXh0SW1tZWRpYXRlKGZuKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIERlY29yYXRlcyBhIG1ldGhvZCBzbyB0aGF0IHVwb24gaW52b2NhdGlvbiwgaXQgaXMgYWN0dWFsbHkgaW52b2tlZCB1cG9uIHRoZSBuZXh0IGFuaW1hdGlvbiBmcmFtZSBhbmQgb25seSB0aGUgY29tcG9uZW50IGhhcyBub3QgdW5tb3VudGVkLlxyXG4gICAgICAgICAqIEBtZXRob2QgRGVmZXJyZWRBbmltYXRpb25GcmFtZVxyXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259XHJcbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XHJcbiAgICAgICAgICogQHB1YmxpY1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIERlZmVycmVkQW5pbWF0aW9uRnJhbWU6IGZ1bmN0aW9uIERlZmVycmVkQW5pbWF0aW9uRnJhbWUoZm4pIHtcclxuICAgICAgICAgICAgZm4gPSBSLkFzeW5jLklmTW91bnRlZChmbik7XHJcbiAgICAgICAgICAgIHJldHVybiBSLkFzeW5jLl9EZWZlclRvTmV4dEFuaW1hdGlvbkZyYW1lKGZuKTtcclxuICAgICAgICB9LFxyXG4gICAgfTtcclxuXHJcbiAgICBBc3luYy5NaXhpbiA9IHtcclxuICAgICAgICBfQXN5bmNNaXhpbkhhc1VubW91bnRlZDogZmFsc2UsXHJcbiAgICAgICAgX0FzeW5jTWl4aW5IYXNBc3luY01peGluOiAgdHJ1ZSxcclxuICAgICAgICBfQXN5bmNNaXhpblF1ZXVlZFRpbWVvdXRzOiBudWxsLFxyXG4gICAgICAgIF9Bc3luY01peGluUXVldWVkSW1tZWRpYXRlczogbnVsbCxcclxuICAgICAgICBfQXN5bmNNaXhpblF1ZXVlZEFuaW1hdGlvbkZyYW1lczogbnVsbCxcclxuICAgICAgICBjb21wb25lbnRXaWxsTW91bnQ6IGZ1bmN0aW9uIGNvbXBvbmVudFdpbGxNb3VudCgpIHtcclxuICAgICAgICAgICAgdGhpcy5fQXN5bmNNaXhpblF1ZXVlZFRpbWVvdXRzID0ge307XHJcbiAgICAgICAgICAgIHRoaXMuX0FzeW5jTWl4aW5RdWV1ZWRJbW1lZGlhdGVzID0ge307XHJcbiAgICAgICAgICAgIHRoaXMuX0FzeW5jTWl4aW5RdWV1ZWRBbmltYXRpb25GcmFtZXMgPSB7fTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGNvbXBvbmVudFdpbGxVbm1vdW50OiBmdW5jdGlvbiBjb21wb25lbnRXaWxsVW5tb3VudCgpIHtcclxuICAgICAgICAgICAgXy5lYWNoKHRoaXMuX0FzeW5jTWl4aW5RdWV1ZWRUaW1lb3V0cywgY2xlYXJUaW1lb3V0KTtcclxuICAgICAgICAgICAgXy5lYWNoKHRoaXMuX0FzeW5jTWl4aW5RdWV1ZWRJbW1lZGlhdGVzLCBjbGVhckltbWVkaWF0ZSk7XHJcbiAgICAgICAgICAgIF8uZWFjaCh0aGlzLl9Bc3luY01peGluUXVldWVkQW5pbWF0aW9uRnJhbWVzLCBjbGVhckFuaW1hdGlvbkZyYW1lKTtcclxuICAgICAgICAgICAgdGhpcy5fQXN5bmNNaXhpbkhhc1VubW91bnRlZCA9IHRydWU7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBzZXRTdGF0ZUlmTW91bnRlZDogQXN5bmMuSWZNb3VudGVkKGZ1bmN0aW9uIHNldFN0YXRlSWZNb3VudGVkKHN0YXRlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0U3RhdGUoc3RhdGUpO1xyXG4gICAgICAgIH0pLFxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gQXN5bmM7XHJcbn07XHJcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==