"use strict";

var _classProps = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);

  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");
var Promise = require("bluebird");
module.exports = function (R) {
  var _ = R._;
  var should = R.should;

  var $ = (function () {
    var $ = function $(component) {
      this._subject = component;
    };

    _classProps($, null, {
      get: {
        writable: true,
        value: function () {
          return this._subject;
        }
      },
      type: {
        writable: true,
        value: function (optType) {
          if (optType) {
            this._subject = optType(this._subject.props);
            return this;
          } else {
            return this._subject.type;
          }
        }
      },
      prop: {
        writable: true,
        value: function (key, optVal) {
          if (optVal) {
            this._subject = this._subject.type(this._subject.props);
            this._subject.props[key] = optVal;
            return this;
          } else {
            return this._subject.props[key];
          }
        }
      },
      props: {
        writable: true,
        value: function (arg) {
          var _this = this;

          if (_.isArray(arg)) {
            return _.object(arg.map(function (val, key) {
              return [key, _this._subject.props[key]];
            }));
          } else {
            this._subject = this._subject.type(this._subject.props);
            arg.forEach(function (val, key) {
              return _this._subject.props[key] = val;
            });
            return this;
          }
        }
      },
      classNameList: {
        writable: true,
        value: function (optVal) {
          if (optVal) {
            return this.prop("className", optVal.join(" "));
          } else {
            return (this.prop("className") || "").split(" ");
          }
        }
      },
      addClassName: {
        writable: true,
        value: function (className) {
          var cx = this.classNameList();
          cx.push(className);
          return this.prop("className", _.uniq(cx));
        }
      },
      removeClassName: {
        writable: true,
        value: function (className) {
          var cx = this.classNameList();
          cx = _.without(cx, className);
          return this.prop("className", cx);
        }
      },
      hasClassName: {
        writable: true,
        value: function (className) {
          var cx = this.classNameList();
          return _.contains(cx, className);
        }
      },
      toggleClassName: {
        writable: true,
        value: function (className, optVal) {
          if (!_.isUndefined(optVal)) {
            if (optVal) {
              return this.addClassName(className);
            } else {
              return this.removeClassName(className);
            }
          } else {
            return this.toggleClassName(className, !this.hasClassName(className));
          }
        }
      },
      append: {
        writable: true,
        value: function (component) {
          var children = ReactChildren.getChildrenList(this._subject);
          children.push(component);
          return this.prop("children", children);
        }
      },
      prepend: {
        writable: true,
        value: function (component) {
          var children = ReactChildren.getChildrenList(this._subject);
          children.unshift(component);
          return this.prop("children", children);
        }
      },
      transformTree: {
        writable: true,
        value: function (fn) {
          this._subject = ReactChildren.transformTree(this._subject, fn);
          return this;
        }
      },
      tap: {
        writable: true,
        value: function (fn) {
          fn(this._subject);
          return this;
        }
      },
      walkTree: {
        writable: true,
        value: function (fn) {
          var tree = ReactChildren.mapTree(this._subject, _.identity);
          tree.forEach(fn);
          return this;
        }
      },
      endend: {
        writable: true,
        value: function () {
          var _subject = this._subject;
          this._subject = null;
          return _subject;
        }
      }
    });

    return $;
  })();

  _.extend($.prototype, /** @lends $.prototype */{
    _subject: null });

  return $;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImQ6L3dvcmtzcGFjZV9yZWZhY3Rvci9yZWFjdC1yYWlscy9zcmMvUi4kLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUEsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3pCLElBQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNwQyxNQUFNLENBQUMsT0FBTyxHQUFHLFVBQVMsQ0FBQyxFQUFFO0FBQzNCLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDZCxNQUFNLE1BQU0sR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDOztNQUVsQixDQUFDO1FBQUQsQ0FBQyxHQUNNLFNBRFAsQ0FBQyxDQUNPLFNBQVMsRUFBRTtBQUNyQixVQUFJLENBQUMsUUFBUSxHQUFHLFNBQVMsQ0FBQztLQUMzQjs7Z0JBSEcsQ0FBQztBQUtMLFNBQUc7O2VBQUEsWUFBRztBQUNKLGlCQUFPLElBQUksQ0FBQyxRQUFRLENBQUM7U0FDdEI7O0FBRUQsVUFBSTs7ZUFBQSxVQUFDLE9BQU8sRUFBRTtBQUNaLGNBQUcsT0FBTyxFQUFFO0FBQ1YsZ0JBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDN0MsbUJBQU8sSUFBSSxDQUFDO1dBQ2IsTUFDSTtBQUNILG1CQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDO1dBQzNCO1NBQ0Y7O0FBRUQsVUFBSTs7ZUFBQSxVQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUU7QUFDaEIsY0FBRyxNQUFNLEVBQUU7QUFDVCxnQkFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3hELGdCQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUM7QUFDbEMsbUJBQU8s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QUFDLENBQUMsU0FBUywyQkFBMkI7QUFDN0MsWUFBUSxFQUFFLElBQUksRUFDZixDQUFDLENBQUM7O0FBRUgsU0FBTyxDQUFDLENBQUM7Q0FDVixDQUFDIiwiZmlsZSI6IlIuJC5qcyIsInNvdXJjZXNDb250ZW50IjpbInJlcXVpcmUoJzZ0bzUvcG9seWZpbGwnKTtcbmNvbnN0IFByb21pc2UgPSByZXF1aXJlKCdibHVlYmlyZCcpO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihSKSB7XHJcbiAgY29uc3QgXyA9IFIuXztcclxuICBjb25zdCBzaG91bGQgPSBSLnNob3VsZDtcclxuXHJcbiAgY2xhc3MgJCB7XHJcbiAgICBjb25zdHJ1Y3Rvcihjb21wb25lbnQpIHtcclxuICAgICAgdGhpcy5fc3ViamVjdCA9IGNvbXBvbmVudDtcclxuICAgIH1cclxuXHJcbiAgICBnZXQoKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLl9zdWJqZWN0O1xyXG4gICAgfVxyXG5cclxuICAgIHR5cGUob3B0VHlwZSkge1xyXG4gICAgICBpZihvcHRUeXBlKSB7XHJcbiAgICAgICAgdGhpcy5fc3ViamVjdCA9IG9wdFR5cGUodGhpcy5fc3ViamVjdC5wcm9wcyk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgIH1cclxuICAgICAgZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N1YmplY3QudHlwZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByb3Aoa2V5LCBvcHRWYWwpIHtcclxuICAgICAgaWYob3B0VmFsKSB7XHJcbiAgICAgICAgdGhpcy5fc3ViamVjdCA9IHRoaXMuX3N1YmplY3QudHlwZSh0aGlzLl9zdWJqZWN0LnByb3BzKTtcclxuICAgICAgICB0aGlzLl9zdWJqZWN0LnByb3BzW2tleV0gPSBvcHRWYWw7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgIH1cclxuICAgICAgZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N1YmplY3QucHJvcHNba2V5XTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByb3BzKGFyZykge1xyXG4gICAgICBpZihfLmlzQXJyYXkoYXJnKSkge1xyXG4gICAgICAgIHJldHVybiBfLm9iamVjdChhcmcubWFwKCh2YWwsIGtleSkgPT4gW2tleSwgdGhpcy5fc3ViamVjdC5wcm9wc1trZXldXSkpO1xyXG4gICAgICB9XHJcbiAgICAgIGVsc2Uge1xyXG4gICAgICAgIHRoaXMuX3N1YmplY3QgPSB0aGlzLl9zdWJqZWN0LnR5cGUodGhpcy5fc3ViamVjdC5wcm9wcyk7XHJcbiAgICAgICAgYXJnLmZvckVhY2goKHZhbCwga2V5KSA9PiB0aGlzLl9zdWJqZWN0LnByb3BzW2tleV0gPSB2YWwpO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgY2xhc3NOYW1lTGlzdChvcHRWYWwpIHtcclxuICAgICAgaWYob3B0VmFsKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMucHJvcCgnY2xhc3NOYW1lJywgb3B0VmFsLmpvaW4oJyAnKSk7XHJcbiAgICAgIH1cclxuICAgICAgZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuICh0aGlzLnByb3AoJ2NsYXNzTmFtZScpIHx8ICcnKS5zcGxpdCgnICcpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgYWRkQ2xhc3NOYW1lKGNsYXNzTmFtZSkge1xyXG4gICAgICBsZXQgY3ggPSB0aGlzLmNsYXNzTmFtZUxpc3QoKTtcclxuICAgICAgY3gucHVzaChjbGFzc05hbWUpO1xyXG4gICAgICByZXR1cm4gdGhpcy5wcm9wKCdjbGFzc05hbWUnLCBfLnVuaXEoY3gpKTtcclxuICAgIH1cclxuXHJcbiAgICByZW1vdmVDbGFzc05hbWUoY2xhc3NOYW1lKSB7XHJcbiAgICAgIGxldCBjeCA9IHRoaXMuY2xhc3NOYW1lTGlzdCgpO1xyXG4gICAgICBjeCA9IF8ud2l0aG91dChjeCwgY2xhc3NOYW1lKTtcclxuICAgICAgcmV0dXJuIHRoaXMucHJvcCgnY2xhc3NOYW1lJywgY3gpO1xyXG4gICAgfVxyXG5cclxuICAgIGhhc0NsYXNzTmFtZShjbGFzc05hbWUpIHtcclxuICAgICAgbGV0IGN4ID0gdGhpcy5jbGFzc05hbWVMaXN0KCk7XHJcbiAgICAgIHJldHVybiBfLmNvbnRhaW5zKGN4LCBjbGFzc05hbWUpO1xyXG4gICAgfVxyXG5cclxuICAgIHRvZ2dsZUNsYXNzTmFtZShjbGFzc05hbWUsIG9wdFZhbCkge1xyXG4gICAgICBpZighXy5pc1VuZGVmaW5lZChvcHRWYWwpKSB7XHJcbiAgICAgICAgaWYob3B0VmFsKSB7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcy5hZGRDbGFzc05hbWUoY2xhc3NOYW1lKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcy5yZW1vdmVDbGFzc05hbWUoY2xhc3NOYW1lKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMudG9nZ2xlQ2xhc3NOYW1lKGNsYXNzTmFtZSwgIXRoaXMuaGFzQ2xhc3NOYW1lKGNsYXNzTmFtZSkpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgYXBwZW5kKGNvbXBvbmVudCkge1xyXG4gICAgICBsZXQgY2hpbGRyZW4gPSBSZWFjdENoaWxkcmVuLmdldENoaWxkcmVuTGlzdCh0aGlzLl9zdWJqZWN0KTtcclxuICAgICAgY2hpbGRyZW4ucHVzaChjb21wb25lbnQpO1xyXG4gICAgICByZXR1cm4gdGhpcy5wcm9wKCdjaGlsZHJlbicsIGNoaWxkcmVuKTtcclxuICAgIH1cclxuXHJcbiAgICBwcmVwZW5kKGNvbXBvbmVudCkge1xyXG4gICAgICBsZXQgY2hpbGRyZW4gPSBSZWFjdENoaWxkcmVuLmdldENoaWxkcmVuTGlzdCh0aGlzLl9zdWJqZWN0KTtcclxuICAgICAgY2hpbGRyZW4udW5zaGlmdChjb21wb25lbnQpO1xyXG4gICAgICByZXR1cm4gdGhpcy5wcm9wKCdjaGlsZHJlbicsIGNoaWxkcmVuKTtcclxuICAgIH1cclxuXHJcbiAgICB0cmFuc2Zvcm1UcmVlKGZuKSB7XHJcbiAgICAgIHRoaXMuX3N1YmplY3QgPSBSZWFjdENoaWxkcmVuLnRyYW5zZm9ybVRyZWUodGhpcy5fc3ViamVjdCwgZm4pO1xyXG4gICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICB0YXAoZm4pIHtcclxuICAgICAgZm4odGhpcy5fc3ViamVjdCk7XHJcbiAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG5cclxuICAgIHdhbGtUcmVlKGZuKSB7XHJcbiAgICAgIGxldCB0cmVlID0gUmVhY3RDaGlsZHJlbi5tYXBUcmVlKHRoaXMuX3N1YmplY3QsIF8uaWRlbnRpdHkpO1xyXG4gICAgICB0cmVlLmZvckVhY2goZm4pO1xyXG4gICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICBlbmRlbmQoKSB7XHJcbiAgICAgIGxldCBfc3ViamVjdCA9IHRoaXMuX3N1YmplY3Q7XHJcbiAgICAgIHRoaXMuX3N1YmplY3QgPSBudWxsO1xyXG4gICAgICByZXR1cm4gX3N1YmplY3Q7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBfLmV4dGVuZCgkLnByb3RvdHlwZSwgLyoqIEBsZW5kcyAkLnByb3RvdHlwZSAqL3tcclxuICAgIF9zdWJqZWN0OiBudWxsLFxyXG4gIH0pO1xyXG5cclxuICByZXR1cm4gJDtcclxufTtcclxuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9