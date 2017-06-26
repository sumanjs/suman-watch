"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var poolio_1 = require("poolio");
var path = require("path");
var pool = new poolio_1.Pool({
    size: 3,
    filePath: path.resolve(__dirname + '/handle-require.js'),
    oneTimeOnly: true
});
pool.on('error', function (e) {
    console.error(e.stack || e);
});
exports.workerPool = pool;