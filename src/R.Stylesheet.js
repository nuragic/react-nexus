module.exports = function(R) {
    const _ = require("lodash");
    const assert = require("assert");

    class Stylesheet {
        constructor(){
            this._rules = [];
        }

        registerRule(selector, style) {
            _.dev(() => _.isPlainObject(style));
            this._rules.push({
                selector: selector,
                style: style,
            });
        }

        getProcessedCSS() {
            return R.Style.applyAllProcessors(_.map(this._rules, (rule) => {
                return rule.selector + " {\n" + R.Style.getCSSFromReactStyle(rule.style, "  ") + "}\n";
            }).join("\n"));
        }
    }

    _.extend(Stylesheet.prototype, /** @lends R.Stylesheet.prototype */ {
        _isStylesheet_: true,
    });

    return Stylesheet;
};
