'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; }

var _2 = require('../');

var _3 = _interopRequireDefault(_2);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

require('babel/polyfill');
var _ = require('lodash');
var should = require('should');
var Promise = (global || window).Promise = require('bluebird');
var __DEV__ = process.env.NODE_ENV !== 'production';
var __PROD__ = !__DEV__;
var __BROWSER__ = typeof window === 'object';
var __NODE__ = !__BROWSER__;
if (__DEV__) {
  Promise.longStackTraces();
  Error.stackTraceLimit = Infinity;
}
exports['default'] = _3['default'].Enhance((function (_React$Component) {
  var _class = function () {
    _classCallCheck(this, _class);

    if (_React$Component != null) {
      _React$Component.apply(this, arguments);
    }
  };

  _inherits(_class, _React$Component);

  _createClass(_class, [{
    key: 'getNexusBindings',
    value: function getNexusBindings(_ref) {
      var foo = _ref.foo;

      return {
        bar: ['local', foo] };
    }
  }, {
    key: 'render',
    value: function render() {
      var bar = this.props.bar;

      return _react2['default'].createElement(
        'span',
        null,
        bar ? bar.get('mood') : null
      );
    }
  }], [{
    key: 'displayName',
    value: 'Nested',
    enumerable: true
  }, {
    key: 'propTypes',
    value: {
      bar: _react2['default'].PropTypes.any },
    enumerable: true
  }]);

  return _class;
})(_react2['default'].Component));
module.exports = exports['default'];