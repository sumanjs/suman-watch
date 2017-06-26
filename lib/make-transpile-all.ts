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

export const makeTranspileAll = function(watchOpts: ISumanWatchOptions, projectRoot: string){

  return function (transformPaths: Array<string>, cb: Function) {

    async.mapLimit(transformPaths, 5, function (t: string, $cb: Function) {

      const cb = su.once(this, $cb);

      const k = cp.spawn(t, [], {
        cwd: projectRoot,
        env: Object.assign({}, process.env, {
          SUMAN_TEST_PATHS: '',  //  we should overwrite this var, just to be sure
          SUMAN_TRANSFORM_ALL_SOURCES: 'yes'
        })
      });

      const to = setTimeout(function () {
        cb(new Error(`transform all process timed out for the @transform.sh file at path "${t}".`), {
          stdout: String(stdout).trim(),
          stderr: String(stderr).trim()
        })
      }, 1000000);

      k.once('error', function (e) {
        logError(`spawn error for path => "${t}" =>\n${e.stack || e}`);
      });

      let stdout = '';
      k.stdout.setEncoding('utf8');
      k.stdout.on('data', function (d: string) {
        stdout += d;
      });

      let stderr = '';
      k.stderr.setEncoding('utf8');
      k.stderr.on('data', function (d: string) {
        stderr += d;
      });

      k.once('exit', function (code) {

        clearTimeout(to);

        cb(null, {
          path: t,
          code: code,
          stdout: String(stdout).trim(),
          stderr: String(stderr).trim()
        });
      });

    }, cb);

  };

};

