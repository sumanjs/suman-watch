'use strict';

//dts
import {ISumanOpts, ISumanConfig} from 'suman-types/dts/global';

//core
import assert = require('assert');

//project
import utils from './lib/utils';
import {log} from './lib/logging';

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

  let makeRun;

  if (sumanOpts.watch_per) {
    let {watchObj} = utils.getWatchObj(projectRoot, sumanOpts, sumanConfig);
    if (watchObj.plugin) {
      log.info('running "watch-per" * using suman-watch plugin *.');
      makeRun = require('./lib/watch-per-with-plugin').makeRun;
    }
    else {
      log.info('running "watch-per".');
      makeRun = require('./lib/watch-per').makeRun;
    }
  }
  else {
    log.info('Running standard test script watcher.');
    log.info('When changes are saved to a test script, that test script will be executed.');
    makeRun = require('./lib/start-watching').makeRun;
  }

  assert(typeof makeRun === 'function',
    'Suman implementation error - the desired suman-watch module does not export the expected interface.');

  process.stdin.setEncoding('utf8').resume();
  const run = makeRun(projectRoot, paths, sumanOpts);
  run(sumanConfig, false, cb);

};

export const plugins = require('suman-watch-plugins');
