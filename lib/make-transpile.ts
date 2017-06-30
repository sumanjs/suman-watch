'use strict';

//typescript imports
import {ISumanWatchOptions} from "../index";

//polyfills
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');

//core
import * as fs from 'fs';
import * as util from 'util';
import * as assert from 'assert';
import * as path from 'path';
import * as cp from 'child_process';

//npm
import su, {INearestRunAndTransformRet} from 'suman-utils';

//project
import {logInfo, logError, logWarning, logVeryGood, logGood} from './logging';

///////////////////////////////////////////////////////////////////////////////////////////

export const makeTranspile = function (watchOpts: ISumanWatchOptions, projectRoot: string) {

  return function transpile(f: string, transformData: INearestRunAndTransformRet, $cb: Function) {

    const cb = su.once(this, $cb);

    // if(!transformPath){
    //   return process.nextTick(cb);
    // }

    console.log('transformData => ',util.inspect(transformData));

    let transformPath: string;

    // we do a lazy check to see if the @config file is closer to the source file, by simply comparing
    // filepath length
    const transformLength = transformData.transform ? transformData.transform.length : 0;
    if (transformData.config && transformData.config.length >= transformLength) {
      try {
        const config = require(transformData.config);
        const plugin = config['@transform']['plugin']['value'];
        if (plugin) {
          transformPath = require(plugin).getTransformPath();
        }
      }
      catch (err) {
        logError(err.stack || err);
      }
    }

    if (!transformPath) {
      if (transformData.transform) {
        transformPath = transformData.transform;
      }
      else {
        return process.nextTick(cb, new Error('no transform path could be found.'));
      }
    }

    su.makePathExecutable(transformPath, function (err: Error) {

      if (err) {
        return cb(err);
      }

      const k = cp.spawn('bash', [], {
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        env: Object.assign({}, process.env, {
          SUMAN_PROJECT_ROOT: projectRoot,
          // SUMAN_CHILD_TEST_PATH: f,
          SUMAN_TEST_PATHS: JSON.stringify([f]),
          SUMAN_TRANSFORM_ALL_SOURCES: 'no'
        })
      });

      console.log('transform path => ', transformPath);

      fs.createReadStream(transformPath).pipe(k.stdin);

      k.once('error', function (e: Error) {
        logError(`transform process experienced spawn error for path "${f}" =>\n${e.stack || e}.`)
      });

      let stdout = '';
      k.stdout.setEncoding('utf8');
      k.stdout.on('data', function (d: string) {
        stdout += d;
      });

      let stderr = '';
      k.stderr.setEncoding('utf8');
      k.stderr.on('data', function (d: string) {
        stderr += d;
      });

      const to = setTimeout(function () {
        cb(new Error(`transform process timed out for path "${f}".`), {
          stdout: String(stdout).trim(),
          stderr: String(stderr).trim()
        })
      }, 1000000);

      k.once('exit', function (code: number) {

        clearTimeout(to);

        let err;
        if (code > 0) {
          console.error(' => There was an error transforming your tests.');
          err = new Error(`transform process at path "${f}" exited with non-zero exit code =>\n${stderr}`);
        }

        cb(err, {
          code,
          path: f,
          stdout: String(stdout).trim(),
          stderr: String(stderr).trim()
        });

      });

    });

  };

};
