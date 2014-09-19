module.exports = function(R) {
    var _ = require("lodash");
    var assert = require("assert");
    var React = require("react");

    var Client = function Client(appParams) {
        R.Debug.dev(function() {
            assert(R.isClient(), "R.Client(...): should only be called in the client.");
            if(window.React) {
                console.warn("Warning: React is already attached to window.");
            }
        });
        window.React = React;
        R.Debug.dev(R.scope(function() {
            if(!window.__ReactOnRails) {
                window.__ReactOnRails = {};
            }
            if(!window.__ReactOnRails.apps) {
                window.__ReactOnRails.apps = [];
            }
            window.__ReactOnRails.apps.push(this);
        }, this));
        this._app = new R.App(appParams);
    };

    _.extend(Client.prototype, /** @lends R.Client.prototype */ {
        _app: null,
        _rendered: false,
        mount: regeneratorRuntime.mark(function mount() {
            return regeneratorRuntime.wrap(function mount$(context$2$0) {
                while (1) switch (context$2$0.prev = context$2$0.next) {
                case 0:
                    assert(!this._rendered, "R.Client.render(...): should only call mount() once.");
                    context$2$0.next = 3;
                    return this._app.renderIntoDocumentInClient(window);
                case 3:
                case "end":
                    return context$2$0.stop();
                }
            }, mount, this);
        }),
    });

    R.Client = Client;
    return R;
};
