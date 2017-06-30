"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var process = require('suman-browser-polyfills/modules/process');
var global = require('suman-browser-polyfills/modules/global');
var path = require("path");
var fs = require("fs");
var async = require("async");
var sig = ['@run.sh', '@transform.sh', '@config.json'];
exports.getAlwaysIgnore = function () {
    return [
        '___jb_old___',
        '___jb_tmp___',
        '/node_modules/',
        '/.git/',
        '\\.log$',
        '/logs/',
        '/@target/'
    ];
};
exports.isPathMatchesSig = function (basename) {
    return sig.some(function (v) {
        return String(basename) === String(v);
    });
};
exports.find = function (getTransformPaths, cb) {
    async.map(Object.keys(getTransformPaths), function (key, cb) {
        if (!getTransformPaths[key]['@config.json']) {
            return process.nextTick(cb);
        }
        var p = path.resolve(key + '/@config.json');
        fs.readFile(p, 'utf8', function (err, data) {
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
    }, cb);
};
