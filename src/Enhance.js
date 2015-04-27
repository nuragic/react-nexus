import { Lifespan } from 'nexus-flux';
import React from 'react';

function checkBindings(bindings) {
  if(__DEV__) {
    bindings.should.be.an.Object;
    _.each(bindings, ([flux, path, defaultValue]) => {
      flux.should.be.a.String;
      path.should.be.a.String;
      void defaultValue;
    });
  }
}

const [PREFETCH, INJECT, PENDING, LIVE] = _.range(4);

export default (Nexus) => (Component, getNexusBindings) => class NexusElement extends React.Component {
  constructor(props) {
    if(__DEV__) {
      getNexusBindings.should.be.a.Function;
    }
    super(props);
    this._nexusBindings = {};
    this._nexusBindingsLifespans = {};
    const bindings = getNexusBindings(props);
    checkBindings(bindings);
    this.state = _.mapValues(bindings, ([flux, path, defaultValue]) => {
      if(this.getFlux(flux).isPrefetching) {
        return [PREFETCH, this.getFlux(flux).prefetch(path)];
      }
      if(this.getFlux(flux).isInjecting) {
        return [INJECT, this.getFlux(flux).inject(path)];
      }
      return [PENDING, defaultValue];
    });
  }

  getNexus() {
    if(__DEV__) {
      (Nexus.currentNexus !== null).should.be.ok;
    }
    return Nexus.currentNexus;
  }

  getFlux(flux) {
    if(__DEV__) {
      this.getNexus().should.have.property(flux);
    }
    return this.getNexus()[flux];
  }

  getCurrentValue(key) {
    if(__DEV__) {
      key.should.be.a.String;
      this.state.should.have.property(key);
    }
    const [STATUS, value] = this.state;
    // in this case only, the value is wrapped
    if(STATUS === PREFETCH) {
      if(__DEV__) {
        value.should.have.property('isPending').which.is.a.Function;
        value.isPending().should.be.false;
      }
      return value.value();
    }
    // in all other cases (INJECT, PENDING, LIVE) then the value is unwrapped
    return value;
  }

  waitForPrefetching() {
    return Promise.all(_.map(this.state, ([STATUS, value]) =>
      STATUS === PREFETCH ? value : Promise.resolve()
    ).then(() => this);
  }

  applyNexusBindings(props) {
    const prevBindings = this._nexusBindings || {};
    const prevLifespans = this._nexusBindingsLifespans || {};
    const nextLifespans = {};
    const nextBindings = getNexusBindings(props);

    _.each(_.union(_.keys(prevBindings), _.keys(nextBindings)), (stateKey) => {
      const prev = prevBindings[stateKey];
      const next = nextBindings[stateKey];
      const addNextBinding = () => {
        const [flux, path, defaultValue] = next;
        const lifespan = nextLifespans[stateKey] = new Lifespan();
        this.getFlux(flux).getStore(path, lifespan)
        .onUpdate(({ head }) => this.setState({ [stateKey]: [LIVE, head] }))
        .onDelete(() => this.setState({ [stateKey]: void 0 }))
        this.setState({ [stateKey]: [PENDING, defaultValue] });
      };
      const removePrevBinding = () => {
        this.setState({ [stateKey]: void 0 });
        prevLifespans[stateKey].release();
      };
      if(prev === void 0) { // binding is added
        addNextBinding();
        return;
      }
      if(next === void 0) { // binding is removed
        removePrevBinding();
        return;
      }
      const [prevFlux, prevPath] = prev;
      const [nextFlux, nextPath] = next;
      if(prevFlux !== nextFlux || prevPath !== nextPath) { // binding is modified
        removePrevBinding();
        addNextBinding();
      }
      else {
        nextLifespans[stateKey] = this._nexusBindingsLifespans[stateKey];
      }
    });

    this._nexusBindings = nextBindings;
    this._nexusBindingsLifespans = nextLifespans;
  }

  componentDidMount() {
    this.applyNexusBindings(this.props);
  }

  componentWillUnmount() {
    _.each(this._nexusBindingsLifespans || [], (lifespan) => lifespan.release());
  }

  componentWillReceiveProps(nextProps) {
    this.applyNexusBindings(nextProps);
  }

  shouldComponentUpdate(nextProps, nextState) {
    return !_.isEqual(nextProps, nextState);
  }

  render() {
    const props = Object.assign({}, this.props, this.state);
    return <Component {...props} />;
  }
};
