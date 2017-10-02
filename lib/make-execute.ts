'use strict';
//dts
import {INearestRunAndTransformRet} from "suman-types/dts/suman-utils";

//polyfills
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');

//core
import util = require('util');
import assert = require('assert');
import path = require('path');
import cp = require('child_process');
import fs = require('fs');
import net = require('net');

//npm
import * as su from 'suman-utils';
import {pt} from 'prepend-transform';
import * as chalk from 'chalk';

//project
// import {workerPool} from './worker-pool';
import log from './logging';
import {IPoolioChildProcess} from "poolio";
import {ChildProcess} from "child_process";


/////////////////////////////////////////////////////////////////////////////////////////////

process.stdout.setMaxListeners(80);
process.stderr.setMaxListeners(80);

//////////////////////////////////////////////////////////////////////////////////////////////

export const makeExecute = function (watchOptions: Object, projectRoot: string) {

  return function (f: string, runData: INearestRunAndTransformRet, $cb: Function) {

    const cb = su.once(this, $cb);
    let runPath: string;

    // we do a lazy check to see if the @config file is closer to the source file, by simply comparing
    // filepath length
    const runLength = runData.run ? runData.run.length : 0;
    if (runData.config && runData.config.length > runLength) {
      try {
        const config = require(runData.config);
        const plugin = config['@run']['plugin']['value'];
        if (plugin) {
          runPath = require(plugin).getRunPath();
        }
      }
      catch (err) {
        log.warn('no run plugin could be found to execute the test.');
      }
    }

    if (!runPath) {
      if (runData.run) {
        log.warn('runPath has been found.');
        runPath = runData.run;
      }
      else{
        log.warn('runPath has not been found.');
      }
    }

    let handleStdioAndExit = function (k: ChildProcess, runPath: string, f: string) {

      let stdout = '';
      k.stdout.setEncoding('utf8');
      k.stdout.pipe(pt(chalk.grey(' [watch-worker-exec] '))).pipe(process.stdout);
      k.stdout.on('data', function (d: string) {
        stdout += d;
      });

      let stderr = '';
      k.stderr.setEncoding('utf8');
      k.stderr.pipe(pt(chalk.yellow.bold(' [watch-worker-exec] '), {omitWhitespace: true})).pipe(process.stderr);
      k.stderr.on('data', function (d: string) {
        stderr += d;
      });

      k.once('exit', function (code: number) {

        cb(null, {
          path: f,
          runPath,
          code,
          stdout: String(stdout).trim(),
          stderr: String(stderr).trim()
        });

      });
    };

    let k;

    if (runPath) {

      log.info(`executable path => '${runPath}'`);

      k = cp.spawn('bash', [], {
        detached: false,
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: Object.assign({}, process.env, {
          SUMAN_PROJECT_ROOT: projectRoot,
          SUMAN_TEST_PATHS: JSON.stringify([f]),
          SUMAN_ALWAYS_INHERIT_STDIO: 'yes',
          SUMAN_CHILD_TEST_PATH: f,
        })
      });

      fs.createReadStream(runPath).pipe(k.stdin);

      handleStdioAndExit(k, runPath, null);

    }
    else if (String(f).endsWith('.js')) {

      let noDaemon = function () {

        k = cp.spawn('node', [f], {
          detached: false,
          cwd: projectRoot,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: Object.assign({}, process.env, {
            SUMAN_PROJECT_ROOT: projectRoot,
            SUMAN_CHILD_TEST_PATH: f,
            SUMAN_TEST_PATHS: JSON.stringify([f]),
            SUMAN_ALWAYS_INHERIT_STDIO: 'yes'
          })
        });

        handleStdioAndExit(k, runPath, f);
      };

      // if we are using Suman daemon, then we can use this?
      const client = net.createConnection({port: 9091}, () => {
        log.good('connected to server!');
        const cwdDir = path.dirname(f);
        log.good('cwd-dir => ', cwdDir);
        client.write(JSON.stringify({pid: -1, cwd: cwdDir, args: [f]}) + '\r\n');
      });

      client.once('error', function (e) {
        if (/ECONNREFUSED/.test(e.message)) {
          process.nextTick(noDaemon);
        }
        else {
          log.error('client connect error => ', e.stack || e);
          process.nextTick(cb, e);
        }
      });

      let endOk = false;
      client.once('data', function () {
        endOk = true;
      });

      client.pipe(pt(` [watch-worker-via-daemon] `)).pipe(process.stdout);

      client.once('end', () => {
        if (endOk) {
          cb(null, {
            path: f,
            runPath,
            code: null,
            stdout: '',
            stderr: ''
          });
        }
      });

    }
    else {

      log.info(`file path  => '${f}'`);

      let extname = path.extname(f);

      if (['.html', '.json', '.xml', '.log', '.txt', '.d.ts', '.md'].some(v => String(f).endsWith(v))) {
        log.info(`files with extension '${extname}' are currently ignored by suman-watch.`);
        return process.nextTick(cb, null, {code: -1});
      }

      k = cp.spawn(f, [], {
        detached: false,
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: Object.assign({}, process.env, {
          SUMAN_PROJECT_ROOT: projectRoot,
          SUMAN_CHILD_TEST_PATH: f,
          SUMAN_TEST_PATHS: JSON.stringify([f]),
          SUMAN_ALWAYS_INHERIT_STDIO: 'yes'
        })
      });

      k.once('error', function (e: Error) {
        log.error(e.stack || e);
      });

      handleStdioAndExit(k, runPath, f);
    }

  }

};
