'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const assert = require("assert");
const path = require("path");
const cp = require("child_process");
const _ = require("lodash");
const logging_1 = require("./logging");
const su = require("suman-utils");
const chokidar = require("chokidar");
const chalk = require("chalk");
const prepend_transform_1 = require("prepend-transform");
const utils_1 = require("./utils");
const alwaysIgnore = utils_1.default.getAlwaysIgnore();
exports.makeRun = function (projectRoot, paths, sumanOpts) {
    return function run($sumanConfig, isRunNow, cb) {
        let { watchObj, sumanConfig } = utils_1.default.getWatchObj(projectRoot, sumanOpts, $sumanConfig);
        const includesErr = '"{suman.conf.js}.watch.per" entries must have an "includes/include" property ' +
            'which is a string or array of strings, or a "plugin" property.';
        assert(Array.isArray(watchObj.include) || su.isStringWithPositiveLn(watchObj.include) ||
            Array.isArray(watchObj.includes) || su.isStringWithPositiveLn(watchObj.includes), includesErr);
        const excludesErr = '"{suman.conf.js}.watch.per" entries may have an "excludes/exclude" property but that property must ' +
            'be a string or an array of strings..';
        if (watchObj.excludes || watchObj.exclude) {
            assert(Array.isArray(watchObj.exclude) || su.isStringWithPositiveLn(watchObj.exclude) ||
                Array.isArray(watchObj.excludes) || su.isStringWithPositiveLn(watchObj.excludes), excludesErr);
        }
        const _includes = [watchObj.includes].concat(watchObj.include);
        const includes = _.flattenDeep(_includes).filter((i) => i);
        {
            includes.forEach(function (v) {
                if (typeof v !== 'string' && !(v instanceof RegExp)) {
                    throw includesErr;
                }
            });
        }
        const _excludes = [watchObj.excludes].concat(watchObj.exclude);
        const excludes = _.flattenDeep(_excludes).filter((i) => i);
        {
            excludes.forEach(function (v) {
                if (typeof v !== 'string' && !(v instanceof RegExp)) {
                    throw excludesErr;
                }
            });
        }
        assert(su.isStringWithPositiveLn(watchObj.exec), '"exec" property on {suman.conf.js}.watch.per must be a string with length greater than zero.');
        const ignored = alwaysIgnore.concat(excludes)
            .map((v) => v instanceof RegExp ? v : new RegExp(v));
        const exec = watchObj.exec;
        let watcher = chokidar.watch(includes, {
            persistent: true,
            ignoreInitial: true,
            ignored,
        });
        watcher.on('error', function (e) {
            logging_1.log.error('suman-watch watcher experienced an error', e.stack || e);
        });
        watcher.once('ready', function () {
            logging_1.log.veryGood('watcher is ready.');
            let watchCount = 0;
            let watched = watcher.getWatched();
            Object.keys(watched).forEach(function (k) {
                let ln = watched[k].length;
                watchCount += ln;
                const pluralOrNot = ln === 1 ? 'item' : 'items';
                logging_1.log.good(`${ln} ${pluralOrNot} watched in this dir => `, k);
            });
            logging_1.log.veryGood('total number of files being watched by suman-watch => ', watchCount);
            cb && cb(null, { watched });
        });
        let createWorker = function () {
            const k = cp.spawn('bash', [], {
                env: Object.assign({}, process.env, {
                    SUMAN_WATCH_TEST_RUN: 'yes'
                })
            });
            k.stdout.pipe(prepend_transform_1.default(chalk.grey(' [watch-worker] '))).pipe(process.stdout);
            k.stderr.pipe(prepend_transform_1.default(chalk.yellow.bold(' [watch-worker] '), { omitWhitespace: true })).pipe(process.stderr);
            return k;
        };
        let running = {
            k: createWorker()
        };
        let startWorker = function () {
            return running.k = createWorker();
        };
        process.stdin.on('data', function onData(d) {
            if (String(d).trim() === 'rr') {
                logging_1.log.info('re-running test execution.');
                startWorker();
                executeExecString();
            }
            else if (String(d).trim() === 'rs') {
                logging_1.log.info('restarting watch-per process.');
                process.stdin.removeListener('data', onData);
                restartWatcher();
            }
            else {
                logging_1.log.info('stdin command not recognized.');
            }
        });
        let restartWatcher = function () {
            logging_1.log.warning('restarting watch-per process.');
            watcher.close();
            watcher.removeAllListeners();
            setImmediate(run, null, true, null);
        };
        let executeExecString = function () {
            logging_1.log.good(`now running '${exec}'.`);
            running.k.stdin.write('\n' + exec + '\n');
            running.k.stdin.end();
        };
        if (isRunNow) {
            executeExecString();
        }
        let first = true;
        watcher.on('change', function (p) {
            logging_1.log.good('change event, file path => ', p);
            if (first) {
                first = false;
            }
            else {
                running.k.kill('SIGKILL');
            }
            if (path.basename(p) === 'suman.conf.js') {
                restartWatcher();
            }
            else {
                startWorker();
                executeExecString();
            }
        });
        let addOrUnlinkTo;
        let onAddOrUnlink = function (p) {
            clearTimeout(addOrUnlinkTo);
            addOrUnlinkTo = setTimeout(restartWatcher, 1000);
        };
        watcher.on('add', onAddOrUnlink);
        watcher.on('unlink', onAddOrUnlink);
    };
};
