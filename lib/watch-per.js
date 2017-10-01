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
var su = require("suman-utils");
var chokidar = require("chokidar");
var chalk = require("chalk");
var prepend_transform_1 = require("prepend-transform");
var utils_1 = require("./utils");
var callable = true;
var alwaysIgnore = utils_1.default.getAlwaysIgnore();
exports.run = function (watchOpts, cb) {
    var projectRoot = su.findProjectRoot(process.cwd());
    var p = path.resolve(projectRoot + '/suman.conf.js');
    delete require.cache[p];
    var sumanConfig = require(p);
    var watchObj = watchOpts.watchPer;
    var includesErr = '"{suman.conf.js}.watch.per" entries must have an "includes/include" property ' +
        'which is a string or array of strings.';
    assert(Array.isArray(watchObj.include) ||
        su.isStringWithPositiveLn(watchObj.include) ||
        Array.isArray(watchObj.includes) ||
        su.isStringWithPositiveLn(watchObj.includes), includesErr);
    var excludesErr = '"{suman.conf.js}.watch.per" entries may have an "excludes/exclude" property but that property must ' +
        'be a string or an array of strings..';
    if (watchObj.excludes || watchObj.exclude) {
        assert(Array.isArray(watchObj.exclude) ||
            su.isStringWithPositiveLn(watchObj.exclude) ||
            Array.isArray(watchObj.excludes) ||
            su.isStringWithPositiveLn(watchObj.excludes), excludesErr);
    }
    var includes = _.flattenDeep([watchObj.includes].concat(watchObj.include)).filter(function (i) { return i; });
    {
        includes.forEach(function (v) {
            if (typeof v !== 'string' && !(v instanceof RegExp)) {
                throw includesErr;
            }
        });
    }
    var excludes = _.flattenDeep([watchObj.excludes].concat(watchObj.exclude)).filter(function (i) { return i; });
    {
        excludes.forEach(function (v) {
            if (typeof v !== 'string' && !(v instanceof RegExp)) {
                throw excludesErr;
            }
        });
    }
    assert(su.isStringWithPositiveLn(watchObj.exec), '"exec" property on {suman.conf.js}.watch.per must be a string with length greater than zero.');
    var ignored = alwaysIgnore.concat(excludes)
        .map(function (v) { return v instanceof RegExp ? v : new RegExp(v); });
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
            var pluralOrNot = ln === 1 ? 'item' : 'items';
            logging_1.default.good(ln + " " + pluralOrNot + " watched in this dir => ", k);
        });
        logging_1.default.veryGood('total number of files being watched by suman-watch => ', watchCount);
        cb && cb(null, { watched: watched });
    });
    var createWorker = function () {
        var k = cp.spawn('bash');
        k.stdout.pipe(prepend_transform_1.default(chalk.black.bold(' [watch-worker] '))).pipe(process.stdout);
        k.stderr.pipe(prepend_transform_1.default(chalk.yellow(' [watch-worker] '), { omitWhitespace: true })).pipe(process.stderr);
        return k;
    };
    var first = true;
    var running = {
        k: createWorker()
    };
    var startWorker = function () {
        return running.k = createWorker();
    };
    var onEvent = function (name) {
        return function (p) {
            logging_1.default.good(name, 'event => file path => ', p);
            if (!first) {
                running.k.kill();
                startWorker();
            }
            first = false;
            logging_1.default.good("now running '" + exec + "'.");
            running.k.stdin.write('\n' + exec + '\n');
            running.k.stdin.end();
        };
    };
    watcher.on('change', onEvent('change'));
    watcher.on('add', onEvent('add'));
    watcher.on('unlink', onEvent('unlink'));
};
