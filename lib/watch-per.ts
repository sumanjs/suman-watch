#!/usr/bin/env node
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
import * as EE from 'events';
import fs = require('fs');
import * as stream from 'stream';
import cp = require('child_process');

//npm
import * as _ from 'lodash';
import log from './logging';
import su from 'suman-utils';
import * as chokidar from 'chokidar';

//project
import utils from './utils';

///////////////////////////////////////////////////////////////////////////////

let callable = true;
const alwaysIgnore = utils.getAlwaysIgnore();

///////////////////////////////////////////////////////////////////////////////

export const run = function (watchOpts: ISumanWatchOptions, cb?: Function) {

  const projectRoot = su.findProjectRoot(process.cwd());

  // we should re-load suman config, in case it has changed, etc.
  const p = path.resolve(projectRoot + '/suman.conf.js');
  delete require.cache[p];
  const sumanConfig = require(p);

  let watchObj = watchOpts.watchPer;

  const includesErr = '"{suman.conf.js}.watch.per" entries must have an "includes" property ' +
    'which is a string or array of strings.';

  assert(Array.isArray(watchObj.includes) || su.isStringWithPositiveLn(watchObj.includes), includesErr);

  const excludesErr =
    '"{suman.conf.js}.watch.per" entries may have an "excludes" property but that property must ' +
    'be a string or an array of strings..';

  if (watchObj.excludes) {
    assert(Array.isArray(watchObj.excludes) || su.isStringWithPositiveLn(watchObj.excludes), excludesErr);
  }

  const includes = _.flattenDeep([watchObj.includes]).filter((i: string) => i);
  includes.forEach(function (v: string) {
    if (typeof v !== 'string' && !(v instanceof RegExp)) {
      throw includesErr;
    }
  });

  const excludes = _.flattenDeep([watchObj.excludes]).filter((i: string) => i);
  excludes.forEach(function (v: string | RegExp) {
    if (typeof v !== 'string' && !(v instanceof RegExp)) {
      throw excludesErr;
    }
  });

  assert(su.isStringWithPositiveLn(watchObj.exec),
    '"exec" property on {suman.conf.js}.watch.per must be a string with length greater than zero.');

  const ignored =
    alwaysIgnore.concat(excludes).map((v: string | RegExp) => v instanceof RegExp ? v : new RegExp(v));

  const exec = watchObj.exec;

  let watcher = chokidar.watch(includes, {
    // cwd: projectRoot,
    persistent: true,
    ignoreInitial: true,
    ignored,
  });

  watcher.on('error', function (e: Error) {
    log.error('watcher experienced an error', e.stack || e);
  });

  watcher.once('ready', function () {
    log.veryGood('watcher is ready.');

    let watchCount = 0;
    let watched = watcher.getWatched();

    Object.keys(watched).forEach(function (k) {
      let ln = watched[k].length;
      watchCount += ln;
      log.good(`${ln} items watched in this dir => `, k);
    });

    log.veryGood('total number of files being watched by suman-watch => ', watchCount);
    cb && cb(null, {
      watched
    });
  });

  let createWorker = function () {
    return cp.spawn('bash', [], {
      stdio: ['pipe', process.sdtout, process.stderr]
    })
  };

  let running = {
    k: createWorker()
  };

  let startWorker = function () {
    return running.k = createWorker()
  };

  let onEvent = function (name: string) {
    return function (p: string) {
      log.warning(name, 'event => file path => ', p);
      running.k.kill();
      startWorker();
      running.k.stdin.write('\n' + exec + '\n');
      running.k.stdin.end();
    }
  };

  watcher.on('change', onEvent('change'));
  watcher.on('add', onEvent('add'));
  watcher.on('unlink', onEvent('unlink'));

};