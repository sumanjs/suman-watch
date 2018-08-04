'use strict';

//tsc
import {INearestRunAndTransformRet} from "suman-types/dts/suman-utils";

//polyfills
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');

//core
import * as fs from 'fs'
import * as util from 'util'
import * as assert from 'assert'
import * as path from 'path'
import * as cp from 'child_process'

//npm
import * as su from 'suman-utils';
import {pt} from 'prepend-transform';
import * as chalk from 'chalk';

//project
import log from './logging';

///////////////////////////////////////////////////////////////////////////////////////////

export const makeTranspile = function (watchOpts: Object, projectRoot: string) {

  return function transpile(f: string, transformData: INearestRunAndTransformRet, isTranspile: boolean, cb: Function) {

    if (isTranspile === false) {
      return process.nextTick(cb);
    }

    log.info('transform data => ', util.inspect(transformData));

    let transformPath: string;

    // we do a lazy check to see if the @config file is closer to the source file, by simply comparing
    // filepath length
    const transformLength = transformData.transform ? transformData.transform.length : 0;
    if (transformData.config && transformData.config.length >= transformLength) {
      try {
        const config = require(transformData.config);
        try {
          if (config['@transform']['prevent'] === true) {
            log.info('we are not transpiling this file because "prevent" is set to true in @config.json.');
            return process.nextTick(cb);
          }
        }
        catch (err) {
          /* noop */
        }

        const plugin = config['@transform']['plugin']['value'];
        if (plugin) {
          transformPath = require(plugin).getTransformPath();
        }
      }
      catch (err) {
        /* noop */
      }
    }

    if (!transformPath) {
      if (transformData.transform) {
        transformPath = transformData.transform;
      }
      else {
        log.error('no transform method could be found.');
        return process.nextTick(cb);
      }
    }

    su.makePathExecutable(transformPath, function (err: Error) {

      if (err) {
        return cb(err);
      }

      const k = cp.spawn('bash', [], {
        detached: false,
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        env: Object.assign({}, process.env, {
          SUMAN_PROJECT_ROOT: projectRoot,
          // SUMAN_CHILD_TEST_PATH: f,
          SUMAN_TEST_PATHS: JSON.stringify([f]),
          SUMAN_TRANSFORM_ALL_SOURCES: 'no'
        })
      });

      fs.createReadStream(transformPath).pipe(k.stdin);

      k.once('error', function (e: Error) {
        log.error(`transform process experienced spawn error for path "${f}" =>\n${e.stack || e}.`)
      });

      let stdout = '';
      k.stdout.setEncoding('utf8');
      k.stdout.pipe(pt(chalk.black.bold(' [watch-worker-transform] '))).pipe(process.stdout);
      k.stdout.on('data', function (d: string) {
        stdout += d;
      });

      let stderr = '';
      k.stderr.setEncoding('utf8');
      k.stderr.pipe(pt(chalk.yellow(' [watch-worker-transform] '), {omitWhitespace: true})).pipe(process.stderr);
      k.stderr.on('data', function (d: string) {
        stderr += d;
      });

      let timedout = false;
      let onTimeout = function () {
        timedout = true;
        cb(new Error(`transform process timed out for path "${f}".`), {
          stdout: String(stdout).trim(),
          stderr: String(stderr).trim()
        });
      };

      const to = setTimeout(onTimeout, 100000);

      k.once('exit', function (code: number) {

        if (code > 0) {
          log.warning('transpilation may have failed, the process has exited with code => ', code);
        }
        else {
          log.info('transpilation process appears to be successful, and has exited with code => ', code);
        }

        clearTimeout(to);

        if (!timedout) {
          let err;
          if (code > 0) {
            log.error(' => There was an error transforming your tests.');
            err = new Error(`transform process at path "${f}" exited with non-zero exit code =>\n${stderr}`);
          }

          cb(err, {
            code,
            path: f,
            stdout: String(stdout).trim(),
            stderr: String(stderr).trim()
          });
        }

      });

    });

  };

};
