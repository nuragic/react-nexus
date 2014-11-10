/**
 * TODO
 */
module.exports = function(R) {
    class XWindow extends R.App.plugin {
        constructor(){
            super();
        }

        getDisplayName(){
            return 'XWindow';
        }

        installInClient(flux, window) {
        }

        installInServer(flux, req) {
        }
    }
    return XWindow;
};
