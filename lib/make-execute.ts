'use strict';
//dts
import {ISumanWatchOptions} from "./start-watching";

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
import su, {INearestRunAndTransformRet} from 'suman-utils';

//project
import {workerPool} from './worker-pool';
import log from './logging';
const bashPool = [];

//////////////////////////////////////////////////////////////////////////////////////////////

export const makeExecute = function (watchOptions: ISumanWatchOptions, projectRoot: string) {

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
        log.error(err.stack || err);
      }
    }

    if (!runPath) {
      if (runData.run) {
        runPath = runData.run;
      }
    }

    // su.makePathExecutable(runPath || f, function (err: Error) {
    //
    //   if (err) {
    //     return cb(err);
    //   }

    // if we "make path executable" it

    let k;

    if (runPath) {

      console.log('runPath => ', runPath);

      k = cp.spawn('bash', [], {
        detached: false,
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        env: Object.assign({}, process.env, {
          SUMAN_PROJECT_ROOT: projectRoot,
          SUMAN_TEST_PATHS: JSON.stringify([f]),
          SUMAN_ALWAYS_INHERIT_STDIO: 'yes',
          SUMAN_CHILD_TEST_PATH: f,
        })
      });

      fs.createReadStream(runPath).pipe(k.stdin);

    }
    else {

      if (String(f).endsWith('.js')) {

        let noDaemon = function () {

          k = cp.spawn('node', [f], {
            detached: false,
            cwd: projectRoot,
            stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
            env: Object.assign({}, process.env, {
              SUMAN_PROJECT_ROOT: projectRoot,
              SUMAN_CHILD_TEST_PATH: f,
              SUMAN_TEST_PATHS: JSON.stringify([f]),
              SUMAN_ALWAYS_INHERIT_STDIO: 'yes'
            })
          });

          let stdout = '';
          k.stdout.setEncoding('utf8');
          k.stdout.pipe(process.stdout);
          k.stdout.on('data', function (d: string) {
            stdout += d;
          });

          let stderr = '';
          k.stderr.setEncoding('utf8');
          k.stderr.pipe(process.stderr);
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

        const client = net.createConnection({port: 9091}, () => {
          //'connect' listener
          console.log('connected to server!');
          const cwdDir = path.dirname(f);
          console.log('cwd-dir => ', cwdDir);
          client.write(JSON.stringify({pid: -1, cwd: cwdDir, args: [f]}) + '\r\n');
        });

        client.once('error', function (e) {
          if (/ECONNREFUSED/.test(e.message)) {
            noDaemon();
          }
          else {
            console.error('client connect error => ', e.stack || e);
            cb(e);
          }
        });

        let endOk = false;
        client.once('data', function () {
          endOk = true;
        });

        client.pipe(process.stdout);

        client.on('end', () => {
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

        console.log('file path  => ', f);

        k = cp.spawn(f, [], {
          detached: false,
          cwd: projectRoot,
          stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
          env: Object.assign({}, process.env, {
            SUMAN_PROJECT_ROOT: projectRoot,
            SUMAN_CHILD_TEST_PATH: f,
            SUMAN_TEST_PATHS: JSON.stringify([f]),
            SUMAN_ALWAYS_INHERIT_STDIO: 'yes'
          })
        });

        let stdout = '';
        k.stdout.setEncoding('utf8');
        k.stdout.pipe(process.stdout);
        k.stdout.on('data', function (d: string) {
          stdout += d;
        });

        let stderr = '';
        k.stderr.setEncoding('utf8');
        k.stderr.pipe(process.stderr);
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
      }

    }

    // });

  };

};