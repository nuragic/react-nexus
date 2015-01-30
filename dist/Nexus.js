"use strict";

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

require("6to5/polyfill");
var _ = require("lodash");
var should = require("should");
var Promise = (global || window).Promise = require("bluebird");
var __DEV__ = process.env.NODE_ENV !== "production";
var __PROD__ = !__DEV__;
var __BROWSER__ = typeof window === "object";
var __NODE__ = !__BROWSER__;
if (__DEV__) {
  Promise.longStackTraces();
  Error.stackTraceLimit = Infinity;
}
var React = _interopRequire(require("react/addons"));

var instanciateReactComponent = _interopRequire(require("react/lib/instantiateReactComponent"));

var Mixin = _interopRequire(require("./Mixin"));

var Flux = _interopRequire(require("nexus-flux"));

var isCompositeComponentElement = React.addons.TestUtils.isCompositeComponentElement;


// flatten the descendants of a given element into an array
// use an accumulator to avoid lengthy lists construction and merging.
function flattenDescendants(element) {
  var acc = arguments[1] === undefined ? [] : arguments[1];
  if (__DEV__) {
    acc.should.be.an.Array;
  }
  if (!React.isValidElement(element)) {
    // only pass through valid elements
    return acc;
  }
  acc.push(element);
  if (element.props && element.props.children) {
    React.Children.forEach(element.props.children, function (child) {
      return flattenDescendants(child, acc);
    });
  }
  return acc;
}

// A nexus object is just a collection of Flux.Client objects.

var Nexus = {
  React: React, // reference to the React object

  Mixin: null, // reference to the Nexus React mixin

  // A global reference to the current nexus context, mapping keys to Flux client objects
  // It is set temporarly in the server during the prefetching/prerendering phase,
  // and set durably in the browser during the mounting phase.
  currentNexus: null,

  shouldPrefetch: function shouldPrefetch(element) {
    return React.isValidElement(element) && _.isFunction(element.type) && isCompositeComponentElement(element);
  },

  // In the server, prefetch, then renderToString, then return the generated HTML string and the raw prefetched data,
  // which can then be injected into the server response (eg. using a global variable).
  // It will be used by the browser to call mountApp.

  prerenderApp: Promise.coroutine(regeneratorRuntime.mark(function callee$0$0(rootElement, nexus) {
    var data, html;
    return regeneratorRuntime.wrap(function callee$0$0$(context$1$0) {
      while (1) switch (context$1$0.prev = context$1$0.next) {
        case 0:
          if (__DEV__) {
            React.isValidElement(rootElement).should.be["true"];
            nexus.should.be.an.Object;
            __NODE__.should.be["true"];
            _.each(nexus, function (flux) {
              return flux.should.be.an.instanceOf(Flux.Client);
            });
          }
          context$1$0.next = 3;
          return Nexus._prefetchApp(rootElement, nexus);
        case 3:
          data = context$1$0.sent;
          _.each(nexus, function (flux, key) {
            return flux.startInjecting(data[key]);
          });
          html = Nexus._withNexus(nexus, function () {
            return React.renderToString(rootElement);
          });
          _.each(nexus, function (flux) {
            return flux.stopInjecting();
          });
          return context$1$0.abrupt("return", [html, data]);
        case 8:
        case "end":
          return context$1$0.stop();
      }
    }, callee$0$0, this);
  })),

  prerenderAppToStaticMarkup: Promise.coroutine(regeneratorRuntime.mark(function callee$0$1(rootElement, nexus) {
    var data, html;
    return regeneratorRuntime.wrap(function callee$0$1$(context$1$0) {
      while (1) switch (context$1$0.prev = context$1$0.next) {
        case 0:
          if (__DEV__) {
            React.isValidElement(rootElement).should.be["true"];
            nexus.should.be.an.Object;
            __NODE__.should.be["true"];
            _.each(nexus, function (flux) {
              return flux.should.be.an.instanceOf(Flux.Client);
            });
          }
          context$1$0.next = 3;
          return Nexus._prefetchApp(rootElement, nexus);
        case 3:
          data = context$1$0.sent;
          _.each(nexus, function (flux, key) {
            return flux.startInjecting(data[key]);
          });
          html = Nexus._withNexus(nexus, function () {
            return React.renderToStaticMarkup(rootElement);
          });
          _.each(nexus, function (flux) {
            return flux.stopInjecting();
          });
          return context$1$0.abrupt("return", [html, data]);
        case 8:
        case "end":
          return context$1$0.stop();
      }
    }, callee$0$1, this);
  })),
  // In the client, mount the rootElement using the given nexus and the given prefetched data into
  // the given domNode. Also globally and durably set the global nexus context.
  mountApp: function mountApp(rootElement, nexus, data, domNode) {
    if (__DEV__) {
      React.isValidElement(rootElement).should.be["true"];
      nexus.should.be.an.Object;
      data.should.be.an.Object;
      domNode.should.be.an.Object;
      __BROWSER__.should.be["true"];
      _.each(nexus, function (flux) {
        return flux.should.be.an.instanceOf(Flux.Client);
      });
      (Nexus.currentNexus === null).should.be["true"];
    }
    Nexus.currentNexus = nexus;
    _.each(nexus, function (flux, key) {
      return flux.startInjecting(data[key]);
    });
    var r = React.render(rootElement, domNode);
    _.each(nexus, function (flux, key) {
      return flux.stopInjecting(data[key]);
    });
    return r;
  },

  // Temporarly set the global nexus context and run a synchronous function within this context
  _withNexus: function WithNexus(nexus, fn) {
    var previousNexus = Nexus.currentNexus;
    Nexus.currentNexus = nexus;
    var r = fn();
    Nexus.currentNexus = previousNexus;
    return r;
  },

  // In the server, prefetch the dependencies and store them in the nexus as a side effect.
  // It will recursively prefetch all the nexus dependencies of all the components at the initial state.

  _prefetchApp: Promise.coroutine(regeneratorRuntime.mark(function callee$0$2(rootElement, nexus) {
    return regeneratorRuntime.wrap(function callee$0$2$(context$1$0) {
      while (1) switch (context$1$0.prev = context$1$0.next) {
        case 0:
          if (__DEV__) {
            React.isValidElement(rootElement).should.be["true"];
            nexus.should.be.an.Object;
            __NODE__.should.be["true"];
          }
          _.each(nexus, function (flux) {
            return flux.startPrefetching();
          });
          context$1$0.next = 4;
          return Nexus._prefetchElement(rootElement, nexus);
        case 4:
          return context$1$0.abrupt("return", _.mapValues(nexus, function (flux) {
            return flux.stopPrefetching();
          }));
        case 5:
        case "end":
          return context$1$0.stop();
      }
    }, callee$0$2, this);
  })),

  // Within a prefetchApp async stack, prefetch the dependencies of the given element and its descendants
  // it will:
  // - instanciate the component
  // - call componentWillMount
  // - yield to prefetch nexus bindings (if applicable)
  // - call render
  // - call componentWillUnmount
  // - yield to recursively prefetch descendant elements
  _prefetchElement: Promise.coroutine(regeneratorRuntime.mark(function callee$0$3(element, nexus) {
    return regeneratorRuntime.wrap(function callee$0$3$(context$1$0) {
      var _this = this;
      while (1) switch (context$1$0.prev = context$1$0.next) {
        case 0:
          if (__DEV__) {
            React.isValidElement(element).should.be["true"];
            nexus.should.be.an.Object;
            __NODE__.should.be["true"];
          }
          if (!Nexus.shouldPrefetch(element)) {
            context$1$0.next = 3;
            break;
          }
          return context$1$0.delegateYield(regeneratorRuntime.mark(function callee$1$0() {
            var instance, renderedElement;
            return regeneratorRuntime.wrap(function callee$1$0$(context$2$0) {
              while (1) switch (context$2$0.prev = context$2$0.next) {
                case 0:
                  instance = instanciateReactComponent(element);
                  if (!instance.prefetchNexusBindings) {
                    context$2$0.next = 4;
                    break;
                  }
                  context$2$0.next = 4;
                  return Nexus._withNexus(nexus, function () {
                    return instance.prefetchNexusBindings();
                  });
                case 4:
                  renderedElement = Nexus._withNexus(nexus, function () {
                    if (instance.getInitialState) {
                      instance.state = instance.getInitialState();
                    }
                    if (instance.componentWillMount) {
                      instance.componentWillMount();
                    }
                    return instance.render();
                  });
                  context$2$0.next = 7;
                  return Promise.all(_.map(flattenDescendants(renderedElement), function (descendantElement) {
                    return Nexus._prefetchElement(descendantElement, nexus);
                  }));
                case 7:
                case "end":
                  return context$2$0.stop();
              }
            }, callee$1$0, _this);
          })(), "t0", 3);
        case 3:
        case "end":
          return context$1$0.stop();
      }
    }, callee$0$3, this);
  })) };

Nexus.Mixin = Mixin(Nexus);

module.exports = Nexus;