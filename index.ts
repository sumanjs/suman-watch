'use strict';

//typescript imports
import {IMapCallback, IMap, INearestRunAndTransformRet} from 'suman-utils';

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
import * as chalk from 'chalk';
import {Pool} from 'poolio';

//project
import {makeTranspile} from './lib/make-transpile';
import {makeExecute} from './lib/make-execute';
import {makeTranspileAll} from './lib/make-transpile-all';

///////////////////////////////////////////////////////////////

export interface ISumanWatchPerItem {

}

export interface ISumanWatchResult {
  code: number,
  stdout: string,
  stderr: string
}

export interface ISumanWatchOptions {
  paths: Array<string>,
  noTranspile?: boolean,
  noRun?: boolean,
  watchPer?: ISumanWatchPerItem
}

export interface ISumanTransformResult {
  stdout: string,
  stderr: string,
  code: number,
  path: string
}

export interface ISumanTranspileData {
  cwd: string,
  basePath: string,
  bashFilePath: string
}

///////////////////////////////////////////////////////////////////////////////////////


//   /___jb_old___/,
//   /___jb_tmp___/,
//   /(\/@target\/|\/node_modules\/|@run.sh$|@transform.sh$|.*\.log$|.*\.json$|\/logs\/)/


const alwaysIgnore = [
  '___jb_old___',
  '___jb_tmp___',
  '/node_modules/',
  '/.git/',
  '.*\.log$',
  '.*\.json$',
  '/logs/'
];


//////////////////////////////////////////////////////////////////////////////////////

export const startWatching = function (watchOpts: ISumanWatchOptions, cb: Function): void {

  const onSIG = function () {
    logInfo('suman watch is exiting.');
    process.exit(139);
  };

  process.on('SIGINT', onSIG);
  process.on('SIGTERM', onSIG);

  const projectRoot = su.findProjectRoot(process.cwd());
  const testDir = process.env['TEST_DIR'];
  const testSrcDir = process.env['TEST_SRC_DIR'];
  const transpile = makeTranspile(watchOpts, projectRoot);
  const transpileAll = makeTranspileAll(watchOpts, projectRoot);
  const execute = makeExecute(watchOpts, projectRoot);

  async.autoInject({

      getTransformPaths: function (cb: AsyncResultArrayCallback<Error, Iterable<any>>) {
        if (watchOpts.noTranspile) {
          logInfo('watch process will not get all transform paths, because we are not transpiling.');
          return process.nextTick(cb);
        }
        su.findSumanMarkers(['@run.sh', '@transform.sh', '@config.json'], testDir, [], cb);
      },

      transpileAll: function (getTransformPaths: IMap, cb: AsyncResultArrayCallback<Error, Iterable<any>>) {

        if (watchOpts.noTranspile) {
          logInfo('watch process will not run transpile-all routine, because we are not transpiling.');
          return process.nextTick(cb);
        }

        const paths = Object.keys(getTransformPaths).map(function (key) {

            if (getTransformPaths[key]['@transform.sh']) {
              return {
                cwd: getTransformPaths[key],
                basePath: path.resolve(key + '/@transform.sh'),
                bashFilePath: path.resolve(key + '/@transform.sh')
              };
            }

            if (getTransformPaths[key]['@config.json']) {
              try {
                const config = require(path.resolve(key + '/@config.json'));
                const plugin = config['@transform']['plugin']['value'];
                return {
                  cwd: getTransformPaths[key],
                  basePath: path.resolve(key + '/@config.json'),
                  bashFilePath: require(plugin).getTransformPath()
                };
              }
              catch (err) {
                logError(err.stack || err);
              }
            }
          })
          .filter(i => i);

        transpileAll(paths, cb);

      }
    },

    function (err, results) {

      if (err) {
        throw err;
      }

      logGood('\nTranspilation results:\n');

      results.transpileAll.forEach(function (t: ISumanTransformResult) {
        if (t.code > 0) {
          logError('transform result error => ', util.inspect(t));
        }
        else {
          logGood(`transform result for => ${chalk.magenta(t.path.basePath)}`);

          const stdout = String(t.stdout).split('\n').filter(i => i);

          if (stdout.length > 0) {
            console.log('\n');
            console.log('stdout:\n');
            stdout.forEach(function (l) {
              logGood('stdout:', l);
              console.log('\n');
            });
          }

          const stderr = String(t.stderr).split('\n').filter(i => i);

          if (stderr.length > 0) {
            console.log('\n');

            console.error('stderr:\n');

            stderr.forEach(function (l) {
              logWarning('stderr:', l);
            });
            console.log('\n');
          }

        }
      });

      let watcher = chokidar.watch(testSrcDir, {
        cwd: projectRoot,
        persistent: true,
        ignoreInitial: true,
        ignored: [
          /___jb_old___/,
          /___jb_tmp___/,
          /(\/@target\/|\/node_modules\/|@run.sh$|@transform.sh$|.*\.log$|.*\.json$|\/logs\/)/
        ]
      });

      watcher.on('error', function (e: Error) {
        logError('watcher experienced an error', e.stack || e);
      });

      watcher.once('ready', function () {
        logVeryGood('watcher is ready.');

        let watchCount = 0;
        let watched = watcher.getWatched();

        Object.keys(watched).forEach(function (k) {
          watchCount += watched[k].length;
        });

        logVeryGood('number of files being watched by suman-watch => ', watchCount);
        cb && cb(null, {
          watched
        });
      });

      watcher.on('change', function (f: string) {

        logInfo('file change event for path => ', f);

        su.findNearestRunAndTransform(projectRoot, f, function (err: Error, ret: INearestRunAndTransformRet) {

          if (err) {
            logError(`error locating @run.sh / @transform.sh for file ${f}.\n${err}`);
            return;
          }

          transpile(f, ret, function (err: Error) {

            if (err) {
              logError(`error running transpile process for file ${f}.\n${err}`);
              return;
            }

            execute(f, ret, function (err: Error, result: ISumanWatchResult) {

              if (err) {
                logError(`error executing corresponding test process for source file ${f}.\n${err.stack || err}`);
                return;
              }

              const {stdout, stderr, code} = result;

              console.log('\n');
              console.error('\n');

              logInfo(`your corresponding test process for path ${f}, exited with code ${code}`);

              if (code > 0) {
                logError(`there was an error executing your test with path ${f}, because the exit code was greater than 0.`);
              }

              if (stderr) {
                logWarning(`the stderr for path ${f}, is as follows =>\n${chalk.yellow(stderr)}.`);
                console.error('\n');
              }

              if (stdout) {
                logInfo(`the stdout for path ${f}, is as follows =>\n${stdout}.`);
                console.log('\n');
              }

            });
          });

        });
      });

    });

};
