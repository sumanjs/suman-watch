'use strict';

// typescript imports
import {IMapCallback, IMap} from 'suman-utils';

//polyfills
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');

//core
import * as util from 'util';
import * as assert from 'assert';
import * as path from 'path';
import * as EE from 'events';
import * as fs from 'fs';
import * as stream from 'stream';

//npm
import {logInfo, logError, logWarning, logVeryGood, logGood} from './lib/logging';
import * as async from 'async';
import su from 'suman-utils';
import * as chokidar from 'chokidar';

//project
import {makeTranspile} from './lib/make-transpile';
import {makeExecute} from './lib/make-execute';
import {makeTranspileAll} from './lib/make-transpile-all';

////////////////////////////////////////////////////////

export interface ISumanWatchPerItem {

}

export interface ISumanWatchResult {
  code: number,
  stdout: string,
  stderr: string
}

export interface ISumanWatchOptions {
  noTranspile?: boolean,
  noRun?: boolean,
  watchPer?: ISumanWatchPerItem

}

///////////////////////////////////////////////////////////////////////////////////////

export const startWatching = function (watchOpts: ISumanWatchOptions, cb: Function): void {

  const onSIG = function () {
    console.log(' => [suman-watch] suman watch is exiting.');
    process.exit(139);
  };

  process.on('SIGINT', onSIG);
  process.on('SIGTERM', onSIG);

  const projectRoot = su.findProjectRoot(process.cwd());
  const testSrcDir = process.env['TEST_SRC_DIR'];
  const transpile = makeTranspile(watchOpts, projectRoot);
  const transpileAll = makeTranspileAll(watchOpts, projectRoot);
  const execute = makeExecute(watchOpts, projectRoot);


  async.autoInject({

      getTransformPaths: function (cb: Function) {
        if (watchOpts.noTranspile) {
          logInfo('watch process will not get all transform paths, because we are not transpiling.');
          return process.nextTick(cb);

        }
        su.findSumanMarkers(['@run.sh', '@transform.sh'], testSrcDir, [], cb);
      },

      transpileAll: function (getTransformPaths: IMap, cb: Function) {

        if (watchOpts.noTranspile) {
          logInfo('watch process will not run transpile-all routine, because we are not transpiling.');
          return process.nextTick(cb);
        }

        const paths = Object.keys(getTransformPaths).filter(function (key) {
            return getTransformPaths[key]['@transform.sh']; // returns true or undefined
          })
          .map(function (k) {
            return path.resolve(k + '/@transform.sh');
          });

        console.log('paths => ', util.inspect(paths));

        transpileAll(paths, cb);

      }
    },

    function (err, results) {

      if (err) {
        throw err;
      }

      console.log(' => Transpilation results:');
      results.transpileAll.forEach(function (t: string) {
        console.log(t);
      });

      let watcher = chokidar.watch(testSrcDir, {
        ignored: /(\/@target\/|\/node_modules\/)/,
        persistent: true,
        ignoreInitial: true
      });

      watcher.on('error', function (e: Error) {
        logError('watcher experienced an error', e.stack || e);
      });

      watcher.once('ready', function () {
        logVeryGood('watcher is ready.');
        console.log('watched paths => ', util.inspect(watcher.getWatched()));
        cb && cb(null, {
          watched: watcher.getWatched()
        });
      });

      watcher.on('change', function (f: string) {

        logInfo('file change event for path => ', f);

        su.findNearestRunAndTransform(projectRoot, f, function (err: Error, ret) {

          if (err) {
            logError(`error locating @run.sh / @transform.sh for file ${f}.\n${err}`);
            return;
          }

          transpile(f, ret.transform, function (err: Error) {

            if (err) {
              logError(`error running transpile process for file ${f}.\n${err}`);
              return;
            }

            execute(f, ret.run, function (err: Error, result: ISumanWatchResult) {

              if (err) {
                logError(`error executing corresponding test process for source file ${f}.\n${err.stack || err}`);
                return;
              }

              const {stdout, stderr, code} = result;

              logInfo(`you corresponding test process for path ${f}, exited with code ${code}`);

              if (code > 0) {
                logError(`there was an error executing your test with path ${f}, because the exit code was greater than 0.`);
              }

              if (stderr) {
                logWarning(`the stderr for path ${f}, is as follows =>\n${stderr}.`);
              }

              if (stdout) {
                logInfo(`the stderr for path ${f}, is as follows =>\n${stdout}.`);
              }

            });
          });

        });
      });

    });

};
