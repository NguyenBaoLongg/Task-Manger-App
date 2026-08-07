'use strict';

module.exports = {
  setGlobalHandler() {},
  getGlobalHandler() {
    return undefined;
  },
  reportError() {},
  reportFatalError() {},
  applyWithGuard(fn, context, args) {
    return fn.apply(context, args);
  },
  applyWithGuardIfNeeded(fn, context, args) {
    return fn.apply(context, args);
  },
  inGuard() {
    return false;
  },
};
