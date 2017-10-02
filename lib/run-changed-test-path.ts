'use strict';

//dts
import {ISumanWatchResult} from "./start-watching";
import {INearestRunAndTransformRet} from "suman-types/dts/suman-utils";

//core
import util = require('util');
import assert = require('assert');
import path = require('path');
import fs = require('fs');
import cp = require('child_process');

//npm
import * as su from 'suman-utils';
import * as chokidar from 'chokidar';
import * as chalk from 'chalk';

//project
import {makeTranspile} from './make-transpile';
import {makeExecute} from './make-execute';
import {find, getAlwaysIgnore, isPathMatchesSig} from './utils';
import log from './logging';

//////////////////////////////////////////////////////////////////////////////////////////

export const makeRunChangedTestPath = function (watchOpts: Object, projectRoot: string) {

  const transpile = makeTranspile(watchOpts, projectRoot);
  const execute = makeExecute(watchOpts, projectRoot);

  return function (f: string) {

    let dn = path.basename(path.dirname(f));
    const canonicalDirname = String('/' + dn + '/').replace(/\/+/g, '/');

    let originalFile;
    let resolvedWithRoot = false;
    if (!path.isAbsolute(f)) {
      originalFile = f;
      f = path.resolve(projectRoot + '/' + f);
      resolvedWithRoot = true;
      // throw new Error(`suman watch implementation error - watched paths must be absolute - "${f}"`);
    }

    try {
      fs.statSync(f);
    }
    catch (err) {
      if (originalFile) {
        log.error('file was resolved against project root => ', originalFile);
        log.error(`this file may have been resolved incorrectly; it was resolved to: "${f}".`);
        throw new Error(`'suman-watch' implementation error - watched paths must be absolute -> \n\t "${originalFile}"`);
      }
    }

    su.findNearestRunAndTransform(projectRoot, f, function (err: Error, ret: INearestRunAndTransformRet) {

      if (err) {
        log.error(`error locating @run.sh / @transform.sh for file ${f}.\n${err}`);
        return;
      }

      let matched = false;

      try {
        if (ret.config) {
          const config = require(ret.config);
          const match = config['@src']['marker'];
          const canonicalMatch = String('/' + match + '/').replace(/\/+/g, '/');
          if (canonicalDirname.match(new RegExp(canonicalMatch))) {
            matched = true;
          }
        }
      }
      catch (err) {
        log.error(err.stack || err);
      }
      finally {
        if (dn.match(/\/@src\//)) {
          matched = true;
        }
      }

      if (!matched) {
        log.warn('file will not be transpiled.');
      }

      transpile(f, ret, matched, function (err: Error) {

        if (err) {
          log.error(`error running transpile process for file ${f}.\n${err}`);
          return;
        }

        execute(f, ret, function (err: Error, result: ISumanWatchResult) {

          if (err) {
            log.error(`error executing corresponding test process for source file ${f}.\n${err.stack || err}`);
            return;
          }

          const {stdout, stderr, code} = result;

          if (code === -1) {
            // the file was not run, maybe it was an .html or .json file or .xml file, etc.
            return;
          }

          if (code === undefined) {
            log.warning('suman-watcher implementation warning, exit code was undefined.');
          }

          if (false) {

            console.log('\n');

            log.info(`your corresponding test process for path ${f}, exited with code ${code}`);

            if (code > 0) {
              log.error(`there was an error executing your test with path ${f}, because the exit code was greater than 0.`);
            }

            if (stderr) {
              log.warning(`the stderr for path ${f}, is as follows =>\n${chalk.yellow(stderr)}.`);
              console.log('\n');
            }
          }

        });
      });

    });
  }

};
