'use strict';

//typescript imports
import {ISumanWatchOptions} from "../index";

//polyfills
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');

//core
import * as util from 'util';
import * as assert from 'assert';
import * as path from 'path';
import * as cp from 'child_process';

//npm
import su from 'suman-utils';

//project
import {logInfo, logError, logWarning, logVeryGood, logGood} from './logging';

///////////////////////////////////////////////////////////////////////////////////////////

export const makeTranspile = function (watchOpts: ISumanWatchOptions, projectRoot: string) {

  return function transpile(f: string, transformPath: string, $cb: Function) {

    const cb = su.once(this, $cb);

    const k = cp.spawn(transformPath, [], {
      cwd: projectRoot,
      env: Object.assign({}, process.env, {
        SUMAN_TEST_PATHS: JSON.stringify([f]),
        SUMAN_TRANSFORM_ALL_SOURCES: '' // overwrite just to be sure
      })
    });

    k.once('error', function (e: Error) {
      logError(`transform process experienced spawn error for path "${f}" =>\n${e.stack || e}.`)
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

    const to = setTimeout(function () {
      cb(new Error(`transform process timed out for path "${f}".`), {
        stdout: String(stdout).trim(),
        stderr: String(stderr).trim()
      })
    }, 1000000);

    k.once('exit', function (code: number) {

      clearTimeout(to);

      let err;
      if (code > 0) {
        console.error(' => There was an error transforming your tests.');
        err = new Error(`transform process at path "${f}" exited with non-zero exit code =>\n${stderr}`);
      }

      cb(err, {
        code,
        path: f,
        stdout: String(stdout).trim(),
        stderr: String(stderr).trim()
      });

    });

  };

};
