'use strict';

//polyfills
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');

//core
import path = require('path');

//npm
import {Pool} from "poolio";
import log from './logging';

/////////////////////////////////////////////////////////////////////

const pool = new Pool({
  size: 3,
  filePath: path.resolve(__dirname + '/handle-require.js'),
  oneTimeOnly: true
});

pool.on('error', function (e: Error) {
  log.error(e.stack || e);
});

export const workerPool = pool;
