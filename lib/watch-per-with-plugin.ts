'use strict';

//dts
import {ISumanOpts, ISumanConfig} from 'suman-types/dts/global';
import {ChildProcess} from 'child_process';

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
import {log} from './logging';
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

    let plugin;
    assert(su.isObject(watchObj.plugin), 'watch object plugin value is not an object.');

    if (watchObj.plugin.isSumanWatchPluginModule) {
      plugin = watchObj.plugin.value;
    }
    else if (watchObj.plugin.isSumanWatchPluginValue) {
      plugin = watchObj.plugin;
    }
    else {
      throw new Error('watch object "plugin" value does not adhere to the expected interface => ' + util.inspect(watchObj));
    }

    const name = plugin.name || 'unknown-watch-plugin';
    const stdoutStartTranspileRegex = plugin.stdoutStartTranspileRegex;
    const stdoutEndTranspileRegex = plugin.stdoutEndTranspileRegex;

    const exec = watchObj.exec;
    const pluginExec = plugin.exec;
    assert(su.isStringWithPositiveLn(pluginExec), '"exec" property on plugin value must be a string with length greater than zero.');
    assert(su.isStringWithPositiveLn(exec), '"exec" property on watch object value must be a string with length greater than zero.');
    assert(stdoutStartTranspileRegex, '"stdoutStartTranspileRegex" property needs to be defined as a String or RegExp.');
    assert(stdoutEndTranspileRegex, '"stdoutEndTranspileRegex" property needs to be defined as a String or RegExp.');

    let createWatcher = function () {
      const k = cp.spawn('bash', [], {
        env: Object.assign({}, process.env, {
          SUMAN_WATCH_TEST_RUN: 'yes'
        })
      });
      k.stdout.pipe(pt(chalk.grey(` [${name}-worker] `))).pipe(process.stdout);
      k.stderr.pipe(pt(chalk.yellow.bold(` [${name}-worker] `), {omitWhitespace: true})).pipe(process.stderr);
      return k;
    };

    let watcher = {
      k: createWatcher() as ChildProcess
    };

    let testProcessWorker = {
      k: null as ChildProcess
    };

    let killTestProcess = function () {
      testProcessWorker.k && log.warning('killing currenctly running test(s).');
      testProcessWorker.k && testProcessWorker.k.kill('SIGINT');
      setTimeout(function () {
        testProcessWorker.k && testProcessWorker.k.kill('SIGKILL');
      }, 3000);
    };

    let startTestProcess = function () {
      let testProcess = testProcessWorker.k = cp.spawn('bash', [], {});

      setImmediate(function () {
        testProcess.stdin.write('\n' + exec + '\n');
        testProcess.stdin.end();
      });

      testProcess.stdout.pipe(pt(chalk.grey(` [${name}-tests] `))).pipe(process.stdout);
      testProcess.stderr.pipe(pt(chalk.yellow.bold(` [${name}-tests] `), {omitWhitespace: true})).pipe(process.stderr);
    };

    process.stdin.on('data', function onData(d: string) {
      if (String(d).trim() === 'rr') {
        log.info('re-running test execution.');
        runNewTestProcess();
      }
      else if (String(d).trim() === 'rs') {
        log.info('restarting watch-per process.');
        process.stdin.removeListener('data', onData);
        restartWatcher();
      }
      else {
        log.info('stdin command not recognized.');
      }
    });

    let restartWatcher = function () {
      log.warning('restarting watch-per process.');
      watcher.k.kill('SIGINT');
      setTimeout(function () {
        watcher.k.kill('SIGKILL');
      }, 2000);
      setImmediate(run, null, true, null);
    };

    let runNewTestProcess = function () {
      log.good(`now running test process using: '${exec}'.`);
      killTestProcess();
      startTestProcess();
    };

    if (isRunNow) {
      runNewTestProcess();
    }

    let watcherStdio = {
      stdout: '',
      stderr: ''
    };

    watcher.k.stdout.on('data', function (p: string) {

      watcherStdio.stdout += String(p);

      if (stdoutStartTranspileRegex.test(watcherStdio.stdout)) {
        watcherStdio.stdout = ''; // reset stdout
        killTestProcess();
      }

      if (stdoutEndTranspileRegex.test(watcherStdio.stdout)) {
        watcherStdio.stdout = ''; // reset stdout
        runNewTestProcess();
      }

    });

  };

};
