#!/usr/bin/env node
'use strict';

//dts
import {IMap} from "suman-types/dts/suman-utils";
import {ISumanOpts, ISumanConfig} from 'suman-types/dts/global';

//polyfills
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');

//core
import util = require('util');
import assert = require('assert');
import path = require('path');
import fs = require('fs');
import cp = require('child_process');

//npm
import * as async from 'async';
import * as su from 'suman-utils';

import * as chokidar from 'chokidar';
import * as chalk from 'chalk';
import {Pool} from 'poolio';
import pt from 'prepend-transform';

//project
import log from './logging';
import {find, getAlwaysIgnore, isPathMatchesSig} from './utils';
import {makeTranspileAll} from './make-transpile-all';
import {ISumanWatchPerItem} from "../index";

///////////////////////////////////////////////////////////////

export interface ISumanWatchResult {
  code: number,
  stdout: string,
  stderr: string
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
  log.info('suman watch is exiting due to SIGTERM/SIGINT.');
  process.exit(139);
};

process.on('SIGINT', onSIG);
process.on('SIGTERM', onSIG);

//////////////////////////////////////////////////////////////////////////////////////

export const makeRun = function (projectRoot: string, $paths: Array<string>, sumanOpts: ISumanOpts) {

  return function run(sumanConfig: ISumanConfig, isRunNow: boolean, cb?: Function) {

    const testDir = process.env['TEST_DIR'];
    const testSrcDir = process.env['TEST_SRC_DIR'];

    if (!sumanConfig) {
      const p = path.resolve(projectRoot + '/suman.conf.js');
      log.warn(`new suman.conf.js path => ${p}`);
      delete require.cache[p];
      log.warn(`deleted suman.conf.js cache`);
      sumanConfig = require(p);
      log.warn(`re-required suman.conf.js file.`);
    }

    const watchOpts = {
      noRun: sumanOpts.no_run,
      paths: $paths,
      noTranspile: sumanOpts.no_transpile
    };

    async.autoInject({

        getTransformPaths: function (cb: any) {
          if (watchOpts.noTranspile) {
            log.info('watch process will not get all transform paths, because we are not transpiling.');
            return process.nextTick(cb);
          }
          su.findSumanMarkers(['@run.sh', '@transform.sh', '@config.json'], testDir, [], cb);
        },

        getIgnorePathsFromConfigs: function (getTransformPaths: IMap, cb: any) {
          find(getTransformPaths, cb);
        },

        transpileAll: function (getTransformPaths: IMap, cb: any) {

          if (watchOpts.noTranspile) {
            log.info('watch process will not run transpile routine, because we are not transpiling.');
            return process.nextTick(cb);
          }

          const runTranspileAll = makeTranspileAll(watchOpts, projectRoot);

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

          runTranspileAll(paths, cb);

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
              log.error('\nstderr:\n');
              stderr.forEach(function (l) {
                log.warning('stderr:', l);
              });
            }

            log.newLine();
          }
        });

        const moreIgnored = results.getIgnorePathsFromConfigs.filter(function (item: IConfigItem) {
          return item && item.data && item.data['@target'] && item.data['@target']['marker'];
        })
        .map(function (item: IConfigItem) {
          return '^' + path.dirname(item.path) + '/(.*\/)?' + (String(item.data['@target']['marker']).replace(/^\/+/, ''));
        });

        const startScript = path.resolve(__dirname + '/start.js');

        const k = cp.spawn(startScript, [], {
          detached: false,
          cwd: projectRoot,
          stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
          env: Object.assign({}, process.env, {
            SUMAN_TOTAL_IGNORED: JSON.stringify(moreIgnored),
            SUMAN_PROJECT_ROOT: projectRoot,
            SUMAN_WATCH_OPTS: JSON.stringify(watchOpts)
          })
        });

        k.stdout.pipe(pt(chalk.black.bold(' [watch-worker] '))).pipe(process.stdout);
        k.stderr.pipe(pt(chalk.yellow(' [watch-worker] '), {omitWhitespace: true})).pipe(process.stderr);

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
          cb && cb(null, {watched});
        });

        let killAndRestart = function () {
          watcher.close();
          k.kill('SIGINT');
          setImmediate(run, watchOpts);
        };

        let to: NodeJS.Timer;

        let restartProcess = function () {
          log.warning(`we will ${chalk.magenta.bold('refresh')} the watch processed based on this event, in 2 seconds 
            if no other changes occur in the meantime.`);
          clearTimeout(to);
          to = setTimeout(killAndRestart, 2000);
        };

        let onEvent = function (eventName: string) {
          return function (p: string) {
            log.good(chalk.grey(`${eventName} event for path:`), `${chalk.magenta.bold(`"${p}"`)}`);
            const inRequireCache = require.cache[p];
            delete require.cache[p];
            if (inRequireCache) {
              log.warning('the following file was in the require cache => ', p);
              log.warning('therefore we will restart the whole watch process.');
              restartProcess();
            }
            else if (isPathMatchesSig(path.basename(p))) {
              log.warning('the following file was a "signifcant" file => ', p);
              log.warning('therefore we will restart the whole watch process.');
              restartProcess();
            }
          };
        };

        watcher.on('change', onEvent('change'));
        watcher.on('add', onEvent('add'));
        watcher.on('unlink', onEvent('unlink'));

      });

  };

};
