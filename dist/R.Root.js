"use strict";

require("6to5/polyfill");
var Promise = require("bluebird");
module.exports = function (R) {
  var _ = require("lodash");
  var assert = require("assert");
  var React = R.React;

  /**
  * <p>Defines the specific mixin for the root component<br />
  * This will allow components to access the main methods of react-rails</p>
  * <ul>
  * <li> Component.getFlux => Provide Flux for the current component </li>
  * </ul>
  * @class R.Root
  */
  var Root = {
    Mixin: {
      /**  
      * <p>Refers to specifics mixins in order to manage Pure, Async, Animate and Flux methods</p>
      * @property mixins
      * @type {array.object}
      */
      mixins: [R.Pure.Mixin, R.Async.Mixin, R.Animate.Mixin, R.Flux.Mixin],
      _AppMixinHasAppMixin: true,

      /** <p>Checking types</p>
      * @property propTypes
      * @type {object} flux
      */
      propTypes: {
        flux: R.Flux.PropType },

      /** <p> Must be defined in order to use getChildContext </p>
      * @property childContextTypes
      * @type {object} flux 
      */
      childContextTypes: {
        flux: R.Flux.PropType },

      /** <p>Provides all children access to the Flux of the App </p>
      * @method getChildContext
      * @return {object} flux The flux of current component
      */
      getChildContext: function getChildContext() {
        return {
          flux: this.props.flux };
      },

      /** <p>Provide Flux for the current component</p>
      * @method getFlux
      * @return {object} this.context.flux The Flux of the App
      */
      getFlux: function getFlux() {
        return this.props.flux;
      } } };

  return Root;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImQ6L3dvcmtzcGFjZV9yZWZhY3Rvci9yZWFjdC1yYWlscy9zcmMvUi5Sb290LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3pCLElBQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNwQyxNQUFNLENBQUMsT0FBTyxHQUFHLFVBQVMsQ0FBQyxFQUFFO0FBQ3pCLE1BQUksQ0FBQyxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUMxQixNQUFJLE1BQU0sR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDL0IsTUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQzs7Ozs7Ozs7OztBQVVwQixNQUFJLElBQUksR0FBRztBQUNQLFNBQUssRUFBRTs7Ozs7O0FBTUgsWUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7QUFDcEUsMEJBQW9CLEVBQUUsSUFBSTs7Ozs7O0FBTTFCLGVBQVMsRUFBRTtBQUNQLFlBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFDeEI7Ozs7OztBQU1ELHVCQUFpQixFQUFFO0FBQ2YsWUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUN4Qjs7Ozs7O0FBTUQscUJBQWUsRUFBRSxTQUFTLGVBQWUsR0FBRztBQUN4QyxlQUFPO0FBQ0gsY0FBSSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUN4QixDQUFDO09BQ0w7Ozs7OztBQU1ELGFBQU8sRUFBRSxTQUFTLE9BQU8sR0FBRztBQUN4QixlQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO09BQzFCLEVBQ0osRUFDSixDQUFDOztBQUVGLFNBQU8sSUFBSSxDQUFDO0NBQ2YsQ0FBQyIsImZpbGUiOiJSLlJvb3QuanMiLCJzb3VyY2VzQ29udGVudCI6WyJyZXF1aXJlKCc2dG81L3BvbHlmaWxsJyk7XG5jb25zdCBQcm9taXNlID0gcmVxdWlyZSgnYmx1ZWJpcmQnKTtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oUikge1xyXG4gICAgdmFyIF8gPSByZXF1aXJlKFwibG9kYXNoXCIpO1xyXG4gICAgdmFyIGFzc2VydCA9IHJlcXVpcmUoXCJhc3NlcnRcIik7XHJcbiAgICB2YXIgUmVhY3QgPSBSLlJlYWN0O1xyXG5cclxuICAgIC8qKlxyXG4gICAgKiA8cD5EZWZpbmVzIHRoZSBzcGVjaWZpYyBtaXhpbiBmb3IgdGhlIHJvb3QgY29tcG9uZW50PGJyIC8+XHJcbiAgICAqIFRoaXMgd2lsbCBhbGxvdyBjb21wb25lbnRzIHRvIGFjY2VzcyB0aGUgbWFpbiBtZXRob2RzIG9mIHJlYWN0LXJhaWxzPC9wPlxyXG4gICAgKiA8dWw+XHJcbiAgICAqIDxsaT4gQ29tcG9uZW50LmdldEZsdXggPT4gUHJvdmlkZSBGbHV4IGZvciB0aGUgY3VycmVudCBjb21wb25lbnQgPC9saT5cclxuICAgICogPC91bD5cclxuICAgICogQGNsYXNzIFIuUm9vdFxyXG4gICAgKi9cclxuICAgIHZhciBSb290ID0ge1xyXG4gICAgICAgIE1peGluOiB7XHJcbiAgICAgICAgICAgIC8qKiAgXHJcbiAgICAgICAgICAgICogPHA+UmVmZXJzIHRvIHNwZWNpZmljcyBtaXhpbnMgaW4gb3JkZXIgdG8gbWFuYWdlIFB1cmUsIEFzeW5jLCBBbmltYXRlIGFuZCBGbHV4IG1ldGhvZHM8L3A+XHJcbiAgICAgICAgICAgICogQHByb3BlcnR5IG1peGluc1xyXG4gICAgICAgICAgICAqIEB0eXBlIHthcnJheS5vYmplY3R9XHJcbiAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIG1peGluczogW1IuUHVyZS5NaXhpbiwgUi5Bc3luYy5NaXhpbiwgUi5BbmltYXRlLk1peGluLCBSLkZsdXguTWl4aW5dLFxyXG4gICAgICAgICAgICBfQXBwTWl4aW5IYXNBcHBNaXhpbjogdHJ1ZSxcclxuXHJcbiAgICAgICAgICAgIC8qKiA8cD5DaGVja2luZyB0eXBlczwvcD5cclxuICAgICAgICAgICAgKiBAcHJvcGVydHkgcHJvcFR5cGVzXHJcbiAgICAgICAgICAgICogQHR5cGUge29iamVjdH0gZmx1eFxyXG4gICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBwcm9wVHlwZXM6IHtcclxuICAgICAgICAgICAgICAgIGZsdXg6IFIuRmx1eC5Qcm9wVHlwZSxcclxuICAgICAgICAgICAgfSxcclxuXHJcbiAgICAgICAgICAgIC8qKiA8cD4gTXVzdCBiZSBkZWZpbmVkIGluIG9yZGVyIHRvIHVzZSBnZXRDaGlsZENvbnRleHQgPC9wPlxyXG4gICAgICAgICAgICAqIEBwcm9wZXJ0eSBjaGlsZENvbnRleHRUeXBlc1xyXG4gICAgICAgICAgICAqIEB0eXBlIHtvYmplY3R9IGZsdXggXHJcbiAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIGNoaWxkQ29udGV4dFR5cGVzOiB7XHJcbiAgICAgICAgICAgICAgICBmbHV4OiBSLkZsdXguUHJvcFR5cGUsXHJcbiAgICAgICAgICAgIH0sXHJcblxyXG4gICAgICAgICAgICAvKiogPHA+UHJvdmlkZXMgYWxsIGNoaWxkcmVuIGFjY2VzcyB0byB0aGUgRmx1eCBvZiB0aGUgQXBwIDwvcD5cclxuICAgICAgICAgICAgKiBAbWV0aG9kIGdldENoaWxkQ29udGV4dFxyXG4gICAgICAgICAgICAqIEByZXR1cm4ge29iamVjdH0gZmx1eCBUaGUgZmx1eCBvZiBjdXJyZW50IGNvbXBvbmVudFxyXG4gICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBnZXRDaGlsZENvbnRleHQ6IGZ1bmN0aW9uIGdldENoaWxkQ29udGV4dCgpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgZmx1eDogdGhpcy5wcm9wcy5mbHV4LFxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgfSxcclxuXHJcbiAgICAgICAgICAgIC8qKiA8cD5Qcm92aWRlIEZsdXggZm9yIHRoZSBjdXJyZW50IGNvbXBvbmVudDwvcD5cclxuICAgICAgICAgICAgKiBAbWV0aG9kIGdldEZsdXhcclxuICAgICAgICAgICAgKiBAcmV0dXJuIHtvYmplY3R9IHRoaXMuY29udGV4dC5mbHV4IFRoZSBGbHV4IG9mIHRoZSBBcHBcclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgZ2V0Rmx1eDogZnVuY3Rpb24gZ2V0Rmx1eCgpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnByb3BzLmZsdXg7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgfSxcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIFJvb3Q7XHJcbn07XHJcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==