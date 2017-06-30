#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var process = require('suman-browser-polyfills/modules/process');
var global = require('suman-browser-polyfills/modules/global');
var util = require("util");
var path = require("path");
var cp = require("child_process");
var logging_1 = require("./lib/logging");
var async = require("async");
var suman_utils_1 = require("suman-utils");
var chokidar = require("chokidar");
var chalk = require("chalk");
var utils_1 = require("./lib/utils");
var make_transpile_all_1 = require("./lib/make-transpile-all");
var alwaysIgnore = [
    '___jb_old___',
    '___jb_tmp___',
    '/node_modules/',
    '/.git/',
    '\\.log$',
    '\\.json$',
    '/logs/',
    '/@target/'
];
var onSIG = function () {
    logging_1.logInfo('suman watch is exiting.');
    process.exit(139);
};
process.on('SIGINT', onSIG);
process.on('SIGTERM', onSIG);
exports.startWatching = function (watchOpts, cb) {
    var projectRoot = suman_utils_1.default.findProjectRoot(process.cwd());
    var testDir = process.env['TEST_DIR'];
    var testSrcDir = process.env['TEST_SRC_DIR'];
    var transpileAll = make_transpile_all_1.makeTranspileAll(watchOpts, projectRoot);
    async.autoInject({
        getTransformPaths: function (cb) {
            if (watchOpts.noTranspile) {
                logging_1.logInfo('watch process will not get all transform paths, because we are not transpiling.');
                return process.nextTick(cb);
            }
            suman_utils_1.default.findSumanMarkers(['@run.sh', '@transform.sh', '@config.json'], testDir, [], cb);
        },
        getIgnorePathsFromConfigs: function (getTransformPaths, cb) {
            utils_1.find(getTransformPaths, cb);
        },
        transpileAll: function (getTransformPaths, cb) {
            console.log(util.inspect(getTransformPaths));
            if (watchOpts.noTranspile) {
                logging_1.logInfo('watch process will not run transpile-all routine, because we are not transpiling.');
                return process.nextTick(cb);
            }
            var paths = Object.keys(getTransformPaths).map(function (key) {
                if (getTransformPaths[key]['@transform.sh']) {
                    return {
                        cwd: getTransformPaths[key],
                        basePath: path.resolve(key + '/@transform.sh'),
                        bashFilePath: path.resolve(key + '/@transform.sh')
                    };
                }
                if (getTransformPaths[key]['@config.json']) {
                    try {
                        var config = require(path.resolve(key + '/@config.json'));
                        var plugin = config['@transform']['plugin']['value'];
                        return {
                            cwd: getTransformPaths[key],
                            basePath: path.resolve(key + '/@config.json'),
                            bashFilePath: require(plugin).getTransformPath()
                        };
                    }
                    catch (err) {
                        logging_1.logError(err.stack || err);
                    }
                }
            })
                .filter(function (i) { return i; });
            transpileAll(paths, cb);
        }
    }, function (err, results) {
        if (err) {
            throw err;
        }
        logging_1.logGood('\nTranspilation results:\n');
        results.transpileAll.forEach(function (t) {
            if (t.code > 0) {
                logging_1.logError('transform result error => ', util.inspect(t));
            }
            else {
                logging_1.logGood("transform result for => " + chalk.magenta(t.path.basePath));
                var stdout = String(t.stdout).split('\n').filter(function (i) { return i; });
                if (stdout.length > 0) {
                    console.log('\n');
                    console.log('stdout:\n');
                    stdout.forEach(function (l) {
                        logging_1.logGood('stdout:', l);
                        console.log('\n');
                    });
                }
                var stderr = String(t.stderr).split('\n').filter(function (i) { return i; });
                if (stderr.length > 0) {
                    console.log('\n');
                    console.error('stderr:\n');
                    stderr.forEach(function (l) {
                        logging_1.logWarning('stderr:', l);
                    });
                    console.log('\n');
                }
            }
        });
        var moreIgnored = results.getIgnorePathsFromConfigs.filter(function (item) {
            return item.data && item.data['@target'] && item.data['@target']['marker'];
        })
            .map(function (item) {
            return '^' + path.dirname(item.path) + '/(.*\/)?' + (String(item.data['@target']['marker']).replace(/^\/+/, ''));
        });
        var startScript = path.resolve(__dirname + '/start.js');
        var k = cp.spawn(startScript, [], {
            cwd: projectRoot,
            env: Object.assign({}, process.env, {
                SUMAN_TOTAL_IGNORED: JSON.stringify(moreIgnored),
                SUMAN_PROJECT_ROOT: projectRoot,
                SUMAN_WATCH_OPTS: JSON.stringify(watchOpts)
            })
        });
        var watcher = chokidar.watch(testDir, {
            persistent: true,
            ignoreInitial: true,
            ignored: alwaysIgnore.concat(moreIgnored).map(function (v) { return new RegExp(v); })
        });
        watcher.on('error', function (e) {
            logging_1.logError('watcher experienced an error', e.stack || e);
        });
        watcher.once('ready', function () {
            logging_1.logVeryGood('watcher is ready.');
            var watchCount = 0;
            var watched = watcher.getWatched();
            Object.keys(watched).forEach(function (k) {
                watchCount += watched[k].length;
            });
            logging_1.logVeryGood('number of files being watched by suman-watch => ', watchCount);
            cb && cb(null, {
                watched: watched
            });
        });
        var killAndRestart = function () {
            watcher.close();
            k.kill('SIGINT');
            setImmediate(function () {
                exports.startWatching(watchOpts);
            });
        };
        var to;
        watcher.on('change', function (p) {
            if (utils_1.isPathMatchesSig(path.basename(p))) {
                clearTimeout(to);
                to = setTimeout(killAndRestart, 5000);
            }
        });
        watcher.on('add', function (p) {
            if (utils_1.isPathMatchesSig(path.basename(p))) {
                clearTimeout(to);
                to = setTimeout(killAndRestart, 5000);
            }
        });
        watcher.on('unlink', function (p) {
            if (utils_1.isPathMatchesSig(path.basename(p))) {
                clearTimeout(to);
                to = setTimeout(killAndRestart, 5000);
            }
        });
    });
};
