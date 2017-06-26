import {ISumanWatchOptions} from "../index";

//core
import * as util from 'util';
import * as assert from 'assert';
import * as path from 'path';
import * as cp from 'child_process';
import * as fs from 'fs';

//npm
import su from 'suman-utils';

/////////////////////////////////////////////

export const makeExecute = function (watchOptions: ISumanWatchOptions, projectRoot: string) {

  return function (f: string, runPath: string, $cb: Function) {

    const cb = su.once(this, $cb);

    su.makePathExecutable(runPath, function (err: Error) {

      if (err) {
        return cb(err);
      }

      let k;

      if (runPath) {
        k = cp.spawn(runPath, [], {
          cwd: projectRoot,
          stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
          env: Object.assign({}, process.env, {
            SUMAN_TEST_PATHS: JSON.stringify([f])
          })
        });

      }
      else {
        k = cp.spawn(f, [], {
          cwd: projectRoot,
          stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
          env: Object.assign({}, process.env, {
            SUMAN_TEST_PATHS: JSON.stringify([f])
          })
        });
      }

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

      k.once('exit', function (code: number) {

        cb(null, {
          path: f,
          runPath,
          code,
          stdout: String(stdout).trim(),
          stderr: String(stderr).trim()
        })

      });

    });

  };

};