'use strict';

// typescript imports
import {IMapCallback, IMap} from 'suman-utils';
import {AsyncFunction} from '@types/async';
import {ISumanTranspileData, ISumanWatchOptions} from "../index";

//polyfills
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');

//core
import * as util from 'util';
import * as assert from 'assert';
import * as path from 'path';
import * as cp from 'child_process';
import * as fs from 'fs';

//npm
import * as async from 'async';
import su from 'suman-utils';

//project
import {logInfo, logError, logWarning, logVeryGood, logGood} from './logging';


/////////////////////////////////////////////////////////////////////////////////////////

export const makeTranspileAll = function (watchOpts: ISumanWatchOptions, projectRoot: string) {

  return function (transformPaths: Array<ISumanTranspileData>, cb: AsyncResultArrayCallback<Error, Iterable<any>>) {

    const sumanConfig = require(path.resolve(projectRoot + '/suman.conf.js'));

    async.mapLimit(transformPaths, 5, function (t: ISumanTranspileData, $cb: Function) {

      const cb = su.once(this, $cb);

      su.findApplicablePathsGivenTransform(sumanConfig, t.basePath, function (err: Error, results: Array<string>) {

        if (err) {
          return cb(err);
        }

        // console.log('results => ', results);

        fs.chmod(t.bashFilePath, '777', function (err: Error) {

          if (err) {
            return cb(err);
          }

          const uniqueResults = results.filter(function (r, i) {
            return results.indexOf(r) === i;
          });

          // console.log('uniqueResults => ', uniqueResults);

          const k = cp.spawn('bash', [], {
            cwd: t.cwd,
            env: Object.assign({}, process.env, {
              SUMAN_TEST_PATHS: JSON.stringify(uniqueResults),
              SUMAN_TRANSFORM_ALL_SOURCES: 'yes'
            })
          });

          fs.createReadStream(t.bashFilePath).pipe(k.stdin);

          const to = setTimeout(function () {
            k.kill('SIGINT');
            cb(new Error(`transform all process timed out for the @transform.sh file at path "${t}".`), {
              path: t,
              stdout: String(stdout).trim(),
              stderr: String(stderr).trim()
            });
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

          // k.stdout.pipe(process.stdout);
          // k.stderr.pipe(process.stderr);

          k.once('exit', function (code) {

            clearTimeout(to);

            cb(null, {
              path: t,
              code: code,
              stdout: String(stdout).trim(),
              stderr: String(stderr).trim()
            });
          });

        });

      });

    }, cb);

  };

};

