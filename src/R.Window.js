module.exports = function(R) {
  const _ = require('lodash');
  const should = R.should;

  const defaultParams = {
      width: 1280,
      height: 720,
      scrollTop: 0,
      scrollLeft: 0,
  };

  return ({storeName, dispatcherName, eventEmitterName, params}) => {
    _.defaults(params, defaultParams);
    
    class Window extends R.App.Plugin {
      constructor({ flux, window, req }){
        super();
        this.storeName = storeName;
        this.dispatcherName = dispatcherName;
        this.eventEmitterName = eventEmitterName;
        this.params = params;
        
        let store = flux.getStore(this.storeName);
        let eventEmitter = flux.getEventEmitter(this.eventEmitterName);
        
        if(window) {
          // Client-only init
          flux.getDispatcher(this.dispatcherName).addActionListener('/Window/scrollTo', (params) => {
            return _.copromise(function* () {
              _.dev(() =>
                params.should.be.an.Object &&
                params.top.should.be.a.Number &&
                params.left.should.be.a.Number
                );
              window.scrollTo(params.top, params.left);
              yield _.defer;
            }, this);
          });
          window.addEventListener('scroll', () => {
            store.set('/Window/scrollTop', window.scrollTop);
            store.set('/Window/scrollLeft', window.scrollLeft);
            eventEmitter.emit('/Window/scroll', {
              scrollTop: window.scrollTop,
              scrollLeft: window.scrollLeft,
            });
          });
          window.addEventListener('resize', () => {
            store.set('/Window/height', window.innerHeight);
            store.set('/Window/width', window.innerWidth);
            eventEmitter.emit('/Window/resize', {
              height: window.innerHeight,
              width: window.innerWidth,
            });
          });
          store.set('/Window/height', window.innerHeight);
          store.set('/Window/width', window.innerWidth);
          store.set('/Window/scrollTop', window.scrollTop);
          store.set('/Window/scrollLeft', window.scrollLeft);
        }
        else {
          // Server-only init
          store.set('/Window/height', this.params.height);
          store.set('/Window/width', this.params.width);
          store.set('/Window/scrollTop', this.params.scrollTop);
          store.set('/Window/scrollLeft', this.params.scrollLeft);
        }
      }

      getDisplayName(){
          return 'Window';
      }
    }

    _.extend(Window.prototype, /** @lends App.prototype */{
      displayName: "Window",
      storeName: null,
      dispatcherName: null,
      eventEmitterName: null,
      params: null,
    });

    return Window;
  })
};
