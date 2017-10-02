'use strict';

//dts
import {ISumanOpts, ISumanConfig} from 'suman-types/dts/global';
import log from './lib/logging';

//////////////////////////////////////////////////////////////////////////////////////////////////

export interface ISumanWatchPerItem {
  includes: string | Array<string>,
  excludes: string | RegExp | Array<string | RegExp>,
  include: string | Array<string>,
  exclude: string | RegExp | Array<string | RegExp>,
  exec: string,
  confOverride: Partial<ISumanConfig>
}

///////////////////////////////////////////////////////////////////////////////////////////////////

export const runWatch = function (projectRoot: string, paths: Array<string>,
                                  sumanConfig: ISumanConfig, sumanOpts: ISumanOpts, cb: Function) {

  const {makeRun} = sumanOpts.watch_per ? require('./lib/watch-per') : require('./lib/start-watching');

  {
    if (sumanOpts.watch_per) {
      log.info('running watch-per');
    }
    else {
      log.info('Running standard test script watcher.');
      log.info('When changes are saved to a test script, that test script will be executed.');
    }

  }

  const run = makeRun(projectRoot, paths, sumanOpts);
  run(sumanConfig, false, cb);

};
