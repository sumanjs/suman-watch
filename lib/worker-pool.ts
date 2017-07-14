import {Pool} from "poolio";
import path = require('path');


//polyfills
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');

/////////////////////////////////////////////////

const pool = new Pool({
  size: 3,
  filePath: path.resolve(__dirname + '/handle-require.js'),
  oneTimeOnly: true
});

pool.on('error', function (e: Error) {
  console.error(e.stack || e);
});

export const workerPool = pool;