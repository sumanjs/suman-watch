'use strict';

// tsc
import {IMapCallback, IMap} from 'suman-types/dts/suman-utils';
import {AsyncFunction} from '@types/async';
import {ISumanTranspileData} from "./start-watching";

//polyfills
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');

//core
import util = require('util');
import assert = require('assert');
import path = require('path');
import cp = require('child_process');
import fs = require('fs');

//npm
import * as async from 'async';
import * as su from 'suman-utils';

//project
import log from './logging';

/////////////////////////////////////////////////////////////////////////////////////////

const cleanStdio = function (stdio: string) {
  return String(stdio).trim().split('\n').map(l => String(l).trim()).filter(i => i).join('\n')
};

//////////////////////////////////////////////////////////////////////////////////////////

export const makeTranspileAll = function (watchOpts: Object, projectRoot: string) {

  return function (transformPaths: Array<ISumanTranspileData>, cb: any) {

    const sumanConfig = require(path.resolve(projectRoot + '/suman.conf.js'));

    const filtered = transformPaths.filter(function (t) {
      return t.bashFilePath;
    });

    async.mapLimit(filtered, 4, function (t: ISumanTranspileData, cb: Function) {

      su.findApplicablePathsGivenTransform(sumanConfig, t.basePath, function (err: Error, results: Array<string>) {

        if (err) {
          return cb(err);
        }

        su.makePathExecutable(t.bashFilePath, function (err: Error) {

          if (err) {
            return cb(err);
          }

          console.log('tttt', util.inspect(t));

          const uniqueResults = results.filter(function (r, i) {
            return results.indexOf(r) === i;
          });

          const k = cp.spawn('bash', [], {
            detached: false,
            cwd: projectRoot || process.cwd(), // t.cwd
            env: Object.assign({}, process.env, {
              SUMAN_TEST_PATHS: JSON.stringify(uniqueResults),
              SUMAN_TRANSFORM_ALL_SOURCES: 'yes'
            })
          });

          fs.createReadStream(t.bashFilePath).pipe(k.stdin);

          let timedout = false;

          const to = setTimeout(function () {
            timedout = true;
            k.kill('SIGINT');
            cb(new Error(`transform all process timed out for the @transform.sh file at path "${t}".`), {
              path: t,
              stdout: cleanStdio(stdout),
              stderr: cleanStdio(stderr)
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
            if (!timedout) {
              cb(null, {
                path: t,
                code: code,
                stdout: cleanStdio(stdout),
                stderr: cleanStdio(stderr)
              });
            }
          });

        });

      });

    }, cb);

  };

};

