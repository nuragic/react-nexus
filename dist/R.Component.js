"use strict";

require("6to5/polyfill");
var Promise = require("bluebird");
module.exports = function (R) {
  var _ = require("lodash");
  var assert = require("assert");
  var React = R.React;

  /**
  * <p>Defines a specific mixin</p>
  * <p>This will allow to components to access the main methods of react-rails</p>
  * <ul>
  * <li> Component.getFlux => Provide Flux for the current component </li>
  * </ul>
  * @class R.Component
  */
  var Component = {
    Mixin: {
      /**  
      * <p>Refers to specifics mixins in order to manage Pure, Async, Animate and Flux methods</p>
      * @property mixins
      * @type {array.object}
      */
      mixins: [R.Pure.Mixin, R.Async.Mixin, R.Animate.Mixin, R.Flux.Mixin],
      /** 
      * <p>Defines context object for the current component<br />
      * Allows all components using this mixin to have reference to R.Flux (Provides by the R.Root)</p>
      * @property contextTypes
      * @type {object} flux
      */
      contextTypes: {
        flux: R.Flux.PropType },

      _ComponentMixinHasComponentMixin: true,
      /** <p>Provide Flux for the current component</p>
      * @method getFlux
      * @return {object} this.context.flux The Flux of the App
      */
      getFlux: function getFlux() {
        return this.context.flux;
      } } };

  return Component;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImQ6L3dvcmtzcGFjZV9yZWZhY3Rvci9yZWFjdC1yYWlscy9zcmMvUi5Db21wb25lbnQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7QUFDekIsSUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ3BDLE1BQU0sQ0FBQyxPQUFPLEdBQUcsVUFBUyxDQUFDLEVBQUU7QUFDekIsTUFBSSxDQUFDLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQzFCLE1BQUksTUFBTSxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUMvQixNQUFJLEtBQUssR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDOzs7Ozs7Ozs7O0FBVXBCLE1BQUksU0FBUyxHQUFHO0FBQ1osU0FBSyxFQUFFOzs7Ozs7QUFNSCxZQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQzs7Ozs7OztBQU9wRSxrQkFBWSxFQUFFO0FBQ1YsWUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUN4Qjs7QUFFRCxzQ0FBZ0MsRUFBRSxJQUFJOzs7OztBQUt0QyxhQUFPLEVBQUUsU0FBUyxPQUFPLEdBQUc7QUFDeEIsZUFBTyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztPQUM1QixJQUVSLENBQUM7O0FBRUYsU0FBTyxTQUFTLENBQUM7Q0FDcEIsQ0FBQyIsImZpbGUiOiJSLkNvbXBvbmVudC5qcyIsInNvdXJjZXNDb250ZW50IjpbInJlcXVpcmUoJzZ0bzUvcG9seWZpbGwnKTtcbmNvbnN0IFByb21pc2UgPSByZXF1aXJlKCdibHVlYmlyZCcpO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihSKSB7XHJcbiAgICB2YXIgXyA9IHJlcXVpcmUoXCJsb2Rhc2hcIik7XHJcbiAgICB2YXIgYXNzZXJ0ID0gcmVxdWlyZShcImFzc2VydFwiKTtcclxuICAgIHZhciBSZWFjdCA9IFIuUmVhY3Q7XHJcblxyXG4gICAgLyoqXHJcbiAgICAqIDxwPkRlZmluZXMgYSBzcGVjaWZpYyBtaXhpbjwvcD5cclxuICAgICogPHA+VGhpcyB3aWxsIGFsbG93IHRvIGNvbXBvbmVudHMgdG8gYWNjZXNzIHRoZSBtYWluIG1ldGhvZHMgb2YgcmVhY3QtcmFpbHM8L3A+XHJcbiAgICAqIDx1bD5cclxuICAgICogPGxpPiBDb21wb25lbnQuZ2V0Rmx1eCA9PiBQcm92aWRlIEZsdXggZm9yIHRoZSBjdXJyZW50IGNvbXBvbmVudCA8L2xpPlxyXG4gICAgKiA8L3VsPlxyXG4gICAgKiBAY2xhc3MgUi5Db21wb25lbnRcclxuICAgICovXHJcbiAgICB2YXIgQ29tcG9uZW50ID0ge1xyXG4gICAgICAgIE1peGluOiB7XHJcbiAgICAgICAgICAgIC8qKiAgXHJcbiAgICAgICAgICAgICogPHA+UmVmZXJzIHRvIHNwZWNpZmljcyBtaXhpbnMgaW4gb3JkZXIgdG8gbWFuYWdlIFB1cmUsIEFzeW5jLCBBbmltYXRlIGFuZCBGbHV4IG1ldGhvZHM8L3A+XHJcbiAgICAgICAgICAgICogQHByb3BlcnR5IG1peGluc1xyXG4gICAgICAgICAgICAqIEB0eXBlIHthcnJheS5vYmplY3R9XHJcbiAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIG1peGluczogW1IuUHVyZS5NaXhpbiwgUi5Bc3luYy5NaXhpbiwgUi5BbmltYXRlLk1peGluLCBSLkZsdXguTWl4aW5dLFxyXG4gICAgICAgICAgICAvKiogXHJcbiAgICAgICAgICAgICogPHA+RGVmaW5lcyBjb250ZXh0IG9iamVjdCBmb3IgdGhlIGN1cnJlbnQgY29tcG9uZW50PGJyIC8+XHJcbiAgICAgICAgICAgICogQWxsb3dzIGFsbCBjb21wb25lbnRzIHVzaW5nIHRoaXMgbWl4aW4gdG8gaGF2ZSByZWZlcmVuY2UgdG8gUi5GbHV4IChQcm92aWRlcyBieSB0aGUgUi5Sb290KTwvcD5cclxuICAgICAgICAgICAgKiBAcHJvcGVydHkgY29udGV4dFR5cGVzXHJcbiAgICAgICAgICAgICogQHR5cGUge29iamVjdH0gZmx1eFxyXG4gICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBjb250ZXh0VHlwZXM6IHtcclxuICAgICAgICAgICAgICAgIGZsdXg6IFIuRmx1eC5Qcm9wVHlwZSxcclxuICAgICAgICAgICAgfSxcclxuXHJcbiAgICAgICAgICAgIF9Db21wb25lbnRNaXhpbkhhc0NvbXBvbmVudE1peGluOiB0cnVlLFxyXG4gICAgICAgICAgICAvKiogPHA+UHJvdmlkZSBGbHV4IGZvciB0aGUgY3VycmVudCBjb21wb25lbnQ8L3A+XHJcbiAgICAgICAgICAgICogQG1ldGhvZCBnZXRGbHV4XHJcbiAgICAgICAgICAgICogQHJldHVybiB7b2JqZWN0fSB0aGlzLmNvbnRleHQuZmx1eCBUaGUgRmx1eCBvZiB0aGUgQXBwXHJcbiAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIGdldEZsdXg6IGZ1bmN0aW9uIGdldEZsdXgoKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5jb250ZXh0LmZsdXg7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgfSxcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIENvbXBvbmVudDtcclxufTtcclxuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9