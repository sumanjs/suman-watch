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
    log.info('Running standard test script watcher.');
    log.info('When changes are saved to a test script, that test script will be executed.');
    require('./lib/start-watching').run(watchOpts, cb);
  }

};
