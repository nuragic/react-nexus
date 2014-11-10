module.exports = function(R) {
    const _ = require("lodash");
    const assert = require("assert");
    const should = R.should;

    const defaultParams = {
        width: 1280,
        height: 720,
        scrollTop: 0,
        scrollLeft: 0,
    };

    class Window extends R.App.Plugin {
        constructor(storeName, dispatcherName, eventEmitterName, params){
            super();
            this.storeName = storeName;
            this.dispatcherName = dispatcherName;
            this.eventEmitterName = eventEmitterName;
            this.params = params || {};
            _.defaults(params, defaultParams);
        }

        getDisplayName(){
            return 'Window';
        }

        installInClient(flux, window) {
            flux.getDispatcher(dispatcherName).addActionListener('/Window/scrollTo', (params) => {
                return _.copromise(function* () {
                    _.dev(() =>
                        params.should.be.an.Object &&
                        params.top.should.be.ok &&
                        params.top.should.be.a.Number &&
                        params.left.should.be.ok && 
                        params.left.should.be.a.Number
                        );
                    window.scrollTo(params.top, params.left);
                    yield _.defer;
                }, this);
            });
            window.addEventListener('scroll', () => {
                flux.getStore(storeName).set('/Window/scrollTop', window.scrollTop);
                flux.getStore(storeName).set('/Window/scrollLeft', window.scrollLeft);
                flux.getEventEmitter(eventEmitterName).emit("/Window/scroll", {
                    scrollTop: window.scrollTop,
                    scrollLeft: window.scrollLeft,
                });
            });
            window.addEventListener('resize', () => {
                flux.getStore(storeName).set('/Window/height', window.innerHeight);
                flux.getStore(storeName).set('/Window/width', window.innerWidth);
                flux.getEventEmitter(eventEmitterName).emit('/Window/resize', {
                    height: window.innerHeight,
                    width: window.innerWidth,
                });
            });
            flux.getStore(storeName).set('/Window/height', window.innerHeight);
            flux.getStore(storeName).set('/Window/width', window.innerWidth);
            flux.getStore(storeName).set('/Window/scrollTop', window.scrollTop);
            flux.getStore(storeName).set('/Window/scrollLeft', window.scrollLeft);
        }
        installInServer(flux, req) {
            flux.getStore(storeName).set('/Window/height', params.height);
            flux.getStore(storeName).set('/Window/width', params.width);
            flux.getStore(storeName).set('/Window/scrollTop', params.scrollTop);
            flux.getStore(storeName).set('/Window/scrollLeft', params.scrollLeft);
        }
    }

    return Window;
};
