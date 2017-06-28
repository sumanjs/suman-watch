import {ISumanWatchOptions} from "../index";

//core
import * as util from 'util';
import * as assert from 'assert';
import * as path from 'path';
import * as cp from 'child_process';
import * as fs from 'fs';

//npm
import su, {INearestRunAndTransformRet} from 'suman-utils';

//project
import {workerPool} from './worker-pool';
import {logInfo, logError, logWarning, logVeryGood, logGood} from './logging';

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
        logError(err.stack || err);
      }
    }

    if (!runPath) {
      if (runData.run) {
        runPath = runData.run;
      }
    }

    su.makePathExecutable(runPath || f, function (err: Error) {

      if (err) {
        return cb(err);
      }

      let k;

      if (runPath) {

        console.log('runPath => ', runPath);

        k = cp.spawn('bash', [], {
          cwd: projectRoot,
          stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
          env: Object.assign({}, process.env, {
            SUMAN_TEST_PATHS: JSON.stringify([f]),
            SUMAN_ALWAYS_INHERIT_STDIO: 'yes'
          })
        });

        fs.createReadStream(runPath).pipe(k.stdin);

      }
      else {

        console.log('file path  => ', f);

        k = cp.spawn(f, [], {
          cwd: projectRoot,
          stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
          env: Object.assign({}, process.env, {
            SUMAN_TEST_PATHS: JSON.stringify([f]),
            SUMAN_ALWAYS_INHERIT_STDIO: 'yes'
          })
        });
      }

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
        })

      });

    });

  };

};