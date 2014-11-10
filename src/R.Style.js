module.exports = function(R) {
    const _ = require("lodash");
    const assert = require("assert");
    const recase = require("change-case");
    const parse = require("css-parse");
    const _autoprefixer = require("autoprefixer-core");
    const CleanCSS = require("clean-css");
    const should = R.should;

    var Style = function Style(style) {
        return Style.slowlyProcessReactStyle(style);
    };

    _.extend(Style, {
        Processors: {
            autoprefixer(css) {
                return _autoprefixer.process(css).css;
            },
             min(css) {
                return new CleanCSS().minify(css);
            },
        },
        _processors: [],
        registerCSSProcessor(process) {
            R.Style._processors.push(process);
        },
        applyAllProcessors(css) {
            let rCSS = css;
            Object.keys(Style._processors).forEach((process) => {
                rCSS = process(rCSS);
            });
            return rCSS;
        },
        slowlyProcessReactStyle: function slowlyProcessReactStyle(style) {
            let css = R.Style.applyAllProcessors("* {\n" + R.Style.getCSSFromReactStyle(style) + "}\n");
            return R.Style.slowlyGetReactStyleFromCSS(css);
        },
        getCSSFromReactStyle: function getCSSFromReactStyle(style, indent) {
            indent = indent || "";
            R.Debug.dev(function() {
                assert(_.isPlainObject(style), "R.Style.getCSSFromReactStyle(...).style: expecting Object.");
            });
            return _.map(style, function(val, attr) {
                return indent + recase.paramCase(attr) + ": " + val + ";\n";
            }).join("");
        },
        slowlyGetReactStyleFromCSS: function slowlyGetReactStyleFromCSS(css) {
            let style = {};
            let parsed = parse(css);
            R.Debug.dev(function() {
                assert(_.size(parsed.stylesheet.rules) === 1, "R.Style.slowlyGetReactStyleFromCSS(...): expecting only 1 set of rules.");
            });
            _.each(parsed.stylesheet.rules, function(rule) {
                if(rule.type === "rule") {
                    _.each(rule.declarations, function(decl) {
                        if(decl.type === "declaration") {
                            style[recase.camelCase(decl.property)] = decl.value;
                        }
                    });
                }
            });
            return style;
        },
    });

    return Style;
};
