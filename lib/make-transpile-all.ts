'use strict';

// typescript imports
import {IMapCallback, IMap} from 'suman-utils';
import {AsyncFunction} from '@types/async';

//polyfills
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');

//core
import * as util from 'util';
import * as assert from 'assert';
import * as path from 'path';
import * as cp from 'child_process';

//npm
import * as async from 'async';
import su from 'suman-utils';

//project
import {logInfo, logError, logWarning, logVeryGood, logGood} from './logging';
import {ISumanWatchOptions} from "../index";

/////////////////////////////////////////////////////////////////////////////////////////

export const makeTranspileAll = function(watchOpts: ISumanWatchOptions){

  return function (root: string, transformPaths: Array<string>, cb) {

    async.mapLimit(transformPaths, 5, function (t, cb) {

      logInfo(' => About to spawn => ', t);

      const k = cp.spawn(t, [], {
        cwd: root,
        env: Object.assign({}, process.env, {
          SUMAN_CHILD_TEST_PATH: '',
        })
      });

      k.once('error', function (e) {
        logError(`spawn error for path => "${t}" =>\n${e.stack || e}`);
      });

      k.once('exit', function (code) {
        cb(null, {
          path: t,
          code: code
        });
      });

    }, cb);

  };

};

