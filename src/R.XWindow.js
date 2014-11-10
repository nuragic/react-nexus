/**
 * TODO
 */
module.exports = function(R) {
    const XWindow = {
        createPlugin(storeName, dispatcherName) {
            return R.App.createPlugin({
                displayName: "XWindow",
                installInClient(flux, window) {
                },
                installInServer(flux, req) {
                },
            });
        },
    };
    return XWindow;
};
