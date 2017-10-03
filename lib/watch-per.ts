'use strict';

//dts
import {ISumanOpts, ISumanConfig} from 'suman-types/dts/global';

//polyfills
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');

//core
import util = require('util');
import assert = require('assert');
import path = require('path');
import  EE = require('events');
import fs = require('fs');
import stream = require('stream');
import cp = require('child_process');

//npm
import * as _ from 'lodash';
import log from './logging';
import * as su from 'suman-utils';
import * as chokidar from 'chokidar';
import * as chalk from 'chalk';
import {Pool} from 'poolio';
import pt from 'prepend-transform';

//project
import utils from './utils';
const alwaysIgnore = utils.getAlwaysIgnore();

///////////////////////////////////////////////////////////////////////////////

export const makeRun = function (projectRoot: string, paths: Array<string>, sumanOpts: ISumanOpts) {

  return function run($sumanConfig: ISumanConfig, isRunNow: boolean, cb?: Function) {

    // uggh.. here we reload suman.conf.js if the watcher is restarted
    let {watchObj, sumanConfig} = utils.getWatchObj(projectRoot, sumanOpts, $sumanConfig);

    const includesErr = '"{suman.conf.js}.watch.per" entries must have an "includes/include" property ' +
      'which is a string or array of strings.';

    assert(
      Array.isArray(watchObj.include) ||
      su.isStringWithPositiveLn(watchObj.include) ||
      Array.isArray(watchObj.includes) ||
      su.isStringWithPositiveLn(watchObj.includes),
      includesErr);

    const excludesErr =
      '"{suman.conf.js}.watch.per" entries may have an "excludes/exclude" property but that property must ' +
      'be a string or an array of strings..';

    if (watchObj.excludes || watchObj.exclude) {
      assert(
        Array.isArray(watchObj.exclude) ||
        su.isStringWithPositiveLn(watchObj.exclude) ||
        Array.isArray(watchObj.excludes) ||
        su.isStringWithPositiveLn(watchObj.excludes),
        excludesErr);
    }

    const _includes = [watchObj.includes].concat(watchObj.include);
    const includes = _.flattenDeep(_includes).filter((i: string) => i);

    {
      // use block scope just for nice formatting indentation lol
      includes.forEach(function (v: string) {
        if (typeof v !== 'string' && !(v instanceof RegExp)) {
          throw includesErr;
        }
      });
    }

    const _excludes = [watchObj.excludes].concat(watchObj.exclude);
    const excludes = _.flattenDeep(_excludes).filter((i: string) => i);

    {
      // use block scope just for nice formatting indentation lol
      excludes.forEach(function (v: string | RegExp) {
        if (typeof v !== 'string' && !(v instanceof RegExp)) {
          throw excludesErr;
        }
      });
    }

    assert(su.isStringWithPositiveLn(watchObj.exec),
      '"exec" property on {suman.conf.js}.watch.per must be a string with length greater than zero.');

    const ignored = alwaysIgnore.concat(excludes)
    .map((v: string | RegExp) => v instanceof RegExp ? v : new RegExp(v));

    const exec = watchObj.exec;

    let watcher = chokidar.watch(includes, {
      // cwd: projectRoot,
      persistent: true,
      ignoreInitial: true,
      ignored,
    });

    watcher.on('error', function (e: Error) {
      log.error('suman-watch watcher experienced an error', e.stack || e);
    });

    watcher.once('ready', function () {
      log.veryGood('watcher is ready.');
      let watchCount = 0;
      let watched = watcher.getWatched();

      Object.keys(watched).forEach(function (k) {
        let ln = watched[k].length;
        watchCount += ln;
        const pluralOrNot = ln === 1 ? 'item' : 'items';
        log.good(`${ln} ${pluralOrNot} watched in this dir => `, k);
      });

      log.veryGood('total number of files being watched by suman-watch => ', watchCount);
      cb && cb(null, {watched});
    });

    let createWorker = function () {
      const k = cp.spawn('bash', [], {
         env: Object.assign({}, process.env, {
           SUMAN_WATCH_TEST_RUN: 'yes'
         })
      });
      k.stdout.pipe(pt(chalk.grey(' [watch-worker] '))).pipe(process.stdout);
      k.stderr.pipe(pt(chalk.yellow.bold(' [watch-worker] '), {omitWhitespace: true})).pipe(process.stderr);
      return k;
    };

    let running = {
      k: createWorker()
    };

    let startWorker = function () {
      return running.k = createWorker()
    };

    process.stdin.on('data', function onData(d: string){
      if(String(d).trim() === 'rr'){
        log.info('re-running test execution.');
        startWorker();
        executeExecString();
      }
      else if(String(d).trim() === 'rs'){
        log.info('restarting watch-per process.');
        process.stdin.removeListener('data', onData);
        restartWatcher();
      }
      else{
        log.info('stdin command not recognized.');
      }
    });

    let restartWatcher = function () {
      log.warn('restarting watch-per process.');
      watcher.close();
      watcher.removeAllListeners(); // just in case...
      setImmediate(run, null, true, null);
    };

    let executeExecString = function () {
      log.good(`now running '${exec}'.`);
      running.k.stdin.write('\n' + exec + '\n');
      running.k.stdin.end();
    };



    if (isRunNow) {
      executeExecString();
    }

    let first = true;

    watcher.on('change', function (p: string) {
      log.good('change event, file path => ', p);

      if (first) {
        first = false;
      }
      else {
        running.k.kill('SIGKILL');
      }

      if (path.basename(p) === 'suman.conf.js') {
        restartWatcher();
      }
      else {
        startWorker();
        executeExecString();
      }

    });

    let addOrUnlinkTo: any;
    // we throttle this by 1 second to prevent overdoing things
    let onAddOrUnlink = function (p: string) {
      clearTimeout(addOrUnlinkTo);
      addOrUnlinkTo = setTimeout(restartWatcher, 1000);
    };

    watcher.on('add', onAddOrUnlink);
    watcher.on('unlink', onAddOrUnlink);

  };

};
