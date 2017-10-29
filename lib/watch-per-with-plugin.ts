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

    const pluginName = plugin.pluginName || 'unknown-watch-plugin';
    const stdoutStartTranspileRegex = plugin.stdoutStartTranspileRegex;
    const stdoutEndTranspileRegex = plugin.stdoutEndTranspileRegex;
    const pluginEnv = plugin.pluginEnv || {};
    assert(su.isObject(pluginEnv), '"env" property on plugin must be a plain object.');
    const testEnv = watchObj.env || {};
    assert(su.isObject(testEnv), '"env" property on watch object must be a plain object.');
    const execTests = watchObj.exec || plugin.execTests;  // the string representing the suman test command
    const pluginExec = plugin.pluginExec;  // the string representing the watch process command
    assert(su.isStringWithPositiveLn(execTests),
      '"execTests" property on plugin value must be a string with length greater than zero;\n' +
      'if no "execTests" property is used on the pluging, an "exec" property must be defined on the watch per object.');
    assert(su.isStringWithPositiveLn(pluginExec), '"execTransform" property on plugin object value must be a string with length greater than zero.');
    assert(stdoutStartTranspileRegex, '"stdoutStartTranspileRegex" property needs to be defined as a String or RegExp.');
    assert(stdoutEndTranspileRegex, '"stdoutEndTranspileRegex" property needs to be defined as a String or RegExp.');

    let details = {
      exitOk: false
    };

    let createWatcherPluginProcess = function () {
      const k = cp.spawn('bash', [], {
        cwd: plugin.cwd || process.cwd(),
        env: Object.assign({}, process.env, pluginEnv, {
          SUMAN_WATCH_PLUGIN_RUN: 'yes'
        })
      });
      cb && k.once('error', cb);
      k.stdout.pipe(pt(chalk.grey(` [${pluginName}-worker] `))).pipe(process.stdout);
      k.stderr.pipe(pt(chalk.yellow.bold(` [${pluginName}-worker] `), {omitWhitespace: true})).pipe(process.stderr);

      setImmediate(function () {
        k.stdin.end('\n' + pluginExec + '\n');
      });

      k.once('exit', function () {
        if (!details.exitOk) {
          log.warning('watcher process exitted (perhaps unexpectedly), to restart watch process, send "rs" to stdin.');
        }
      });

      return k;
    };

    let watcherPluginProcess = {
      k: createWatcherPluginProcess() as ChildProcess
    };

    let testProcessWorker = {
      k: null as ChildProcess
    };

    let killTestProcess = function () {
      testProcessWorker.k && log.warning('killing currenctly running test(s).');
      testProcessWorker.k && testProcessWorker.k.kill('SIGKILL');
      setTimeout(function () {
        testProcessWorker.k && testProcessWorker.k.kill('SIGKILL');
      }, 3000);
    };

    let startTestProcess = function () {
      let testProcess = testProcessWorker.k = cp.spawn('bash', [], {
        env: Object.assign({}, process.env, testEnv, {
          SUMAN_WATCH_TEST_RUN: 'yes'
        })
      });

      setImmediate(function () {
        testProcess.stdin.write('\n' + execTests + '\n');
        testProcess.stdin.end();
      });

      testProcess.stdout.pipe(pt(chalk.grey(` [suman-watch-test-process] `))).pipe(process.stdout);
      testProcess.stderr.pipe(pt(chalk.yellow.bold(` [suman-watch-test-process] `), {omitWhitespace: true})).pipe(process.stderr);
    };

    process.stdin.on('data', function onData(d: string) {
      if (String(d).trim() === 'rr') {
        log.info('re-running test execution.');
        runNewTestProcess();
      }
      else if (String(d).trim() === 'rs') {
        process.stdin.removeListener('data', onData);
        restartWatcher('user restarted the process with "rs" stdin command.');
      }
      else {
        log.info('stdin command not recognized.');
      }
    });

    let restartPluginWatcherThrottleTimeout: any;
    // we throttle this by 1 second to prevent overdoing things
    let restartPluginWatcherThrottle = function (reason: string) {
      clearTimeout(restartPluginWatcherThrottleTimeout);
      restartPluginWatcherThrottleTimeout = setTimeout(function () {
        restartWatcher(reason);
      }, 1000);
    };

    let restartWatcher = function (reason: string) {
      clearTimeout(restartPluginWatcherThrottleTimeout);
      log.warning('restarting watch-per process' + (reason || '.'));
      watcherPluginProcess.k.kill('SIGKILL');
      setTimeout(function () {
        watcherPluginProcess.k.kill('SIGKILL');
      }, 2000);
      setImmediate(run, null, false, null);
    };

    let runNewTestProcess = function () {
      log.veryGood(chalk.green.bold(`Now running test process using: `) + `'${chalk.black.bold(execTests)}'.`);
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

    watcherPluginProcess.k.stderr.once('data', function (p: string) {
      cb && cb(String(p));
    });

    watcherPluginProcess.k.stdout.on('data', function (p: string) {

      cb && cb(null);

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

    let watcher = chokidar.watch('**/**/*.js',
      {
        cwd: projectRoot,
        persistent: true,
        ignoreInitial: true,
        ignored: /(\.log$|\/.idea\/|\/node_modules\/suman\/)/
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
        // const pluralOrNot = ln === 1 ? 'item' : 'items';
        // log.good(`${ln} ${pluralOrNot} watched in this dir => `, k);
      });

      log.veryGood('total number of files being watched by suman-watch process ', watchCount);
    });

    watcher.on('change', function (p: string) {
      log.good('change event, file path => ', chalk.gray(p));

      if (path.basename(p) === 'suman.conf.js') {
        restartPluginWatcherThrottle('suman.conf.js file changed.');
      }
    });

    watcher.on('add', function (file: string) {
      log.info('file was added: ' + chalk.gray(file));
    });
    watcher.on('unlink', function (file: string) {
      log.info('file was unlinked: ' + chalk.gray(file));
    });

  };

};
