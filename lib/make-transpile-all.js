'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var process = require('suman-browser-polyfills/modules/process');
var global = require('suman-browser-polyfills/modules/global');
var cp = require("child_process");
var async = require("async");
var logging_1 = require("./logging");
exports.makeTranspileAll = function (watchOpts) {
    return function (root, transformPaths, cb) {
        async.mapLimit(transformPaths, 5, function (t, cb) {
            logging_1.logInfo(' => About to spawn => ', t);
            var k = cp.spawn(t, [], {
                cwd: root,
                env: Object.assign({}, process.env, {
                    SUMAN_CHILD_TEST_PATH: '',
                })
            });
            k.once('error', function (e) {
                logging_1.logError("spawn error for path => \"" + t + "\" =>\n" + (e.stack || e));
            });
            k.once('exit', function (code) {
                cb(null, {
                    path: t,
                    code: code
                });
            });
        }, cb);
    };
};
