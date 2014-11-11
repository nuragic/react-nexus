/**
 * TODO
 */
module.exports = function(R) {
  return (params) => {
    class XWindow extends R.App.plugin {
      constructor({ flux, window, req }){
        super();
        if(window) {
         // Client-only init
        }
        else {
          // Server-only init
        }
      }

      getDisplayName(){
        return 'XWindow';
      }
    }

    _.extend(XWindow.prototype, {
      displayName: 'XWindow',
    });

    return XWindow;
  };
};
