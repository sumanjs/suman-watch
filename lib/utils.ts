//polyfills
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');

//core
import * as util from 'util';
import * as assert from 'assert';
import * as path from 'path';
import * as EE from 'events';
import * as fs from 'fs';
import * as stream from 'stream';

//npm
import log from './logging';
import * as async from 'async';
import su, {IMap} from 'suman-utils';

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
    '\.txt$'   ///////////
  ];

};

export const isPathMatchesSig = function(basename: string){
   return sig.some(function(v: string){
      return String(basename) === String(v);
   });
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
        cb(null, {
          path: p,
          data: JSON.parse(data)
        });
      }
      catch (err) {
        cb(err);
      }

    });

  }, cb)

};

const $exports = module.exports;
export default $exports;