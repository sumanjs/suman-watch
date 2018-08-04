'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const path = require("path");
const poolio_1 = require("poolio");
const logging_1 = require("./logging");
const pool = new poolio_1.Pool({
    size: 3,
    filePath: path.resolve(__dirname + '/handle-require.js'),
    oneTimeOnly: true
});
pool.on('error', function (e) {
    logging_1.default.error(e.stack || e);
});
exports.workerPool = pool;
