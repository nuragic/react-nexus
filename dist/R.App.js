"use strict";

require("6to5/polyfill");
var Promise = require("bluebird");
module.exports = function (R) {
  var co = require("co");
  var React = R.React;
  var _ = require("lodash");
  var assert = require("assert");
  var path = require("path");

  /**
  * <p>Simply create an App class with specifics</p>
  * <p>Provides methods in order to render the specified App server-side and client-side</p>
  * <ul>
  * <li> App.createApp => initializes methods of an application according to the specifications provided </li>
  * <li> App.renderToStringInServer => compute all React Components with data and render the corresponding HTML for the requesting client </li>
  * <li> App.renderIntoDocumentInClient => compute all React Components client-side and establishes a connection via socket in order to make data subscriptions</li>
  * <li> App.createPlugin => initiliaziation method of a plugin for the application </li>
  * </ul>
  * @class R.App
  */
  var App = {
    /**
    * <p> Initializes the application according to the specifications provided </p>
    * @method createApp
    * @param {object} specs All the specifications of the App
    * @return {AppInstance} AppInstance The instance of the created App
    */
    createApp: function createApp(specs) {
      R.Debug.dev(function () {
        assert(_.isPlainObject(specs), "R.App.createApp(...).specs: expecting Object.");
        assert(specs.fluxClass && _.isFunction(specs.fluxClass), "R.App.createApp(...).specs.fluxClass: expecting Function.");
        assert(specs.rootClass && _.isFunction(specs.rootClass), "R.App.createApp(...).specs.rootClass: expecting Function.");
        assert(specs.bootstrapTemplateVarsInServer && _.isFunction(specs.bootstrapTemplateVarsInServer, "R.App.createApp(...).specs.bootstrapTemplateVarsInServer: expecting Function."));
      });

      var AppInstance = function AppInstance() {
        _.extend(this, {
          _fluxClass: specs.fluxClass,
          _rootClass: specs.rootClass,
          _template: specs.template || App.defaultTemplate,
          _bootstrapTemplateVarsInServer: specs.bootstrapTemplateVarsInServer,
          _vars: specs.vars || {},
          _plugins: specs.plugins || {},
          _templateLibs: _.extend(specs.templateLibs || {}, {
            _: _ }) });
        _.extend(this, specs);
        _.each(specs, R.scope(function (val, attr) {
          if (_.isFunction(val)) {
            this[attr] = R.scope(val, this);
          }
        }, this));
      };
      _.extend(AppInstance.prototype, R.App._AppInstancePrototype);
      return AppInstance;
    },
    _AppInstancePrototype: {
      _fluxClass: null,
      _rootClass: null,
      _template: null,
      _bootstrapTemplateVarsInServer: null,
      _vars: null,
      _templateLibs: null,
      _plugins: null,
      /**
      * <p>Compute all React Components with data server-side and render the corresponding HTML for the requesting client</p>
      * @method renderToStringInServer
      * @param {object} req The classical request object
      * @return {object} template : the computed HTML template with data for the requesting client
      */
      renderToStringInServer: regeneratorRuntime.mark(function renderToStringInServer(req) {
        var guid, flux, rootProps, surrogateRootComponent, factoryRootComponent, rootComponent, rootHtml, serializedFlux;
        return regeneratorRuntime.wrap(function renderToStringInServer$(context$2$0) {
          while (1) switch (context$2$0.prev = context$2$0.next) {case 0:

              R.Debug.dev(function () {
                assert(R.isServer(), "R.App.AppInstance.renderAppToStringInServer(...): should be in server.");
              });
              guid = R.guid();
              flux = new this._fluxClass();
              context$2$0.next = 5;
              return flux.bootstrapInServer(req, req.headers, guid);

            case 5:

              //Initializes plugin and fill all corresponding data for store : Memory
              _.each(this._plugins, function (Plugin, name) {
                var plugin = new Plugin();
                R.Debug.dev(function () {
                  assert(plugin.installInServer && _.isFunction(plugin.installInServer), "R.App.renderToStringInServer(...).plugins[...].installInServer: expecting Function. ('" + name + "')");
                });
                plugin.installInServer(flux, req);
              });
              rootProps = { flux: flux };

              R.Debug.dev(R.scope(function () {
                _.extend(rootProps, { __ReactOnRailsApp: this });
              }, this));

              surrogateRootComponent = new this._rootClass.__ReactOnRailsSurrogate({}, rootProps);

              if (!surrogateRootComponent.componentWillMount) {
                R.Debug.dev(function () {
                  console.error("Root component doesn't have componentWillMount. Maybe you forgot R.Root.Mixin? ('" + surrogateRootComponent.displayName + "')");
                });
              }
              surrogateRootComponent.componentWillMount();

              context$2$0.next = 13;
              return surrogateRootComponent.prefetchFluxStores();

            case 13:

              surrogateRootComponent.componentWillUnmount();

              factoryRootComponent = React.createFactory(this._rootClass);
              rootComponent = factoryRootComponent(rootProps);

              flux.startInjectingFromStores();
              rootHtml = React.renderToString(rootComponent);

              flux.stopInjectingFromStores();

              serializedFlux = flux.serialize();

              flux.destroy();
              context$2$0.next = 23;
              return this._bootstrapTemplateVarsInServer(req);

            case 23:
              context$2$0.t0 = context$2$0.sent;
              context$2$0.t1 = {
                rootHtml: rootHtml,
                serializedFlux: serializedFlux,
                serializedHeaders: R.Base64.encode(JSON.stringify(req.headers)),
                guid: guid };
              context$2$0.t2 = _.extend({}, context$2$0.t0, this._vars, context$2$0.t1);
              return context$2$0.abrupt("return", this._template(context$2$0.t2, this._templateLibs));

            case 27:
            case "end": return context$2$0.stop();
          }
        }, renderToStringInServer, this);
      }),
      /**
      * <p>Setting all the data for each React Component and Render it into the client. <br />
      * Connecting to the uplink-server via in order to enable the establishment of subsriptions for each React Component</p>
      * @method renderIntoDocumentInClient
      * @param {object} window The classical window object
      */
      renderIntoDocumentInClient: regeneratorRuntime.mark(function renderIntoDocumentInClient(window) {
        var flux, headers, guid, rootProps, factoryRootComponent, rootComponent;
        return regeneratorRuntime.wrap(function renderIntoDocumentInClient$(context$2$0) {
          while (1) switch (context$2$0.prev = context$2$0.next) {case 0:

              R.Debug.dev(function () {
                assert(R.isClient(), "R.App.AppInstance.renderAppIntoDocumentInClient(...): should be in client.");
                assert(_.has(window, "__ReactOnRails") && _.isPlainObject(window.__ReactOnRails), "R.App.AppInstance.renderIntoDocumentInClient(...).__ReactOnRails: expecting Object.");
                assert(_.has(window.__ReactOnRails, "guid") && _.isString(window.__ReactOnRails.guid), "R.App.AppInstance.renderIntoDocumentInClient(...).__ReactOnRails.guid: expecting String.");
                assert(_.has(window.__ReactOnRails, "serializedFlux") && _.isString(window.__ReactOnRails.serializedFlux), "R.App.AppInstance.renderIntoDocumentInClient(...).__ReactOnRails.serializedFlux: expecting String.");
                assert(_.has(window.__ReactOnRails, "serializedHeaders") && _.isString(window.__ReactOnRails.serializedHeaders), "R.App.AppInstance.renderIntoDocumentInClient(...).__ReactOnRails.headers: expecting String.");
              });
              flux = new this._fluxClass();

              R.Debug.dev(function () {
                window.__ReactOnRails.flux = flux;
              });
              headers = JSON.parse(R.Base64.decode(window.__ReactOnRails.serializedHeaders));
              guid = window.__ReactOnRails.guid;
              context$2$0.next = 7;
              return flux.bootstrapInClient(window, headers, guid);

            case 7:

              //Unserialize flux in order to fill all data in store
              flux.unserialize(window.__ReactOnRails.serializedFlux);
              _.each(this._plugins, function (Plugin, name) {
                var plugin = new Plugin();
                R.Debug.dev(function () {
                  assert(plugin.installInClient && _.isFunction(plugin.installInClient), "R.App.renderToStringInServer(...).plugins[...].installInClient: expecting Function. ('" + name + "')");
                });
                plugin.installInClient(flux, window);
              });
              rootProps = { flux: flux };

              R.Debug.dev(R.scope(function () {
                _.extend(rootProps, { __ReactOnRailsApp: this });
              }, this));
              factoryRootComponent = React.createFactory(this._rootClass);
              rootComponent = factoryRootComponent(rootProps);

              R.Debug.dev(function () {
                window.__ReactOnRails.rootComponent = rootComponent;
              });
              flux.startInjectingFromStores();
              /*
              * Render root component client-side, for each components:
              * 1. getInitialState : return store data computed server-side with R.Flux.prefetchFluxStores
              * 2. componentWillMount : initialization 
              * 3. Render : compute DOM with store data computed server-side with R.Flux.prefetchFluxStores
              * Root Component already has this server-rendered markup, 
              * React will preserve it and only attach event handlers.
              * 4. Finally componentDidMount (subscribe and fetching data) then rerendering with new potential computed data
              */
              React.render(rootComponent, window.document.getElementById("ReactOnRails-App-Root"));
              flux.stopInjectingFromStores();

            case 17:
            case "end": return context$2$0.stop();
          }
        }, renderIntoDocumentInClient, this);
      }) },
    /**
    * <p>Initiliaziation method of a plugin for the application</p>
    * @method createPlugin
    * @param {object} specs The specified specs provided by the plugin
    * @return {object} PluginInstance The instance of the created plugin
    */
    createPlugin: function createPlugin(specs) {
      R.Debug.dev(function () {
        assert(specs && _.isPlainObject(specs), "R.App.createPlugin(...).specs: expecting Object.");
        assert(specs.displayName && _.isString(specs.displayName), "R.App.createPlugin(...).specs.displayName: expecting String.");
        assert(specs.installInServer && _.isFunction(specs.installInServer), "R.App.createPlugin(...).specs.installInServer: expecting Function.");
        assert(specs.installInClient && _.isFunction(specs.installInClient), "R.App.createPlugin(...).specs.installInClient: expecting Function.");
      });

      var PluginInstance = function PluginInstance() {
        this.displayName = specs.displayName;
        _.each(specs, R.scope(function (val, attr) {
          if (_.isFunction(val)) {
            this[attr] = R.scope(val, this);
          }
        }, this));
      };

      _.extend(PluginInstance.prototype, specs, App._PluginInstancePrototype);

      return PluginInstance;
    },
    _PluginInstancePrototype: {
      displayName: null,
      installInClient: null,
      installInServer: null } };

  if (R.isServer()) {
    var fs = require("fs");
    var _defaultTemplate = _.template(fs.readFileSync(path.join(__dirname, "..", "src", "R.App.defaultTemplate.tpl")));
    App.defaultTemplate = function defaultTemplate(vars, libs) {
      return _defaultTemplate({ vars: vars, libs: libs });
    };
  } else {
    App.defaultTemplate = function defaultTemplate(vars, libs) {
      throw new Error("R.App.AppInstance.defaultTemplate(...): should not be called in the client.");
    };
  }

  return App;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImQ6L3dvcmtzcGFjZV9yZWZhY3Rvci9yZWFjdC1yYWlscy9zcmMvUi5BcHAuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7QUFDekIsSUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ3BDLE1BQU0sQ0FBQyxPQUFPLEdBQUcsVUFBUyxDQUFDLEVBQUU7QUFDekIsTUFBSSxFQUFFLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3ZCLE1BQUksS0FBSyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDcEIsTUFBSSxDQUFDLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQzFCLE1BQUksTUFBTSxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUMvQixNQUFJLElBQUksR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7Ozs7Ozs7Ozs7Ozs7QUFhM0IsTUFBSSxHQUFHLEdBQUc7Ozs7Ozs7QUFPTixhQUFTLEVBQUUsU0FBUyxTQUFTLENBQUMsS0FBSyxFQUFFO0FBQ2pDLE9BQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFlBQVc7QUFDbkIsY0FBTSxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLEVBQUUsK0NBQStDLENBQUMsQ0FBQztBQUNoRixjQUFNLENBQUMsS0FBSyxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsRUFBRSwyREFBMkQsQ0FBQyxDQUFDO0FBQ3RILGNBQU0sQ0FBQyxLQUFLLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxFQUFFLDJEQUEyRCxDQUFDLENBQUM7QUFDdEgsY0FBTSxDQUFDLEtBQUssQ0FBQyw2QkFBNkIsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyw2QkFBNkIs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Q0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLDJCQUEyQixDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ25ILE9BQUcsQ0FBQyxlQUFlLEdBQUcsU0FBUyxlQUFlLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRTtBQUN2RCxhQUFPLGdCQUFnQixDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztLQUN2RCxDQUFDO0dBQ0wsTUFDSTtBQUNELE9BQUcsQ0FBQyxlQUFlLEdBQUcsU0FBUyxlQUFlLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRTtBQUN2RCxZQUFNLElBQUksS0FBSyxDQUFDLDZFQUE2RSxDQUFDLENBQUM7S0FDbEcsQ0FBQztHQUNMOztBQUVELFNBQU8sR0FBRyxDQUFDO0NBQ2QsQ0FBQyIsImZpbGUiOiJSLkFwcC5qcyIsInNvdXJjZXNDb250ZW50IjpbInJlcXVpcmUoJzZ0bzUvcG9seWZpbGwnKTtcbmNvbnN0IFByb21pc2UgPSByZXF1aXJlKCdibHVlYmlyZCcpO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihSKSB7XHJcbiAgICB2YXIgY28gPSByZXF1aXJlKFwiY29cIik7XHJcbiAgICB2YXIgUmVhY3QgPSBSLlJlYWN0O1xyXG4gICAgdmFyIF8gPSByZXF1aXJlKFwibG9kYXNoXCIpO1xyXG4gICAgdmFyIGFzc2VydCA9IHJlcXVpcmUoXCJhc3NlcnRcIik7XHJcbiAgICB2YXIgcGF0aCA9IHJlcXVpcmUoXCJwYXRoXCIpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgKiA8cD5TaW1wbHkgY3JlYXRlIGFuIEFwcCBjbGFzcyB3aXRoIHNwZWNpZmljczwvcD5cclxuICAgICogPHA+UHJvdmlkZXMgbWV0aG9kcyBpbiBvcmRlciB0byByZW5kZXIgdGhlIHNwZWNpZmllZCBBcHAgc2VydmVyLXNpZGUgYW5kIGNsaWVudC1zaWRlPC9wPlxyXG4gICAgKiA8dWw+XHJcbiAgICAqIDxsaT4gQXBwLmNyZWF0ZUFwcCA9PiBpbml0aWFsaXplcyBtZXRob2RzIG9mIGFuIGFwcGxpY2F0aW9uIGFjY29yZGluZyB0byB0aGUgc3BlY2lmaWNhdGlvbnMgcHJvdmlkZWQgPC9saT5cclxuICAgICogPGxpPiBBcHAucmVuZGVyVG9TdHJpbmdJblNlcnZlciA9PiBjb21wdXRlIGFsbCBSZWFjdCBDb21wb25lbnRzIHdpdGggZGF0YSBhbmQgcmVuZGVyIHRoZSBjb3JyZXNwb25kaW5nIEhUTUwgZm9yIHRoZSByZXF1ZXN0aW5nIGNsaWVudCA8L2xpPlxyXG4gICAgKiA8bGk+IEFwcC5yZW5kZXJJbnRvRG9jdW1lbnRJbkNsaWVudCA9PiBjb21wdXRlIGFsbCBSZWFjdCBDb21wb25lbnRzIGNsaWVudC1zaWRlIGFuZCBlc3RhYmxpc2hlcyBhIGNvbm5lY3Rpb24gdmlhIHNvY2tldCBpbiBvcmRlciB0byBtYWtlIGRhdGEgc3Vic2NyaXB0aW9uczwvbGk+XHJcbiAgICAqIDxsaT4gQXBwLmNyZWF0ZVBsdWdpbiA9PiBpbml0aWxpYXppYXRpb24gbWV0aG9kIG9mIGEgcGx1Z2luIGZvciB0aGUgYXBwbGljYXRpb24gPC9saT5cclxuICAgICogPC91bD5cclxuICAgICogQGNsYXNzIFIuQXBwXHJcbiAgICAqL1xyXG4gICAgdmFyIEFwcCA9IHtcclxuICAgICAgICAvKipcclxuICAgICAgICAqIDxwPiBJbml0aWFsaXplcyB0aGUgYXBwbGljYXRpb24gYWNjb3JkaW5nIHRvIHRoZSBzcGVjaWZpY2F0aW9ucyBwcm92aWRlZCA8L3A+XHJcbiAgICAgICAgKiBAbWV0aG9kIGNyZWF0ZUFwcFxyXG4gICAgICAgICogQHBhcmFtIHtvYmplY3R9IHNwZWNzIEFsbCB0aGUgc3BlY2lmaWNhdGlvbnMgb2YgdGhlIEFwcFxyXG4gICAgICAgICogQHJldHVybiB7QXBwSW5zdGFuY2V9IEFwcEluc3RhbmNlIFRoZSBpbnN0YW5jZSBvZiB0aGUgY3JlYXRlZCBBcHBcclxuICAgICAgICAqL1xyXG4gICAgICAgIGNyZWF0ZUFwcDogZnVuY3Rpb24gY3JlYXRlQXBwKHNwZWNzKSB7XHJcbiAgICAgICAgICAgIFIuRGVidWcuZGV2KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgYXNzZXJ0KF8uaXNQbGFpbk9iamVjdChzcGVjcyksIFwiUi5BcHAuY3JlYXRlQXBwKC4uLikuc3BlY3M6IGV4cGVjdGluZyBPYmplY3QuXCIpO1xyXG4gICAgICAgICAgICAgICAgYXNzZXJ0KHNwZWNzLmZsdXhDbGFzcyAmJiBfLmlzRnVuY3Rpb24oc3BlY3MuZmx1eENsYXNzKSwgXCJSLkFwcC5jcmVhdGVBcHAoLi4uKS5zcGVjcy5mbHV4Q2xhc3M6IGV4cGVjdGluZyBGdW5jdGlvbi5cIik7XHJcbiAgICAgICAgICAgICAgICBhc3NlcnQoc3BlY3Mucm9vdENsYXNzICYmIF8uaXNGdW5jdGlvbihzcGVjcy5yb290Q2xhc3MpLCBcIlIuQXBwLmNyZWF0ZUFwcCguLi4pLnNwZWNzLnJvb3RDbGFzczogZXhwZWN0aW5nIEZ1bmN0aW9uLlwiKTtcclxuICAgICAgICAgICAgICAgIGFzc2VydChzcGVjcy5ib290c3RyYXBUZW1wbGF0ZVZhcnNJblNlcnZlciAmJiBfLmlzRnVuY3Rpb24oc3BlY3MuYm9vdHN0cmFwVGVtcGxhdGVWYXJzSW5TZXJ2ZXIsIFwiUi5BcHAuY3JlYXRlQXBwKC4uLikuc3BlY3MuYm9vdHN0cmFwVGVtcGxhdGVWYXJzSW5TZXJ2ZXI6IGV4cGVjdGluZyBGdW5jdGlvbi5cIikpO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIHZhciBBcHBJbnN0YW5jZSA9IGZ1bmN0aW9uIEFwcEluc3RhbmNlKCkge1xyXG4gICAgICAgICAgICAgICAgXy5leHRlbmQodGhpcywge1xyXG4gICAgICAgICAgICAgICAgICAgIF9mbHV4Q2xhc3M6IHNwZWNzLmZsdXhDbGFzcyxcclxuICAgICAgICAgICAgICAgICAgICBfcm9vdENsYXNzOiBzcGVjcy5yb290Q2xhc3MsXHJcbiAgICAgICAgICAgICAgICAgICAgX3RlbXBsYXRlOiBzcGVjcy50ZW1wbGF0ZSB8fCBBcHAuZGVmYXVsdFRlbXBsYXRlLFxyXG4gICAgICAgICAgICAgICAgICAgIF9ib290c3RyYXBUZW1wbGF0ZVZhcnNJblNlcnZlcjogc3BlY3MuYm9vdHN0cmFwVGVtcGxhdGVWYXJzSW5TZXJ2ZXIsXHJcbiAgICAgICAgICAgICAgICAgICAgX3ZhcnM6IHNwZWNzLnZhcnMgfHwge30sXHJcbiAgICAgICAgICAgICAgICAgICAgX3BsdWdpbnM6IHNwZWNzLnBsdWdpbnMgfHwge30sXHJcbiAgICAgICAgICAgICAgICAgICAgX3RlbXBsYXRlTGliczogXy5leHRlbmQoc3BlY3MudGVtcGxhdGVMaWJzIHx8IHt9LCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIF86IF8sXHJcbiAgICAgICAgICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIF8uZXh0ZW5kKHRoaXMsIHNwZWNzKTtcclxuICAgICAgICAgICAgICAgIF8uZWFjaChzcGVjcywgUi5zY29wZShmdW5jdGlvbih2YWwsIGF0dHIpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZihfLmlzRnVuY3Rpb24odmFsKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzW2F0dHJdID0gUi5zY29wZSh2YWwsIHRoaXMpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sIHRoaXMpKTtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgXy5leHRlbmQoQXBwSW5zdGFuY2UucHJvdG90eXBlLCBSLkFwcC5fQXBwSW5zdGFuY2VQcm90b3R5cGUpO1xyXG4gICAgICAgICAgICByZXR1cm4gQXBwSW5zdGFuY2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBfQXBwSW5zdGFuY2VQcm90b3R5cGU6IHtcclxuICAgICAgICAgICAgX2ZsdXhDbGFzczogbnVsbCxcclxuICAgICAgICAgICAgX3Jvb3RDbGFzczogbnVsbCxcclxuICAgICAgICAgICAgX3RlbXBsYXRlOiBudWxsLFxyXG4gICAgICAgICAgICBfYm9vdHN0cmFwVGVtcGxhdGVWYXJzSW5TZXJ2ZXI6IG51bGwsXHJcbiAgICAgICAgICAgIF92YXJzOiBudWxsLFxyXG4gICAgICAgICAgICBfdGVtcGxhdGVMaWJzOiBudWxsLFxyXG4gICAgICAgICAgICBfcGx1Z2luczogbnVsbCxcclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICogPHA+Q29tcHV0ZSBhbGwgUmVhY3QgQ29tcG9uZW50cyB3aXRoIGRhdGEgc2VydmVyLXNpZGUgYW5kIHJlbmRlciB0aGUgY29ycmVzcG9uZGluZyBIVE1MIGZvciB0aGUgcmVxdWVzdGluZyBjbGllbnQ8L3A+XHJcbiAgICAgICAgICAgICogQG1ldGhvZCByZW5kZXJUb1N0cmluZ0luU2VydmVyXHJcbiAgICAgICAgICAgICogQHBhcmFtIHtvYmplY3R9IHJlcSBUaGUgY2xhc3NpY2FsIHJlcXVlc3Qgb2JqZWN0XHJcbiAgICAgICAgICAgICogQHJldHVybiB7b2JqZWN0fSB0ZW1wbGF0ZSA6IHRoZSBjb21wdXRlZCBIVE1MIHRlbXBsYXRlIHdpdGggZGF0YSBmb3IgdGhlIHJlcXVlc3RpbmcgY2xpZW50XHJcbiAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIHJlbmRlclRvU3RyaW5nSW5TZXJ2ZXI6IGZ1bmN0aW9uKiByZW5kZXJUb1N0cmluZ0luU2VydmVyKHJlcSkge1xyXG4gICAgICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KFIuaXNTZXJ2ZXIoKSwgXCJSLkFwcC5BcHBJbnN0YW5jZS5yZW5kZXJBcHBUb1N0cmluZ0luU2VydmVyKC4uLik6IHNob3VsZCBiZSBpbiBzZXJ2ZXIuXCIpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAvL0dlbmVyYXRlIGEgZ3VpZFxyXG4gICAgICAgICAgICAgICAgdmFyIGd1aWQgPSBSLmd1aWQoKTtcclxuICAgICAgICAgICAgICAgIC8vRmx1eCBpcyB0aGUgY2xhc3MgdGhhdCB3aWxsIGFsbG93IGVhY2ggY29tcG9uZW50IHRvIHJldHJpZXZlIGRhdGFcclxuICAgICAgICAgICAgICAgIHZhciBmbHV4ID0gbmV3IHRoaXMuX2ZsdXhDbGFzcygpO1xyXG4gICAgICAgICAgICAgICAgLy9SZWdpc3RlciBzdG9yZSAoUi5TdG9yZSkgOiBVcGxpbmtTZXJ2ZXIgYW5kIE1lbW9yeVxyXG4gICAgICAgICAgICAgICAgLy9Jbml0aWFsaXplcyBmbHV4IGFuZCBVcGxpbmtTZXJ2ZXIgaW4gb3JkZXIgdG8gYmUgYWJsZSB0byBmZXRjaCBkYXRhIGZyb20gdXBsaW5rLXNlcnZlclxyXG4gICAgICAgICAgICAgICAgeWllbGQgZmx1eC5ib290c3RyYXBJblNlcnZlcihyZXEsIHJlcS5oZWFkZXJzLCBndWlkKTtcclxuICAgICAgICAgICAgICAgIC8vSW5pdGlhbGl6ZXMgcGx1Z2luIGFuZCBmaWxsIGFsbCBjb3JyZXNwb25kaW5nIGRhdGEgZm9yIHN0b3JlIDogTWVtb3J5XHJcbiAgICAgICAgICAgICAgICBfLmVhY2godGhpcy5fcGx1Z2lucywgZnVuY3Rpb24oUGx1Z2luLCBuYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHBsdWdpbiA9IG5ldyBQbHVnaW4oKTtcclxuICAgICAgICAgICAgICAgICAgICBSLkRlYnVnLmRldihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KHBsdWdpbi5pbnN0YWxsSW5TZXJ2ZXIgJiYgXy5pc0Z1bmN0aW9uKHBsdWdpbi5pbnN0YWxsSW5TZXJ2ZXIpLCBcIlIuQXBwLnJlbmRlclRvU3RyaW5nSW5TZXJ2ZXIoLi4uKS5wbHVnaW5zWy4uLl0uaW5zdGFsbEluU2VydmVyOiBleHBlY3RpbmcgRnVuY3Rpb24uICgnXCIgKyBuYW1lICsgXCInKVwiKTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICBwbHVnaW4uaW5zdGFsbEluU2VydmVyKGZsdXgsIHJlcSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIHZhciByb290UHJvcHMgPSB7IGZsdXg6IGZsdXggfTtcclxuICAgICAgICAgICAgICAgIFIuRGVidWcuZGV2KFIuc2NvcGUoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgXy5leHRlbmQocm9vdFByb3BzLCB7IF9fUmVhY3RPblJhaWxzQXBwOiB0aGlzIH0pO1xyXG4gICAgICAgICAgICAgICAgfSwgdGhpcykpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vQ3JlYXRlIHRoZSBSZWFjdCBpbnN0YW5jZSBvZiByb290IGNvbXBvbmVudCB3aXRoIGZsdXhcclxuICAgICAgICAgICAgICAgIHZhciBzdXJyb2dhdGVSb290Q29tcG9uZW50ID0gbmV3IHRoaXMuX3Jvb3RDbGFzcy5fX1JlYWN0T25SYWlsc1N1cnJvZ2F0ZSh7fSwgcm9vdFByb3BzKTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZighc3Vycm9nYXRlUm9vdENvbXBvbmVudC5jb21wb25lbnRXaWxsTW91bnQpIHtcclxuICAgICAgICAgICAgICAgICAgICBSLkRlYnVnLmRldihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIlJvb3QgY29tcG9uZW50IGRvZXNuJ3QgaGF2ZSBjb21wb25lbnRXaWxsTW91bnQuIE1heWJlIHlvdSBmb3Jnb3QgUi5Sb290Lk1peGluPyAoJ1wiICsgc3Vycm9nYXRlUm9vdENvbXBvbmVudC5kaXNwbGF5TmFtZSArIFwiJylcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBzdXJyb2dhdGVSb290Q29tcG9uZW50LmNvbXBvbmVudFdpbGxNb3VudCgpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vRmV0Y2hpbmcgcm9vdCBjb21wb25lbnQgYW5kIGNoaWxkcyBpbiBvcmRlciB0byByZXRyaWV2ZSBhbGwgZGF0YVxyXG4gICAgICAgICAgICAgICAgLy9GaWxsIGFsbCBkYXRhIGZvciBzdG9yZSA6IFVwbGlua1xyXG4gICAgICAgICAgICAgICAgeWllbGQgc3Vycm9nYXRlUm9vdENvbXBvbmVudC5wcmVmZXRjaEZsdXhTdG9yZXMoKTtcclxuICAgICAgICAgICAgICAgIHN1cnJvZ2F0ZVJvb3RDb21wb25lbnQuY29tcG9uZW50V2lsbFVubW91bnQoKTtcclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgZmFjdG9yeVJvb3RDb21wb25lbnQgPSBSZWFjdC5jcmVhdGVGYWN0b3J5KHRoaXMuX3Jvb3RDbGFzcyk7XHJcbiAgICAgICAgICAgICAgICB2YXIgcm9vdENvbXBvbmVudCA9IGZhY3RvcnlSb290Q29tcG9uZW50KHJvb3RQcm9wcyk7XHJcbiAgICAgICAgICAgICAgICBmbHV4LnN0YXJ0SW5qZWN0aW5nRnJvbVN0b3JlcygpO1xyXG4gICAgICAgICAgICAgICAgLypcclxuICAgICAgICAgICAgICAgICogUmVuZGVyIHJvb3QgY29tcG9uZW50IHNlcnZlci1zaWRlLCBmb3IgZWFjaCBjb21wb25lbnRzIDpcclxuICAgICAgICAgICAgICAgICogMS4gZ2V0SW5pdGlhbFN0YXRlIDogcmV0dXJuIHByZWZldGNoZWQgc3RvcmVkIGRhdGEgYW5kIGZpbGwgdGhlIGNvbXBvbmVudCdzIHN0YXRlXHJcbiAgICAgICAgICAgICAgICAqIDIuIGNvbXBvbmVudFdpbGxNb3VudCA6IHNpbXBsZSBpbml0aWFsaXphdGlvbiBcclxuICAgICAgICAgICAgICAgICogMy4gUmVuZGVyIDogY29tcHV0ZSBET00gd2l0aCB0aGUgY29tcG9uZW50J3Mgc3RhdGVcclxuICAgICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgICAgICB2YXIgcm9vdEh0bWwgPSBSZWFjdC5yZW5kZXJUb1N0cmluZyhyb290Q29tcG9uZW50KTtcclxuICAgICAgICAgICAgICAgIGZsdXguc3RvcEluamVjdGluZ0Zyb21TdG9yZXMoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvL1NlcmlhbGl6ZXMgZmx1eCBpbiBvcmRlciB0byBwcm92aWRlcyBhbGwgcHJlZmV0Y2hlZCBzdG9yZWQgZGF0YSB0byB0aGUgY2xpZW50XHJcbiAgICAgICAgICAgICAgICB2YXIgc2VyaWFsaXplZEZsdXggPSBmbHV4LnNlcmlhbGl6ZSgpO1xyXG4gICAgICAgICAgICAgICAgZmx1eC5kZXN0cm95KCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fdGVtcGxhdGUoXy5leHRlbmQoe30sIHlpZWxkIHRoaXMuX2Jvb3RzdHJhcFRlbXBsYXRlVmFyc0luU2VydmVyKHJlcSksIHRoaXMuX3ZhcnMsIHtcclxuICAgICAgICAgICAgICAgICAgICByb290SHRtbDogcm9vdEh0bWwsXHJcbiAgICAgICAgICAgICAgICAgICAgc2VyaWFsaXplZEZsdXg6IHNlcmlhbGl6ZWRGbHV4LFxyXG4gICAgICAgICAgICAgICAgICAgIHNlcmlhbGl6ZWRIZWFkZXJzOiBSLkJhc2U2NC5lbmNvZGUoSlNPTi5zdHJpbmdpZnkocmVxLmhlYWRlcnMpKSxcclxuICAgICAgICAgICAgICAgICAgICBndWlkOiBndWlkLFxyXG4gICAgICAgICAgICAgICAgfSksIHRoaXMuX3RlbXBsYXRlTGlicyk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAqIDxwPlNldHRpbmcgYWxsIHRoZSBkYXRhIGZvciBlYWNoIFJlYWN0IENvbXBvbmVudCBhbmQgUmVuZGVyIGl0IGludG8gdGhlIGNsaWVudC4gPGJyIC8+XHJcbiAgICAgICAgICAgICogQ29ubmVjdGluZyB0byB0aGUgdXBsaW5rLXNlcnZlciB2aWEgaW4gb3JkZXIgdG8gZW5hYmxlIHRoZSBlc3RhYmxpc2htZW50IG9mIHN1YnNyaXB0aW9ucyBmb3IgZWFjaCBSZWFjdCBDb21wb25lbnQ8L3A+XHJcbiAgICAgICAgICAgICogQG1ldGhvZCByZW5kZXJJbnRvRG9jdW1lbnRJbkNsaWVudFxyXG4gICAgICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSB3aW5kb3cgVGhlIGNsYXNzaWNhbCB3aW5kb3cgb2JqZWN0XHJcbiAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIHJlbmRlckludG9Eb2N1bWVudEluQ2xpZW50OiBmdW5jdGlvbiogcmVuZGVySW50b0RvY3VtZW50SW5DbGllbnQod2luZG93KSB7XHJcbiAgICAgICAgICAgICAgICBSLkRlYnVnLmRldihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoUi5pc0NsaWVudCgpLCBcIlIuQXBwLkFwcEluc3RhbmNlLnJlbmRlckFwcEludG9Eb2N1bWVudEluQ2xpZW50KC4uLik6IHNob3VsZCBiZSBpbiBjbGllbnQuXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIGFzc2VydChfLmhhcyh3aW5kb3csIFwiX19SZWFjdE9uUmFpbHNcIikgJiYgXy5pc1BsYWluT2JqZWN0KHdpbmRvdy5fX1JlYWN0T25SYWlscyksIFwiUi5BcHAuQXBwSW5zdGFuY2UucmVuZGVySW50b0RvY3VtZW50SW5DbGllbnQoLi4uKS5fX1JlYWN0T25SYWlsczogZXhwZWN0aW5nIE9iamVjdC5cIik7XHJcbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KF8uaGFzKHdpbmRvdy5fX1JlYWN0T25SYWlscywgXCJndWlkXCIpICYmIF8uaXNTdHJpbmcod2luZG93Ll9fUmVhY3RPblJhaWxzLmd1aWQpLCBcIlIuQXBwLkFwcEluc3RhbmNlLnJlbmRlckludG9Eb2N1bWVudEluQ2xpZW50KC4uLikuX19SZWFjdE9uUmFpbHMuZ3VpZDogZXhwZWN0aW5nIFN0cmluZy5cIik7XHJcbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KF8uaGFzKHdpbmRvdy5fX1JlYWN0T25SYWlscywgXCJzZXJpYWxpemVkRmx1eFwiKSAmJiBfLmlzU3RyaW5nKHdpbmRvdy5fX1JlYWN0T25SYWlscy5zZXJpYWxpemVkRmx1eCksIFwiUi5BcHAuQXBwSW5zdGFuY2UucmVuZGVySW50b0RvY3VtZW50SW5DbGllbnQoLi4uKS5fX1JlYWN0T25SYWlscy5zZXJpYWxpemVkRmx1eDogZXhwZWN0aW5nIFN0cmluZy5cIik7XHJcbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KF8uaGFzKHdpbmRvdy5fX1JlYWN0T25SYWlscywgXCJzZXJpYWxpemVkSGVhZGVyc1wiKSAmJiBfLmlzU3RyaW5nKHdpbmRvdy5fX1JlYWN0T25SYWlscy5zZXJpYWxpemVkSGVhZGVycyksIFwiUi5BcHAuQXBwSW5zdGFuY2UucmVuZGVySW50b0RvY3VtZW50SW5DbGllbnQoLi4uKS5fX1JlYWN0T25SYWlscy5oZWFkZXJzOiBleHBlY3RpbmcgU3RyaW5nLlwiKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgdmFyIGZsdXggPSBuZXcgdGhpcy5fZmx1eENsYXNzKCk7XHJcbiAgICAgICAgICAgICAgICBSLkRlYnVnLmRldihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICB3aW5kb3cuX19SZWFjdE9uUmFpbHMuZmx1eCA9IGZsdXg7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIHZhciBoZWFkZXJzID0gSlNPTi5wYXJzZShSLkJhc2U2NC5kZWNvZGUod2luZG93Ll9fUmVhY3RPblJhaWxzLnNlcmlhbGl6ZWRIZWFkZXJzKSk7XHJcbiAgICAgICAgICAgICAgICB2YXIgZ3VpZCA9IHdpbmRvdy5fX1JlYWN0T25SYWlscy5ndWlkO1xyXG4gICAgICAgICAgICAgICAgLy9SZWdpc3RlciBzdG9yZSAoUi5TdG9yZSkgOiBVcGxpbmtTZXJ2ZXIgYW5kIE1lbW9yeVxyXG4gICAgICAgICAgICAgICAgLy9Jbml0aWFsaXplIGZsdXggYW5kIFVwbGlua1NlcnZlciBpbiBvcmRlciB0byBiZSBhYmxlIHRvIGZldGNoIGRhdGEgZnJvbSB1cGxpbmstc2VydmVyIGFuZCBjb25uZWN0IHRvIGl0IHZpYSBzb2NrZXRcclxuICAgICAgICAgICAgICAgIHlpZWxkIGZsdXguYm9vdHN0cmFwSW5DbGllbnQod2luZG93LCBoZWFkZXJzLCBndWlkKTtcclxuICAgICAgICAgICAgICAgIC8vVW5zZXJpYWxpemUgZmx1eCBpbiBvcmRlciB0byBmaWxsIGFsbCBkYXRhIGluIHN0b3JlXHJcbiAgICAgICAgICAgICAgICBmbHV4LnVuc2VyaWFsaXplKHdpbmRvdy5fX1JlYWN0T25SYWlscy5zZXJpYWxpemVkRmx1eCk7XHJcbiAgICAgICAgICAgICAgICBfLmVhY2godGhpcy5fcGx1Z2lucywgZnVuY3Rpb24oUGx1Z2luLCBuYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHBsdWdpbiA9IG5ldyBQbHVnaW4oKTtcclxuICAgICAgICAgICAgICAgICAgICBSLkRlYnVnLmRldihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KHBsdWdpbi5pbnN0YWxsSW5DbGllbnQgJiYgXy5pc0Z1bmN0aW9uKHBsdWdpbi5pbnN0YWxsSW5DbGllbnQpLCBcIlIuQXBwLnJlbmRlclRvU3RyaW5nSW5TZXJ2ZXIoLi4uKS5wbHVnaW5zWy4uLl0uaW5zdGFsbEluQ2xpZW50OiBleHBlY3RpbmcgRnVuY3Rpb24uICgnXCIgKyBuYW1lICsgXCInKVwiKTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICBwbHVnaW4uaW5zdGFsbEluQ2xpZW50KGZsdXgsIHdpbmRvdyk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIHZhciByb290UHJvcHMgPSB7IGZsdXg6IGZsdXggfTtcclxuICAgICAgICAgICAgICAgIFIuRGVidWcuZGV2KFIuc2NvcGUoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgXy5leHRlbmQocm9vdFByb3BzLCB7IF9fUmVhY3RPblJhaWxzQXBwOiB0aGlzIH0pO1xyXG4gICAgICAgICAgICAgICAgfSwgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgdmFyIGZhY3RvcnlSb290Q29tcG9uZW50ID0gUmVhY3QuY3JlYXRlRmFjdG9yeSh0aGlzLl9yb290Q2xhc3MpO1xyXG4gICAgICAgICAgICAgICAgdmFyIHJvb3RDb21wb25lbnQgPSBmYWN0b3J5Um9vdENvbXBvbmVudChyb290UHJvcHMpO1xyXG4gICAgICAgICAgICAgICAgUi5EZWJ1Zy5kZXYoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgd2luZG93Ll9fUmVhY3RPblJhaWxzLnJvb3RDb21wb25lbnQgPSByb290Q29tcG9uZW50O1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBmbHV4LnN0YXJ0SW5qZWN0aW5nRnJvbVN0b3JlcygpO1xyXG4gICAgICAgICAgICAgICAgLypcclxuICAgICAgICAgICAgICAgICogUmVuZGVyIHJvb3QgY29tcG9uZW50IGNsaWVudC1zaWRlLCBmb3IgZWFjaCBjb21wb25lbnRzOlxyXG4gICAgICAgICAgICAgICAgKiAxLiBnZXRJbml0aWFsU3RhdGUgOiByZXR1cm4gc3RvcmUgZGF0YSBjb21wdXRlZCBzZXJ2ZXItc2lkZSB3aXRoIFIuRmx1eC5wcmVmZXRjaEZsdXhTdG9yZXNcclxuICAgICAgICAgICAgICAgICogMi4gY29tcG9uZW50V2lsbE1vdW50IDogaW5pdGlhbGl6YXRpb24gXHJcbiAgICAgICAgICAgICAgICAqIDMuIFJlbmRlciA6IGNvbXB1dGUgRE9NIHdpdGggc3RvcmUgZGF0YSBjb21wdXRlZCBzZXJ2ZXItc2lkZSB3aXRoIFIuRmx1eC5wcmVmZXRjaEZsdXhTdG9yZXNcclxuICAgICAgICAgICAgICAgICogUm9vdCBDb21wb25lbnQgYWxyZWFkeSBoYXMgdGhpcyBzZXJ2ZXItcmVuZGVyZWQgbWFya3VwLCBcclxuICAgICAgICAgICAgICAgICogUmVhY3Qgd2lsbCBwcmVzZXJ2ZSBpdCBhbmQgb25seSBhdHRhY2ggZXZlbnQgaGFuZGxlcnMuXHJcbiAgICAgICAgICAgICAgICAqIDQuIEZpbmFsbHkgY29tcG9uZW50RGlkTW91bnQgKHN1YnNjcmliZSBhbmQgZmV0Y2hpbmcgZGF0YSkgdGhlbiByZXJlbmRlcmluZyB3aXRoIG5ldyBwb3RlbnRpYWwgY29tcHV0ZWQgZGF0YVxyXG4gICAgICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgICAgIFJlYWN0LnJlbmRlcihyb290Q29tcG9uZW50LCB3aW5kb3cuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJSZWFjdE9uUmFpbHMtQXBwLVJvb3RcIikpO1xyXG4gICAgICAgICAgICAgICAgZmx1eC5zdG9wSW5qZWN0aW5nRnJvbVN0b3JlcygpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgKiA8cD5Jbml0aWxpYXppYXRpb24gbWV0aG9kIG9mIGEgcGx1Z2luIGZvciB0aGUgYXBwbGljYXRpb248L3A+XHJcbiAgICAgICAgKiBAbWV0aG9kIGNyZWF0ZVBsdWdpblxyXG4gICAgICAgICogQHBhcmFtIHtvYmplY3R9IHNwZWNzIFRoZSBzcGVjaWZpZWQgc3BlY3MgcHJvdmlkZWQgYnkgdGhlIHBsdWdpblxyXG4gICAgICAgICogQHJldHVybiB7b2JqZWN0fSBQbHVnaW5JbnN0YW5jZSBUaGUgaW5zdGFuY2Ugb2YgdGhlIGNyZWF0ZWQgcGx1Z2luXHJcbiAgICAgICAgKi9cclxuICAgICAgICBjcmVhdGVQbHVnaW46IGZ1bmN0aW9uIGNyZWF0ZVBsdWdpbihzcGVjcykge1xyXG4gICAgICAgICAgICBSLkRlYnVnLmRldihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIGFzc2VydChzcGVjcyAmJiBfLmlzUGxhaW5PYmplY3Qoc3BlY3MpLCBcIlIuQXBwLmNyZWF0ZVBsdWdpbiguLi4pLnNwZWNzOiBleHBlY3RpbmcgT2JqZWN0LlwiKTtcclxuICAgICAgICAgICAgICAgIGFzc2VydChzcGVjcy5kaXNwbGF5TmFtZSAmJiBfLmlzU3RyaW5nKHNwZWNzLmRpc3BsYXlOYW1lKSwgXCJSLkFwcC5jcmVhdGVQbHVnaW4oLi4uKS5zcGVjcy5kaXNwbGF5TmFtZTogZXhwZWN0aW5nIFN0cmluZy5cIik7XHJcbiAgICAgICAgICAgICAgICBhc3NlcnQoc3BlY3MuaW5zdGFsbEluU2VydmVyICYmIF8uaXNGdW5jdGlvbihzcGVjcy5pbnN0YWxsSW5TZXJ2ZXIpLCBcIlIuQXBwLmNyZWF0ZVBsdWdpbiguLi4pLnNwZWNzLmluc3RhbGxJblNlcnZlcjogZXhwZWN0aW5nIEZ1bmN0aW9uLlwiKTtcclxuICAgICAgICAgICAgICAgIGFzc2VydChzcGVjcy5pbnN0YWxsSW5DbGllbnQgJiYgXy5pc0Z1bmN0aW9uKHNwZWNzLmluc3RhbGxJbkNsaWVudCksIFwiUi5BcHAuY3JlYXRlUGx1Z2luKC4uLikuc3BlY3MuaW5zdGFsbEluQ2xpZW50OiBleHBlY3RpbmcgRnVuY3Rpb24uXCIpO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIHZhciBQbHVnaW5JbnN0YW5jZSA9IGZ1bmN0aW9uIFBsdWdpbkluc3RhbmNlKCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5kaXNwbGF5TmFtZSA9IHNwZWNzLmRpc3BsYXlOYW1lO1xyXG4gICAgICAgICAgICAgICAgXy5lYWNoKHNwZWNzLCBSLnNjb3BlKGZ1bmN0aW9uKHZhbCwgYXR0cikge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKF8uaXNGdW5jdGlvbih2YWwpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXNbYXR0cl0gPSBSLnNjb3BlKHZhbCwgdGhpcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSwgdGhpcykpO1xyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgXy5leHRlbmQoUGx1Z2luSW5zdGFuY2UucHJvdG90eXBlLCBzcGVjcywgQXBwLl9QbHVnaW5JbnN0YW5jZVByb3RvdHlwZSk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gUGx1Z2luSW5zdGFuY2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBfUGx1Z2luSW5zdGFuY2VQcm90b3R5cGU6IHtcclxuICAgICAgICAgICAgZGlzcGxheU5hbWU6IG51bGwsXHJcbiAgICAgICAgICAgIGluc3RhbGxJbkNsaWVudDogbnVsbCxcclxuICAgICAgICAgICAgaW5zdGFsbEluU2VydmVyOiBudWxsLFxyXG4gICAgICAgIH0sXHJcbiAgICB9O1xyXG5cclxuICAgIGlmKFIuaXNTZXJ2ZXIoKSkge1xyXG4gICAgICAgIHZhciBmcyA9IHJlcXVpcmUoXCJmc1wiKTtcclxuICAgICAgICB2YXIgX2RlZmF1bHRUZW1wbGF0ZSA9IF8udGVtcGxhdGUoZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi5cIiwgXCJzcmNcIiwgXCJSLkFwcC5kZWZhdWx0VGVtcGxhdGUudHBsXCIpKSk7XHJcbiAgICAgICAgQXBwLmRlZmF1bHRUZW1wbGF0ZSA9IGZ1bmN0aW9uIGRlZmF1bHRUZW1wbGF0ZSh2YXJzLCBsaWJzKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBfZGVmYXVsdFRlbXBsYXRlKHsgdmFyczogdmFycywgbGliczogbGlicyB9KTtcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgQXBwLmRlZmF1bHRUZW1wbGF0ZSA9IGZ1bmN0aW9uIGRlZmF1bHRUZW1wbGF0ZSh2YXJzLCBsaWJzKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlIuQXBwLkFwcEluc3RhbmNlLmRlZmF1bHRUZW1wbGF0ZSguLi4pOiBzaG91bGQgbm90IGJlIGNhbGxlZCBpbiB0aGUgY2xpZW50LlwiKTtcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBBcHA7XHJcbn07XHJcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==