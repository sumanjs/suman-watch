#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var process = require('suman-browser-polyfills/modules/process');
var global = require('suman-browser-polyfills/modules/global');
var assert = require("assert");
var path = require("path");
var cp = require("child_process");
var _ = require("lodash");
var logging_1 = require("./logging");
var suman_utils_1 = require("suman-utils");
var chokidar = require("chokidar");
var utils_1 = require("./utils");
var callable = true;
var alwaysIgnore = utils_1.default.getAlwaysIgnore();
exports.run = function (watchOpts, cb) {
    var projectRoot = suman_utils_1.default.findProjectRoot(process.cwd());
    var p = path.resolve(projectRoot + '/suman.conf.js');
    delete require.cache[p];
    var sumanConfig = require(p);
    var watchObj = watchOpts.watchPer;
    var includesErr = '"{suman.conf.js}.watch.per" entries must have an "includes" property ' +
        'which is a string or array of strings.';
    assert(Array.isArray(watchObj.includes) || suman_utils_1.default.isStringWithPositiveLn(watchObj.includes), includesErr);
    var excludesErr = '"{suman.conf.js}.watch.per" entries may have an "excludes" property but that property must ' +
        'be a string or an array of strings..';
    if (watchObj.excludes) {
        assert(Array.isArray(watchObj.excludes) || suman_utils_1.default.isStringWithPositiveLn(watchObj.excludes), excludesErr);
    }
    var includes = _.flattenDeep([watchObj.includes]).filter(function (i) { return i; });
    includes.forEach(function (v) {
        if (typeof v !== 'string') {
            throw includesErr;
        }
    });
    var excludes = _.flattenDeep([watchObj.excludes]).filter(function (i) { return i; });
    excludes.forEach(function (v) {
        if (typeof v !== 'string' && !(v instanceof RegExp)) {
            throw excludesErr;
        }
    });
    assert(suman_utils_1.default.isStringWithPositiveLn(watchObj.exec), '"exec" property on {suman.conf.js}.watch.per must be a string with length greater than zero.');
    var ignored = alwaysIgnore.concat(excludes).map(function (v) { return v instanceof RegExp ? v : new RegExp(v); });
    var exec = watchObj.exec;
    var watcher = chokidar.watch(includes, {
        persistent: true,
        ignoreInitial: true,
        ignored: ignored,
    });
    watcher.on('error', function (e) {
        logging_1.default.error('watcher experienced an error', e.stack || e);
    });
    watcher.once('ready', function () {
        logging_1.default.veryGood('watcher is ready.');
        var watchCount = 0;
        var watched = watcher.getWatched();
        Object.keys(watched).forEach(function (k) {
            var ln = watched[k].length;
            watchCount += ln;
            logging_1.default.good(ln + " items watched in this dir => ", k);
        });
        logging_1.default.veryGood('total number of files being watched by suman-watch => ', watchCount);
        cb && cb(null, {
            watched: watched
        });
    });
    var createWorker = function () {
        return cp.spawn('bash', [], {
            stdio: ['pipe', process.sdtout, process.stderr]
        });
    };
    var running = {
        k: createWorker()
    };
    var startWorker = function () {
        return running.k = createWorker();
    };
    var onEvent = function (name) {
        return function (p) {
            logging_1.default.warning(name, 'event => file path => ', p);
            running.k.kill();
            startWorker();
            running.k.stdin.write('\n' + exec + '\n');
            running.k.stdin.end();
        };
    };
    watcher.on('change', onEvent('change'));
    watcher.on('add', onEvent('add'));
    watcher.on('unlink', onEvent('unlink'));
};
