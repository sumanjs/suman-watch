#!/usr/bin/env node
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
import * as cp from 'child_process';

//npm
import {logInfo, logError, logWarning, logVeryGood, logGood} from './lib/logging';
import * as async from 'async';
import su from 'suman-utils';
import * as chokidar from 'chokidar';
import * as chalk from 'chalk';
import {Pool} from 'poolio';

//project
import {find, getAlwaysIgnore, isPathMatchesSig} from './lib/utils';
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

interface ISrcConfigProp {
  marker: string
}

interface ITargetConfigProp {
  marker: string
}

interface IatConfigFile {
  '@run': Object,
  '@transform': Object,
  '@src': ISrcConfigProp,
  '@target': ITargetConfigProp
}

interface IConfigItem {
  path: string,
  data: IatConfigFile
}

///////////////////////////////////////////////////////////////////////////////////////

const alwaysIgnore = getAlwaysIgnore();

const onSIG = function () {
  logInfo('suman watch is exiting.');
  process.exit(139);
};

process.on('SIGINT', onSIG);
process.on('SIGTERM', onSIG);

//////////////////////////////////////////////////////////////////////////////////////

export const startWatching = function (watchOpts: ISumanWatchOptions, cb?: Function): void {

  const projectRoot = su.findProjectRoot(process.cwd());
  const testDir = process.env['TEST_DIR'];
  const testSrcDir = process.env['TEST_SRC_DIR'];
  const transpileAll = makeTranspileAll(watchOpts, projectRoot);

  async.autoInject({

      getTransformPaths: function (cb: AsyncResultArrayCallback<Error, Iterable<any>>) {
        if (watchOpts.noTranspile) {
          logInfo('watch process will not get all transform paths, because we are not transpiling.');
          return process.nextTick(cb);
        }
        su.findSumanMarkers(['@run.sh', '@transform.sh', '@config.json'], testDir, [], cb);
      },

      getIgnorePathsFromConfigs: function (getTransformPaths: IMap, cb: AsyncResultArrayCallback<Error, Iterable<any>>) {
        find(getTransformPaths, cb);
      },

      transpileAll: function (getTransformPaths: IMap, cb: AsyncResultArrayCallback<Error, Iterable<any>>) {

        console.log(util.inspect(getTransformPaths));

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
            console.error('\nstderr:\n');
            stderr.forEach(function (l) {
              logWarning('stderr:', l);
            });
            console.log('\n');
          }

        }
      });

      const moreIgnored = results.getIgnorePathsFromConfigs.filter(function (item: IConfigItem) {
          return item.data && item.data['@target'] && item.data['@target']['marker'];
        })
        .map(function (item: IConfigItem) {
          return '^' + path.dirname(item.path) + '/(.*\/)?' + (String(item.data['@target']['marker']).replace(/^\/+/, ''));
        });

      const startScript = path.resolve(__dirname + '/start.js');

      const k = cp.spawn(startScript, [], {
        cwd: projectRoot,
        env: Object.assign({}, process.env, {
          SUMAN_TOTAL_IGNORED: JSON.stringify(moreIgnored),
          SUMAN_PROJECT_ROOT: projectRoot,
          SUMAN_WATCH_OPTS: JSON.stringify(watchOpts)
        }),
        stdio: ['pipe','pipe','pipe','ipc']
      });

      k.stdout.pipe(process.stdout);
      k.stderr.pipe(process.stderr);

      let watcher = chokidar.watch(testDir, {
        // cwd: projectRoot,
        persistent: true,
        ignoreInitial: true,
        ignored: alwaysIgnore.concat(moreIgnored).map(v => new RegExp(v))
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

      let killAndRestart = function () {
        watcher.close();
        k.kill('SIGINT');
        setImmediate(function () {
          startWatching(watchOpts);
        });
      };

      let to: NodeJS.Timer;

      let onEvent = function (eventName: string) {
        return function (p: string) {
          logInfo(eventName, 'event :', p);
          if (isPathMatchesSig(path.basename(p))) {
            logWarning('we will refresh the watch processed based on this event, in 5 seconds, ' +
              'if no other changes occur in the meantime.');
            clearTimeout(to);
            to = setTimeout(killAndRestart, 8000);
          }
        };
      };

      watcher.on('change', onEvent('change'));
      watcher.on('add', onEvent('add'));
      watcher.on('unlink', onEvent('unlink'));

    });

};
