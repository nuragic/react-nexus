"use strict";

require("6to5/polyfill");
var Promise = require("bluebird");
module.exports = function (R) {
  var _ = require("lodash");
  var assert = require("assert");
  var React = R.React;

  assert(R.isClient(), "R.Client: should only be loaded in the client.");
  window.React = React;
  /**
  * <p>Simply provides an specified App for the client</p>
  * <p>Provides instance of App </p>
  * <ul>
  * <li> Client.mount => compute all React Components client-side and establishes a connection via socket in order to make data subscriptions </li>
  * </ul>
  * @class R.Client
  */
  var Client = function Client(App) {
    R.Debug.dev(function () {
      if (!window.React) {
        console.warn("Warning: React is not attached to window.");
      }
    });
    window.React = React;
    R.Debug.dev(R.scope(function () {
      if (!window.__ReactOnRails) {
        window.__ReactOnRails = {};
      }
      if (!window.__ReactOnRails.apps) {
        window.__ReactOnRails.apps = [];
      }
      window.__ReactOnRails.apps.push(this);
    }, this));
    this._app = new App();
  };

  _.extend(Client.prototype, /** @lends R.Client.prototype */{
    _app: null,
    _rendered: false,
    /**
    * <p> Call the renderIntoDocumentInClient from R.App function </p>
    * @method mount
    */
    mount: regeneratorRuntime.mark(function mount() {
      return regeneratorRuntime.wrap(function mount$(context$2$0) {
        while (1) switch (context$2$0.prev = context$2$0.next) {case 0:

            assert(!this._rendered, "R.Client.render(...): should only call mount() once.");
            context$2$0.next = 3;
            return this._app.renderIntoDocumentInClient(window);

          case 3:
          case "end": return context$2$0.stop();
        }
      }, mount, this);
    }) });

  return Client;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImQ6L3dvcmtzcGFjZV9yZWZhY3Rvci9yZWFjdC1yYWlscy9zcmMvUi5DbGllbnQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7QUFDekIsSUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ3BDLE1BQU0sQ0FBQyxPQUFPLEdBQUcsVUFBUyxDQUFDLEVBQUU7QUFDekIsTUFBSSxDQUFDLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQzFCLE1BQUksTUFBTSxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUMvQixNQUFJLEtBQUssR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDOztBQUVwQixRQUFNLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFFLGdEQUFnRCxDQUFDLENBQUM7QUFDdkUsUUFBTSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7Ozs7Ozs7OztBQVNyQixNQUFJLE1BQU0sR0FBRyxTQUFTLE1BQU0sQ0FBQyxHQUFHLEVBQUU7QUFDOUIsS0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsWUFBVztBQUNuQixVQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRTtBQUNkLGVBQU8sQ0FBQyxJQUFJLENBQUMsMkNBQTJDLENBQUMsQ0FBQztPQUM3RDtLQUNKLENBQUMsQ0FBQztBQUNILFVBQU0sQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO0FBQ3JCLEtBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsWUFBVztBQUMzQixVQUFHLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRTtBQUN2QixjQUFNLENBQUMsY0FBYyxHQUFHLEVBQUUsQ0FBQztPQUM5QjtBQUNELFVBQUcsQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRTtBQUM1QixjQUFNLENBQUMsY0FBYyxDQUFDLElBQUksR0FBRyxFQUFFLENBQUM7T0FDbkM7QUFDRCxZQUFNLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDekMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ1YsUUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO0dBQ3pCLENBQUM7O0FBRUYsR0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsU0FBUyxrQ0FBbUM7QUFDeEQsUUFBSSxFQUFFLElBQUk7QUFDVixhQUFTLEVBQUUsS0FBSzs7Ozs7QUFLaEIsU0FBSywwQkFBRSxTQUFVLEtBQUs7Ozs7QUFDbEIsa0JBQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsc0RBQXNELENBQUMsQ0FBQzs7bUJBQzFFLElBQUksQ0FBQyxJQUFJLENBQUMsMEJBQTBCLENBQUMsTUFBTSxDQUFDOzs7OztTQUZyQyxLQUFLO0tBR3JCLENBQUEsRUFDSixDQUFDLENBQUM7O0FBRUgsU0FBTyxNQUFNLENBQUM7Q0FDakIsQ0FBQyIsImZpbGUiOiJSLkNsaWVudC5qcyIsInNvdXJjZXNDb250ZW50IjpbInJlcXVpcmUoJzZ0bzUvcG9seWZpbGwnKTtcbmNvbnN0IFByb21pc2UgPSByZXF1aXJlKCdibHVlYmlyZCcpO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihSKSB7XHJcbiAgICB2YXIgXyA9IHJlcXVpcmUoXCJsb2Rhc2hcIik7XHJcbiAgICB2YXIgYXNzZXJ0ID0gcmVxdWlyZShcImFzc2VydFwiKTtcclxuICAgIHZhciBSZWFjdCA9IFIuUmVhY3Q7XHJcblxyXG4gICAgYXNzZXJ0KFIuaXNDbGllbnQoKSwgXCJSLkNsaWVudDogc2hvdWxkIG9ubHkgYmUgbG9hZGVkIGluIHRoZSBjbGllbnQuXCIpO1xyXG4gICAgd2luZG93LlJlYWN0ID0gUmVhY3Q7XHJcbiAgICAvKipcclxuICAgICogPHA+U2ltcGx5IHByb3ZpZGVzIGFuIHNwZWNpZmllZCBBcHAgZm9yIHRoZSBjbGllbnQ8L3A+XHJcbiAgICAqIDxwPlByb3ZpZGVzIGluc3RhbmNlIG9mIEFwcCA8L3A+XHJcbiAgICAqIDx1bD5cclxuICAgICogPGxpPiBDbGllbnQubW91bnQgPT4gY29tcHV0ZSBhbGwgUmVhY3QgQ29tcG9uZW50cyBjbGllbnQtc2lkZSBhbmQgZXN0YWJsaXNoZXMgYSBjb25uZWN0aW9uIHZpYSBzb2NrZXQgaW4gb3JkZXIgdG8gbWFrZSBkYXRhIHN1YnNjcmlwdGlvbnMgPC9saT5cclxuICAgICogPC91bD5cclxuICAgICogQGNsYXNzIFIuQ2xpZW50XHJcbiAgICAqL1xyXG4gICAgdmFyIENsaWVudCA9IGZ1bmN0aW9uIENsaWVudChBcHApIHtcclxuICAgICAgICBSLkRlYnVnLmRldihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgaWYoIXdpbmRvdy5SZWFjdCkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiV2FybmluZzogUmVhY3QgaXMgbm90IGF0dGFjaGVkIHRvIHdpbmRvdy5cIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICB3aW5kb3cuUmVhY3QgPSBSZWFjdDtcclxuICAgICAgICBSLkRlYnVnLmRldihSLnNjb3BlKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICBpZighd2luZG93Ll9fUmVhY3RPblJhaWxzKSB7XHJcbiAgICAgICAgICAgICAgICB3aW5kb3cuX19SZWFjdE9uUmFpbHMgPSB7fTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZighd2luZG93Ll9fUmVhY3RPblJhaWxzLmFwcHMpIHtcclxuICAgICAgICAgICAgICAgIHdpbmRvdy5fX1JlYWN0T25SYWlscy5hcHBzID0gW107XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgd2luZG93Ll9fUmVhY3RPblJhaWxzLmFwcHMucHVzaCh0aGlzKTtcclxuICAgICAgICB9LCB0aGlzKSk7XHJcbiAgICAgICAgdGhpcy5fYXBwID0gbmV3IEFwcCgpO1xyXG4gICAgfTtcclxuXHJcbiAgICBfLmV4dGVuZChDbGllbnQucHJvdG90eXBlLCAvKiogQGxlbmRzIFIuQ2xpZW50LnByb3RvdHlwZSAqLyB7XHJcbiAgICAgICAgX2FwcDogbnVsbCxcclxuICAgICAgICBfcmVuZGVyZWQ6IGZhbHNlLFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICogPHA+IENhbGwgdGhlIHJlbmRlckludG9Eb2N1bWVudEluQ2xpZW50IGZyb20gUi5BcHAgZnVuY3Rpb24gPC9wPlxyXG4gICAgICAgICogQG1ldGhvZCBtb3VudFxyXG4gICAgICAgICovXHJcbiAgICAgICAgbW91bnQ6IGZ1bmN0aW9uKiBtb3VudCgpIHtcclxuICAgICAgICAgICAgYXNzZXJ0KCF0aGlzLl9yZW5kZXJlZCwgXCJSLkNsaWVudC5yZW5kZXIoLi4uKTogc2hvdWxkIG9ubHkgY2FsbCBtb3VudCgpIG9uY2UuXCIpO1xyXG4gICAgICAgICAgICB5aWVsZCB0aGlzLl9hcHAucmVuZGVySW50b0RvY3VtZW50SW5DbGllbnQod2luZG93KTtcclxuICAgICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIENsaWVudDtcclxufTtcclxuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9