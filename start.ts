#!/usr/bin/env node
'use strict';

//core
import * as util from 'util';
import * as assert from 'assert';
import * as path from 'path';
import * as EE from 'events';
import * as fs from 'fs';
import * as stream from 'stream';
import * as cp from 'child_process';

//npm

import * as async from 'async';
import su, {IMap, INearestRunAndTransformRet} from 'suman-utils';
import * as chokidar from 'chokidar';
import * as chalk from 'chalk';
import {Pool} from 'poolio';

//project
import {makeTranspile} from './lib/make-transpile';
import {makeExecute} from './lib/make-execute';
import {makeTranspileAll} from './lib/make-transpile-all';
import {find, getAlwaysIgnore, isPathMatchesSig} from './lib/utils';

//project
import {logInfo, logError, logWarning, logVeryGood, logGood} from './lib/logging';
import {ISumanWatchResult} from "./index";

/////////////////////////////////////////////////////////////////////

const testDir = process.env['TEST_DIR'];
const ignored = JSON.parse(process.env['SUMAN_TOTAL_IGNORED']);
const projectRoot = process.env['SUMAN_PROJECT_ROOT'];
const watchOpts = JSON.parse(process.env['SUMAN_WATCH_OPTS']);
const transpile = makeTranspile(watchOpts, projectRoot);
const execute = makeExecute(watchOpts, projectRoot);

let watcher = chokidar.watch(testDir, {
  // cwd: projectRoot,
  persistent: true,
  ignoreInitial: true,
  ignored: getAlwaysIgnore().concat(ignored).map((v: string) => new RegExp(v))
});

process.once('exit', function(){
  watcher.close();
});

process.on('SIGINT', function(){
  watcher.on('close', function(){
     process.exit(0);
  });
  watcher.close();
});

watcher.on('error', function (e: Error) {
  logError('watcher experienced an error', e.stack || e);
});

watcher.once('ready', function () {
  logVeryGood('watcher is ready.');

  let watchCount = 0;
  let watched = watcher.getWatched();

  Object.keys(watched).forEach(function (k) {
    watchCount += watched[k].length;
  });

  logVeryGood('number of files being watched by suman-watch => ', watchCount);
});


watcher.on('change', function (f: string) {

  if(!path.isAbsolute(f)){
    f = path.resolve(projectRoot + '/' + f);
  }

  logInfo('file change event for path => ', f);

  su.findNearestRunAndTransform(projectRoot, f, function (err: Error, ret: INearestRunAndTransformRet) {

    if (err) {
      logError(`error locating @run.sh / @transform.sh for file ${f}.\n${err}`);
      return;
    }

    transpile(f, ret, function (err: Error) {

      if (err) {
        logError(`error running transpile process for file ${f}.\n${err}`);
        return;
      }

      execute(f, ret, function (err: Error, result: ISumanWatchResult) {

        if (err) {
          logError(`error executing corresponding test process for source file ${f}.\n${err.stack || err}`);
          return;
        }

        const {stdout, stderr, code} = result;

        console.log('\n');
        console.error('\n');

        logInfo(`your corresponding test process for path ${f}, exited with code ${code}`);

        if (code > 0) {
          logError(`there was an error executing your test with path ${f}, because the exit code was greater than 0.`);
        }

        if (stderr) {
          logWarning(`the stderr for path ${f}, is as follows =>\n${chalk.yellow(stderr)}.`);
          console.error('\n');
        }

        if (stdout) {
          logInfo(`the stdout for path ${f}, is as follows =>\n${stdout}.`);
          console.log('\n');
        }

      });
    });

  });
});


