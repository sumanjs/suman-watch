import {ISumanWatchOptions} from "./lib/start-watching";

export interface ISumanWatchPerItem {
  includes: string | Array<string>,
  excludes: string | RegExp | Array<string | RegExp>,
  exec: string,
  confOverride: Partial<Object>
}

import log from './lib/logging';

///////////////////////////////////////////////////////////////////////////////////////////////////

export const run = function (watchOpts: Partial<ISumanWatchOptions>, cb?: Function) {

  if (watchOpts.watchPer) {
    log.warning('running watchPer');
    require('./lib/watch-per').run(watchOpts, cb);
  }
  else {
    log.warning('running regular shit');
    require('./lib/start-watching').run(watchOpts, cb);
  }

};
