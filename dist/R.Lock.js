"use strict";

require("6to5/polyfill");
var Promise = require("bluebird");
module.exports = function (R) {
  var _ = require("lodash");
  var assert = require("assert");

  var Lock = function Lock() {
    this._acquired = false;
    this._queue = [];
  };

  _.extend(Lock.prototype, {
    _acquired: null,
    _queue: null,
    acquire: function acquire() {
      return R.scope(function (fn) {
        if (!this._acquired) {
          this._acquired = true;
          _.defer(fn);
        } else {
          this._queue.push(fn);
        }
      }, this);
    },
    release: function release() {
      assert(this._acquired, "R.Lock.release(): lock not currently acquired.");
      if (_.size(this._queue) > 0) {
        var fn = this._queue[0];
        this._queue.shift();
        _.defer(fn);
      } else {
        this._acquired = false;
      }
    },
    performSync: regeneratorRuntime.mark(function performSync(fn) {
      var res;
      return regeneratorRuntime.wrap(function performSync$(context$2$0) {
        while (1) switch (context$2$0.prev = context$2$0.next) {case 0:
            context$2$0.next = 2;
            return this.acquire();

          case 2:
            res = fn();

            this.release();
            return context$2$0.abrupt("return", res);

          case 5:
          case "end": return context$2$0.stop();
        }
      }, performSync, this);
    }),
    perform: regeneratorRuntime.mark(function perform(fn) {
      var res;
      return regeneratorRuntime.wrap(function perform$(context$2$0) {
        while (1) switch (context$2$0.prev = context$2$0.next) {case 0:
            context$2$0.next = 2;
            return this.acquire();

          case 2:
            context$2$0.next = 4;
            return fn();

          case 4:
            res = context$2$0.sent;

            this.release();
            return context$2$0.abrupt("return", res);

          case 7:
          case "end": return context$2$0.stop();
        }
      }, perform, this);
    }) });

  return Lock;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImQ6L3dvcmtzcGFjZV9yZWZhY3Rvci9yZWFjdC1yYWlscy9zcmMvUi5Mb2NrLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3pCLElBQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNwQyxNQUFNLENBQUMsT0FBTyxHQUFHLFVBQVMsQ0FBQyxFQUFFO0FBQ3pCLE1BQUksQ0FBQyxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUMxQixNQUFJLE1BQU0sR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7O0FBRS9CLE1BQUksSUFBSSxHQUFHLFNBQVMsSUFBSSxHQUFHO0FBQ3ZCLFFBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO0FBQ3ZCLFFBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFDO0dBQ3BCLENBQUM7O0FBRUYsR0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFO0FBQ3JCLGFBQVMsRUFBRSxJQUFJO0FBQ2YsVUFBTSxFQUFFLElBQUk7QUFDWixXQUFPLEVBQUUsU0FBUyxPQUFPLEdBQUc7QUFDeEIsYUFBTyxDQUFDLENBQUMsS0FBSyxDQUFDLFVBQVMsRUFBRSxFQUFFO0FBQ3hCLFlBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFO0FBQ2hCLGNBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO0FBQ3RCLFdBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7U0FDZixNQUNJO0FBQ0QsY0FBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7U0FDeEI7T0FDSixFQUFFLElBQUksQ0FBQyxDQUFDO0tBQ1o7QUFDRCxXQUFPLEVBQUUsU0FBUyxPQUFPLEdBQUc7QUFDeEIsWUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsZ0RBQWdELENBQUMsQ0FBQztBQUN6RSxVQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUN4QixZQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3hCLFlBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7QUFDcEIsU0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztPQUNmLE1BQ0k7QUFDRCxZQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQztPQUMxQjtLQUNKO0FBQ0QsZUFBVywwQkFBRSxTQUFVLFdBQVcsQ0FBQyxFQUFFO1VBRTdCLEdBQUc7Ozs7bUJBREQsSUFBSSxDQUFDLE9BQU8sRUFBRTs7O0FBQ2hCLGVBQUcsR0FBRyxFQUFFLEVBQUU7O0FBQ2QsZ0JBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztnREFDUixHQUFHOzs7OztTQUpTLFdBQVc7S0FLakMsQ0FBQTtBQUNELFdBQU8sMEJBQUUsU0FBVSxPQUFPLENBQUMsRUFBRTtVQUVyQixHQUFHOzs7O21CQURELElBQUksQ0FBQyxPQUFPLEVBQUU7Ozs7bUJBQ0osRUFBRSxFQUFFOzs7QUFBaEIsZUFBRzs7QUFDUCxnQkFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dEQUNSLEdBQUc7Ozs7O1NBSkssT0FBTztLQUt6QixDQUFBLEVBQ0osQ0FBQyxDQUFDOztBQUVILFNBQU8sSUFBSSxDQUFDO0NBQ2YsQ0FBQyIsImZpbGUiOiJSLkxvY2suanMiLCJzb3VyY2VzQ29udGVudCI6WyJyZXF1aXJlKCc2dG81L3BvbHlmaWxsJyk7XG5jb25zdCBQcm9taXNlID0gcmVxdWlyZSgnYmx1ZWJpcmQnKTtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oUikge1xyXG4gICAgdmFyIF8gPSByZXF1aXJlKFwibG9kYXNoXCIpO1xyXG4gICAgdmFyIGFzc2VydCA9IHJlcXVpcmUoXCJhc3NlcnRcIik7XHJcblxyXG4gICAgdmFyIExvY2sgPSBmdW5jdGlvbiBMb2NrKCkge1xyXG4gICAgICAgIHRoaXMuX2FjcXVpcmVkID0gZmFsc2U7XHJcbiAgICAgICAgdGhpcy5fcXVldWUgPSBbXTtcclxuICAgIH07XHJcblxyXG4gICAgXy5leHRlbmQoTG9jay5wcm90b3R5cGUsIHtcclxuICAgICAgICBfYWNxdWlyZWQ6IG51bGwsXHJcbiAgICAgICAgX3F1ZXVlOiBudWxsLFxyXG4gICAgICAgIGFjcXVpcmU6IGZ1bmN0aW9uIGFjcXVpcmUoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBSLnNjb3BlKGZ1bmN0aW9uKGZuKSB7XHJcbiAgICAgICAgICAgICAgICBpZighdGhpcy5fYWNxdWlyZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hY3F1aXJlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgXy5kZWZlcihmbik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9xdWV1ZS5wdXNoKGZuKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSwgdGhpcyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICByZWxlYXNlOiBmdW5jdGlvbiByZWxlYXNlKCkge1xyXG4gICAgICAgICAgICBhc3NlcnQodGhpcy5fYWNxdWlyZWQsIFwiUi5Mb2NrLnJlbGVhc2UoKTogbG9jayBub3QgY3VycmVudGx5IGFjcXVpcmVkLlwiKTtcclxuICAgICAgICAgICAgaWYoXy5zaXplKHRoaXMuX3F1ZXVlKSA+IDApIHtcclxuICAgICAgICAgICAgICAgIHZhciBmbiA9IHRoaXMuX3F1ZXVlWzBdO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fcXVldWUuc2hpZnQoKTtcclxuICAgICAgICAgICAgICAgIF8uZGVmZXIoZm4pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fYWNxdWlyZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcGVyZm9ybVN5bmM6IGZ1bmN0aW9uKiBwZXJmb3JtU3luYyhmbikge1xyXG4gICAgICAgICAgICB5aWVsZCB0aGlzLmFjcXVpcmUoKTtcclxuICAgICAgICAgICAgdmFyIHJlcyA9IGZuKCk7XHJcbiAgICAgICAgICAgIHRoaXMucmVsZWFzZSgpO1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcGVyZm9ybTogZnVuY3Rpb24qIHBlcmZvcm0oZm4pIHtcclxuICAgICAgICAgICAgeWllbGQgdGhpcy5hY3F1aXJlKCk7XHJcbiAgICAgICAgICAgIHZhciByZXMgPSB5aWVsZCBmbigpO1xyXG4gICAgICAgICAgICB0aGlzLnJlbGVhc2UoKTtcclxuICAgICAgICAgICAgcmV0dXJuIHJlcztcclxuICAgICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIExvY2s7XHJcbn07XHJcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==