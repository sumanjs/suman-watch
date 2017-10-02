'use strict';

//dts
import {ISumanOpts, ISumanConfig} from 'suman-types/dts/global';

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

//npm
import log from './logging';
import chalk = require('chalk');
import * as async from 'async';
import * as su from 'suman-utils';

/////////////////////////////////////////////////////////////////////////////////////////

const sig = ['@run.sh', '@transform.sh', '@config.json'];

export const getAlwaysIgnore = function () {

  return [

    '.DS_Store',
    '/.idea/',
    '___jb_old___',
    '___jb_tmp___',
    '/node_modules/',
    '/.git/',
    '\\.log$',
    '/logs/',
    '/@target/',
    '\.txt$'

  ];

};

export const isPathMatchesSig = function (basename: string) {
  return sig.some(function (v: string) {
    return String(basename) === String(v);
  });
};

export const getWatchObj = function (projectRoot: string, sumanOpts: ISumanOpts, sumanConfig?: ISumanConfig) {

  if (!sumanConfig) {
    // we should re-load suman config, in case it has changed, etc.
    const p = path.resolve(projectRoot + '/suman.conf.js');
    log.warn(`new suman.conf.js path => ${p}`);
    delete require.cache[p];
    log.warn(`deleted suman.conf.js cache`);
    sumanConfig = require(p);
    log.warn(`re-required suman.conf.js file.`);
  }

  let watchObj = null;

  if (sumanOpts.watch_per) {
    assert(su.isObject(sumanConfig.watch),
      chalk.red(' => Suman usage error => suman.conf.js needs a "watch" property that is an object.'));

    assert(su.isObject(sumanConfig.watch.per),
      chalk.red(' => Suman usage error => suman.conf.js "watch" object, needs property called "per" that is an object.'));

    watchObj = sumanConfig.watch.per[sumanOpts.watch_per];

    assert(su.isObject(watchObj),
      chalk.red(`Suman usage error => key "${sumanOpts.watch_per}" does not exist on the {suman.conf.js}.watch.per object.`));
  }

  return {
    watchObj,
    sumanConfig
  };

};

export const find = function (getTransformPaths: IMap, cb: AsyncResultArrayCallback<Error, Iterable<any>>) {

  async.map(Object.keys(getTransformPaths), function (key, cb: Function) {

    if (!getTransformPaths[key]['@config.json']) {
      return process.nextTick(cb);
    }

    const p = path.resolve(key + '/@config.json');

    fs.readFile(p, 'utf8', function (err: Error, data: string) {

      if (err) {
        return cb(err);
      }

      try {
        cb(null, {path: p, data: JSON.parse(data)});
      }
      catch (err) {
        cb(err);
      }

    });

  }, cb)

};

const $exports = module.exports;
export default $exports;
