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
import log from './logging';

/////////////////////////////////////////////////////////////////////////////////////////

export const makeTranspileAll = function (watchOpts: ISumanWatchOptions, projectRoot: string) {

  return function (transformPaths: Array<ISumanTranspileData>, cb: AsyncResultArrayCallback<Iterable<any>, Error>) {

    const sumanConfig = require(path.resolve(projectRoot + '/suman.conf.js'));

    const filtered = transformPaths.filter(function(t){
       return t.bashFilePath;
    });

    async.mapLimit(filtered, 4, function (t: ISumanTranspileData, $cb: Function) {

      const cb = su.once(this, $cb);

      su.findApplicablePathsGivenTransform(sumanConfig, t.basePath, function (err: Error, results: Array<string>) {

        if (err) {
          return cb(err);
        }

        su.makePathExecutable(t.bashFilePath, function (err: Error) {

          if (err) {
            return cb(err);
          }

          const uniqueResults = results.filter(function (r, i) {
            return results.indexOf(r) === i;
          });

          const k = cp.spawn('bash', [], {
            detached: false,
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
              stdout: String(stdout).trim().split('\n').map(l => String(l).trim()).filter(i => i).join('\n'),
              stderr: String(stderr).trim().split('\n').map(l => String(l).trim()).filter(i => i).join('\n')
            });
          }, 1000000);

          k.once('error', function (e) {
            log.error(`spawn error for path => "${t}" =>\n${e.stack || e}`);
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
              stdout: String(stdout).trim().split('\n').map(l => String(l).trim()).filter(i => i).join('\n'),
              stderr: String(stderr).trim().split('\n').map(l => String(l).trim()).filter(i => i).join('\n')
            });
          });

        });

      });

    }, cb);

  };

};

