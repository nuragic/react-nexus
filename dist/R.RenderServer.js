"use strict";

require("6to5/polyfill");
var Promise = require("bluebird");
module.exports = function (R) {
  var co = require("co");
  var _ = require("lodash");
  var assert = require("assert");
  var url = require("url");

  /**
  * <p>Simply provides an specified App for the RenderServer</p>
  * <p>Provides instance of App </p>
  * <ul>
  * <li> RenderServer.middleware => compute all React Components with data and render the corresponding HTML for the requesting client </li>
  * </ul>
  * @class R.RenderServer
  */
  var RenderServer = function RenderServer(App) {
    R.Debug.dev(function () {
      assert(R.isServer(), "R.RenderServer(...): should only be called in the server.");
    });
    this._app = new App();
    this.middleware = R.scope(this.middleware, this);
  };

  _.extend(RenderServer.prototype, /** @lends R.RenderServer.Prototype */{
    _app: null,
    /**
    * <p> Call the renderToStringInServer from R.App function </p>
    * @method middleware
    */
    middleware: function middleware(req, res) {
      co(regeneratorRuntime.mark(function callee$2$0() {
        return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
          while (1) switch (context$3$0.prev = context$3$0.next) {case 0:
              context$3$0.next = 2;
              return this._app.renderToStringInServer(req);

            case 2: return context$3$0.abrupt("return", context$3$0.sent);
            case 3:
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
          res.status(200).send(val);
        }
      });
    } });

  return RenderServer;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImQ6L3dvcmtzcGFjZV9yZWZhY3Rvci9yZWFjdC1yYWlscy9zcmMvUi5SZW5kZXJTZXJ2ZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7QUFDekIsSUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ3BDLE1BQU0sQ0FBQyxPQUFPLEdBQUcsVUFBUyxDQUFDLEVBQUU7QUFDekIsTUFBSSxFQUFFLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3ZCLE1BQUksQ0FBQyxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUMxQixNQUFJLE1BQU0sR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDL0IsTUFBSSxHQUFHLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDOzs7Ozs7Ozs7O0FBVXpCLE1BQUksWUFBWSxHQUFHLFNBQVMsWUFBWSxDQUFDLEdBQUcsRUFBRTtBQUMxQyxLQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxZQUFXO0FBQ25CLFlBQU0sQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUUsMkRBQTJELENBQUMsQ0FBQztLQUNyRixDQUFDLENBQUM7QUFDSCxRQUFJLENBQUMsSUFBSSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7QUFDdEIsUUFBSSxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUM7R0FDcEQsQ0FBQzs7QUFFRixHQUFDLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxTQUFTLHdDQUF5QztBQUNwRSxRQUFJLEVBQUUsSUFBSTs7Ozs7QUFLVixjQUFVLEVBQUUsU0FBUyxVQUFVLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRTtBQUN0QyxRQUFFLHlCQUFDOzs7O3FCQUNjLElBQUksQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsR0FBRyxDQUFDOzs7Ozs7O09BQ3JELEVBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFVBQVMsR0FBRyxFQUFFLEdBQUcsRUFBRTtBQUM3QixZQUFHLEdBQUcsRUFBRTtBQUNKLGNBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRTtBQUNoQixtQkFBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsUUFBUSxFQUFFLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO1dBQzFFLE1BQ0k7QUFDRCxtQkFBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1dBQ3hEO1NBQ0osTUFDSTtBQUNELGFBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQzdCO09BQ0osQ0FBQyxDQUFDO0tBQ04sRUFDSixDQUFDLENBQUM7O0FBRUgsU0FBTyxZQUFZLENBQUM7Q0FDdkIsQ0FBQyIsImZpbGUiOiJSLlJlbmRlclNlcnZlci5qcyIsInNvdXJjZXNDb250ZW50IjpbInJlcXVpcmUoJzZ0bzUvcG9seWZpbGwnKTtcbmNvbnN0IFByb21pc2UgPSByZXF1aXJlKCdibHVlYmlyZCcpO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihSKSB7XHJcbiAgICB2YXIgY28gPSByZXF1aXJlKFwiY29cIik7XHJcbiAgICB2YXIgXyA9IHJlcXVpcmUoXCJsb2Rhc2hcIik7XHJcbiAgICB2YXIgYXNzZXJ0ID0gcmVxdWlyZShcImFzc2VydFwiKTtcclxuICAgIHZhciB1cmwgPSByZXF1aXJlKFwidXJsXCIpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgKiA8cD5TaW1wbHkgcHJvdmlkZXMgYW4gc3BlY2lmaWVkIEFwcCBmb3IgdGhlIFJlbmRlclNlcnZlcjwvcD5cclxuICAgICogPHA+UHJvdmlkZXMgaW5zdGFuY2Ugb2YgQXBwIDwvcD5cclxuICAgICogPHVsPlxyXG4gICAgKiA8bGk+IFJlbmRlclNlcnZlci5taWRkbGV3YXJlID0+IGNvbXB1dGUgYWxsIFJlYWN0IENvbXBvbmVudHMgd2l0aCBkYXRhIGFuZCByZW5kZXIgdGhlIGNvcnJlc3BvbmRpbmcgSFRNTCBmb3IgdGhlIHJlcXVlc3RpbmcgY2xpZW50IDwvbGk+XHJcbiAgICAqIDwvdWw+XHJcbiAgICAqIEBjbGFzcyBSLlJlbmRlclNlcnZlclxyXG4gICAgKi9cclxuICAgIHZhciBSZW5kZXJTZXJ2ZXIgPSBmdW5jdGlvbiBSZW5kZXJTZXJ2ZXIoQXBwKSB7XHJcbiAgICAgICAgUi5EZWJ1Zy5kZXYoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIGFzc2VydChSLmlzU2VydmVyKCksIFwiUi5SZW5kZXJTZXJ2ZXIoLi4uKTogc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGluIHRoZSBzZXJ2ZXIuXCIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMuX2FwcCA9IG5ldyBBcHAoKTtcclxuICAgICAgICB0aGlzLm1pZGRsZXdhcmUgPSBSLnNjb3BlKHRoaXMubWlkZGxld2FyZSwgdGhpcyk7XHJcbiAgICB9O1xyXG5cclxuICAgIF8uZXh0ZW5kKFJlbmRlclNlcnZlci5wcm90b3R5cGUsIC8qKiBAbGVuZHMgUi5SZW5kZXJTZXJ2ZXIuUHJvdG90eXBlICovIHtcclxuICAgICAgICBfYXBwOiBudWxsLFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICogPHA+IENhbGwgdGhlIHJlbmRlclRvU3RyaW5nSW5TZXJ2ZXIgZnJvbSBSLkFwcCBmdW5jdGlvbiA8L3A+XHJcbiAgICAgICAgKiBAbWV0aG9kIG1pZGRsZXdhcmVcclxuICAgICAgICAqL1xyXG4gICAgICAgIG1pZGRsZXdhcmU6IGZ1bmN0aW9uIG1pZGRsZXdhcmUocmVxLCByZXMpIHtcclxuICAgICAgICAgICAgY28oZnVuY3Rpb24qKCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHlpZWxkIHRoaXMuX2FwcC5yZW5kZXJUb1N0cmluZ0luU2VydmVyKHJlcSk7XHJcbiAgICAgICAgICAgIH0pLmNhbGwodGhpcywgZnVuY3Rpb24oZXJyLCB2YWwpIHtcclxuICAgICAgICAgICAgICAgIGlmKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKFIuRGVidWcuaXNEZXYoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnI6IGVyci50b1N0cmluZygpLCBzdGFjazogZXJyLnN0YWNrIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyOiBlcnIudG9TdHJpbmcoKSB9KTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICByZXMuc3RhdHVzKDIwMCkuc2VuZCh2YWwpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIFJlbmRlclNlcnZlcjtcclxufTtcclxuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9