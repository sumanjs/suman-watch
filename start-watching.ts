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
import log from './lib/logging';
import * as async from 'async';
import su from 'suman-utils';

import * as chokidar from 'chokidar';
import * as chalk from 'chalk';
import {Pool} from 'poolio';
import pt from 'prepend-transform';

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
  log.info('suman watch is exiting.');
  process.exit(139);
};

process.on('SIGINT', onSIG);
process.on('SIGTERM', onSIG);

//////////////////////////////////////////////////////////////////////////////////////

export const run = function (watchOpts: ISumanWatchOptions, cb?: Function): void {

  const projectRoot = su.findProjectRoot(process.cwd());
  const testDir = process.env['TEST_DIR'];
  const testSrcDir = process.env['TEST_SRC_DIR'];
  const transpileAll = makeTranspileAll(watchOpts, projectRoot);

  // we should re-load suman config, in case it has changed, etc.
  const p = path.resolve(projectRoot + '/suman.conf.js');
  delete require.cache[p];
  const sumanConfig = require(p);

  async.autoInject({

      getTransformPaths: function (cb: AsyncResultArrayCallback<Error, Iterable<any>>) {
        if (watchOpts.noTranspile) {
          log.info('watch process will not get all transform paths, because we are not transpiling.');
          return process.nextTick(cb);
        }
        su.findSumanMarkers(['@run.sh', '@transform.sh', '@config.json'], testDir, [], cb);
      },

      getIgnorePathsFromConfigs: function (getTransformPaths: IMap, cb: AsyncResultArrayCallback<Error, Iterable<any>>) {
        find(getTransformPaths, cb);
      },

      transpileAll: function (getTransformPaths: IMap, cb: AsyncResultArrayCallback<Error, Iterable<any>>) {

        if (watchOpts.noTranspile) {
          log.info('watch process will not run transpile-all routine, because we are not transpiling.');
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
                log.warning(err.message || err);
                return {
                  cwd: getTransformPaths[key],
                  basePath: path.resolve(key + '/@config.json'),
                  bashFilePath: null
                };
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

      console.log('\n');

      log.good('Transpilation results:\n');

      results.transpileAll.forEach(function (t: ISumanTransformResult) {

        if (t.code > 0) {
          log.error('transform result error => ', util.inspect(t));
        }
        else {
          log.good(`transform result for => ${chalk.magenta(t.path.basePath)}`);

          const stdout = String(t.stdout).split('\n').filter(i => i);

          if (stdout.length > 0) {
            console.log('\n');
            console.log('stdout:\n');
            stdout.forEach(function (l) {
              log.good('stdout:', l);
            });
          }

          const stderr = String(t.stderr).split('\n').filter(i => i);

          if (stderr.length > 0) {
            console.error('\nstderr:\n');
            stderr.forEach(function (l) {
              log.warning('stderr:', l);
            });
          }

          log.newLine();
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
        detached: false,
        cwd: projectRoot,
        env: Object.assign({}, process.env, {
          SUMAN_TOTAL_IGNORED: JSON.stringify(moreIgnored),
          SUMAN_PROJECT_ROOT: projectRoot,
          SUMAN_WATCH_OPTS: JSON.stringify(watchOpts)
        }),
        stdio: ['pipe','pipe','pipe','ipc']
      });

      k.stdout.pipe(pt(chalk.black.bold(' [watch-worker] '))).pipe(process.stdout);
      k.stderr.pipe(pt(chalk.yellow(' [watch-worker] '))).pipe(process.stderr);

      let watcher = chokidar.watch(testDir, {
        // cwd: projectRoot,
        persistent: true,
        ignoreInitial: true,
        ignored: alwaysIgnore.concat(moreIgnored).map(v => new RegExp(v))
      });

      watcher.on('error', function (e: Error) {
        log.error('watcher experienced an error', e.stack || e);
      });

      watcher.once('ready', function () {
        log.veryGood('watcher is ready.');

        let watchCount = 0;
        let watched = watcher.getWatched();

        Object.keys(watched).forEach(function (k) {
          watchCount += watched[k].length;
        });

        log.veryGood('number of files being watched by suman-watch => ', watchCount);
        cb && cb(null, {
          watched
        });
      });

      let killAndRestart = function () {
        watcher.close();
        k.kill('SIGINT');
        setImmediate(function () {
          run(watchOpts);
        });
      };

      let to: NodeJS.Timer;

      let onEvent = function (eventName: string) {
        return function (p: string) {
          log.info(eventName, 'event :', p);
          const inRequireCache = require.cache[p];
          delete require.cache[p];
          log.warning('the following file was in the require cache => ', p);
          log.warning('therefore we will restart the whole watch process.');
          if (inRequireCache || isPathMatchesSig(path.basename(p))) {
            log.warning(`we will ${chalk.magenta.bold('refresh')} the watch processed based on this event, in 5 seconds 
            if no other changes occur in the meantime.`);
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
