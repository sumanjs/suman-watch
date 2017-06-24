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

  return function (f: string, runPath: string, cb: Function) {

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
            SUMAN_CHILD_TEST_PATH: f
          })
        });

        // // TODO: make run.sh file executable first
        // k.stdin.write('\n' + `suman --runner ${toBeRun} --inherit-stdio --force-match` + '\n');
        // process.nextTick(function () {
        //   k.stdin.end();
        // });
      }
      else {
        k = cp.spawn(f, [], {
          cwd: projectRoot,
          stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
          env: Object.assign({}, process.env, {
            SUMAN_CHILD_TEST_PATH: f
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

      k.once('close', function (code: number) {

        cb(null, {
          code,
          stdout: String(stdout).trim(),
          stderr: String(stderr).trim()
        })

      });

    });

  };

};