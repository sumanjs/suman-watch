'use strict';

//dts
import {ISumanOpts, ISumanConfig} from 'suman-types/dts/global';
import {ChildProcess} from 'child_process';
import {ISumanWatchPlugin} from 'suman-watch-plugins';

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

let totallyKillProcess = function (proc: ChildProcess, timeout?: number) {
  proc.kill('SIGINT');
  proc.unref();
  proc.removeAllListeners();
  proc.stdout && proc.stdout.removeAllListeners();
  proc.stderr && proc.stderr.removeAllListeners();
  proc.stdin && proc.stdin.removeAllListeners();
  setTimeout(function () {
    proc.kill('SIGKILL');
  }, timeout || 3000);
};

export const makeRun = function (projectRoot: string, paths: Array<string>, sumanOpts: ISumanOpts) {

  return function run($sumanConfig: ISumanConfig, isRunNow: boolean, cb?: Function) {

    // uggh.. here we reload suman.conf.js if the watcher is restarted
    let {watchObj, sumanConfig} = utils.getWatchObj(projectRoot, sumanOpts, $sumanConfig);

    let plugin: ISumanWatchPlugin;
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
        cwd: plugin.pluginCwd || process.cwd(),
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
      if (testProcessWorker.k) {
        log.warning('killing currently running test(s).');
        totallyKillProcess(testProcessWorker.k);
      }
    };

    let firstListener = true;

    let startTestProcess = function () {
      let testProcess = testProcessWorker.k = cp.spawn('bash', [], {
        env: Object.assign({}, process.env, testEnv, {
          SUMAN_WATCH_TEST_RUN: 'yes'
        })
      });

      setImmediate(function () {
        testProcess.stdin.end('\n' + execTests + '\n');
      });

      testProcess.stdout.pipe(pt(chalk.grey(` [suman-watch-test-process] `))).pipe(process.stdout);
      testProcess.stderr.pipe(pt(chalk.yellow.bold(` [suman-watch-test-process] `), {omitWhitespace: true})).pipe(process.stderr);

      testProcess.once('exit', function (code, signal) {

        if (Number.isInteger(code)) {
          if (code > 0) {
            log.error('test process exited with code ', code);
          }
          else {
            log.veryGood('test process exited with code', code);
          }
        }
        else if ((signal = String(signal).trim())) {
          log.warning('test process was killed by signal', signal);
        }
        else {
          log.warning('test process was killed with unknown exit code and signal.');
        }

        if (firstListener) {
          firstListener = false;
          log.info(chalk.bold('now listening for "rs" or "rr" commands via stdin.'));
          process.stdin.on('data', onStdinData);
        }
      });
    };

    let firstBadStdin = true;

    const onStdinData = function (d: string) {
      if (String(d).trim() === 'rr') {
        log.info('"rr" command received: re-running test execution.');
        runNewTestProcess();
      }
      else if (String(d).trim() === 'rs') {
        log.info('"rs" (restart) command received: will restart watching process.');
        restartWatcher('user restarted the process with "rs" stdin command.');
      }
      else if (String(d).trim() === '') {
        if (firstBadStdin) {
          firstBadStdin = false;
          // if the user hits return, we want to let them add whitespace, without logging this line more than once
          log.warning('stdin command not recognized => ' +
            'try "rs" to restart the watcher process, or "rr" to re-run the most recently executed test.');
        }
      }
      else {
        log.warning('stdin command not recognized => ' +
          'try "rs" to restart the watcher process, or "rr" to re-run the most recently executed test.');
      }
    };

    let restartPluginWatcherThrottleTimeout: any;
    // we throttle this by 1 second to prevent overdoing things
    let restartPluginWatcherThrottle = function (reason: string) {
      clearTimeout(restartPluginWatcherThrottleTimeout);
      restartPluginWatcherThrottleTimeout = setTimeout(function () {
        restartWatcher(reason);
      }, 1000);
    };

    let restartWatcher = function (reason: string) {
      try {
        process.stdin.removeListener('data', onStdinData);
      }
      catch (err) {
        log.warning(err.message);
      }

      if (chokidarWatcher) {
        chokidarWatcher.close();
        chokidarWatcher.removeAllListeners();
      }

      clearTimeout(restartPluginWatcherThrottleTimeout);
      log.warning('restarting watch-per process' + (reason || '.'));
      if (watcherPluginProcess.k) {
        log.warning('killing current watch plugin process.');
        totallyKillProcess(watcherPluginProcess.k, 1000);
      }

      setImmediate(run, null, false, null);
    };

    let runNewTestProcess = function () {
      log.veryGood(chalk.green.bold(`Now running test process using: `) + `${chalk.bgBlack("'" + chalk.white.bold(execTests) + "'")}.`);
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

      if (stdoutEndTranspileRegex.test(watcherStdio.stdout)) {
        watcherStdio.stdout = ''; // reset stdout
        log.veryGood(chalk.bold('running a new test process: stdout from watch worker has indicated compilation has finished.'));
        runNewTestProcess();
        return;
      }

      if (stdoutStartTranspileRegex.test(watcherStdio.stdout)) {
        watcherStdio.stdout = ''; // reset stdout
        log.warning(chalk.yellow('killing any currently running test process, since we have received stdout matching a new compilation phase.'));
        killTestProcess();
      }

    });

    let chokidarWatcher = chokidar.watch('**/*.js', {
      cwd: projectRoot,
      persistent: true,
      ignoreInitial: true,
      ignored: /(\.log$|\/.idea\/|\/node_modules\/suman\/)/
    });

    chokidarWatcher.on('error', function (e: Error) {
      log.error('suman-watch watcher experienced an error', e.stack || e);
    });

    chokidarWatcher.once('ready', function () {
      log.veryGood('watcher is ready.');
      let watchCount = 0;
      let watched = chokidarWatcher.getWatched();

      Object.keys(watched).forEach(function (k) {
        let ln = watched[k].length;
        watchCount += ln;
        // const pluralOrNot = ln === 1 ? 'item' : 'items';
        // log.good(`${ln} ${pluralOrNot} watched in this dir => `, k);
      });

      log.veryGood('total number of files being watched by suman-watch process ', watchCount);
    });

    chokidarWatcher.on('change', function (p: string) {
      log.good('change event, file path => ', chalk.gray(p));

      if (path.basename(p) === 'suman.conf.js') {
        restartPluginWatcherThrottle('suman.conf.js file changed.');
      }
    });

    chokidarWatcher.on('add', function (file: string) {
      log.info('file was added: ' + chalk.gray(file));
    });

    chokidarWatcher.on('unlink', function (file: string) {
      log.info('file was unlinked: ' + chalk.gray(file));
    });

  };

};
