#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var process = require('suman-browser-polyfills/modules/process');
var global = require('suman-browser-polyfills/modules/global');
var util = require("util");
var path = require("path");
var cp = require("child_process");
var async = require("async");
var suman_utils_1 = require("suman-utils");
var chokidar = require("chokidar");
var chalk = require("chalk");
var prepend_transform_1 = require("prepend-transform");
var logging_1 = require("./logging");
var utils_1 = require("./utils");
var make_transpile_all_1 = require("./make-transpile-all");
var alwaysIgnore = utils_1.getAlwaysIgnore();
var onSIG = function () {
    logging_1.default.info('suman watch is exiting.');
    process.exit(139);
};
process.on('SIGINT', onSIG);
process.on('SIGTERM', onSIG);
exports.run = function (watchOpts, cb) {
    var projectRoot = suman_utils_1.default.findProjectRoot(process.cwd());
    var testDir = process.env['TEST_DIR'];
    var testSrcDir = process.env['TEST_SRC_DIR'];
    var transpileAll = make_transpile_all_1.makeTranspileAll(watchOpts, projectRoot);
    var p = path.resolve(projectRoot + '/suman.conf.js');
    delete require.cache[p];
    var sumanConfig = require(p);
    async.autoInject({
        getTransformPaths: function (cb) {
            if (watchOpts.noTranspile) {
                logging_1.default.info('watch process will not get all transform paths, because we are not transpiling.');
                return process.nextTick(cb);
            }
            suman_utils_1.default.findSumanMarkers(['@run.sh', '@transform.sh', '@config.json'], testDir, [], cb);
        },
        getIgnorePathsFromConfigs: function (getTransformPaths, cb) {
            utils_1.find(getTransformPaths, cb);
        },
        transpileAll: function (getTransformPaths, cb) {
            if (watchOpts.noTranspile) {
                logging_1.default.info('watch process will not run transpile-all routine, because we are not transpiling.');
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
                        logging_1.default.warning(err.message || err);
                        return {
                            cwd: getTransformPaths[key],
                            basePath: path.resolve(key + '/@config.json'),
                            bashFilePath: null
                        };
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
        console.log('\n');
        logging_1.default.good('Transpilation results:\n');
        results.transpileAll.forEach(function (t) {
            if (t.code > 0) {
                logging_1.default.error('transform result error => ', util.inspect(t));
            }
            else {
                logging_1.default.good("transform result for => " + chalk.magenta(t.path.basePath));
                var stdout = String(t.stdout).split('\n').filter(function (i) { return i; });
                if (stdout.length > 0) {
                    console.log('\n');
                    console.log('stdout:\n');
                    stdout.forEach(function (l) {
                        logging_1.default.good('stdout:', l);
                    });
                }
                var stderr = String(t.stderr).split('\n').filter(function (i) { return i; });
                if (stderr.length > 0) {
                    console.error('\nstderr:\n');
                    stderr.forEach(function (l) {
                        logging_1.default.warning('stderr:', l);
                    });
                }
                logging_1.default.newLine();
            }
        });
        var moreIgnored = results.getIgnorePathsFromConfigs.filter(function (item) {
            return item && item.data && item.data['@target'] && item.data['@target']['marker'];
        })
            .map(function (item) {
            return '^' + path.dirname(item.path) + '/(.*\/)?' + (String(item.data['@target']['marker']).replace(/^\/+/, ''));
        });
        var startScript = path.resolve(__dirname + '/start.js');
        var k = cp.spawn(startScript, [], {
            detached: false,
            cwd: projectRoot,
            env: Object.assign({}, process.env, {
                SUMAN_TOTAL_IGNORED: JSON.stringify(moreIgnored),
                SUMAN_PROJECT_ROOT: projectRoot,
                SUMAN_WATCH_OPTS: JSON.stringify(watchOpts)
            }),
            stdio: ['pipe', 'pipe', 'pipe', 'ipc']
        });
        k.stdout.pipe(prepend_transform_1.default(chalk.black.bold(' [watch-worker] '))).pipe(process.stdout);
        k.stderr.pipe(prepend_transform_1.default(chalk.yellow(' [watch-worker] '))).pipe(process.stderr);
        var watcher = chokidar.watch(testDir, {
            persistent: true,
            ignoreInitial: true,
            ignored: alwaysIgnore.concat(moreIgnored).map(function (v) { return new RegExp(v); })
        });
        watcher.on('error', function (e) {
            logging_1.default.error('watcher experienced an error', e.stack || e);
        });
        watcher.once('ready', function () {
            logging_1.default.veryGood('watcher is ready.');
            var watchCount = 0;
            var watched = watcher.getWatched();
            Object.keys(watched).forEach(function (k) {
                watchCount += watched[k].length;
            });
            logging_1.default.veryGood('number of files being watched by suman-watch => ', watchCount);
            cb && cb(null, {
                watched: watched
            });
        });
        var killAndRestart = function () {
            watcher.close();
            k.kill('SIGINT');
            setImmediate(function () {
                exports.run(watchOpts);
            });
        };
        var to;
        var onEvent = function (eventName) {
            return function (p) {
                logging_1.default.info(eventName, 'event :', p);
                var inRequireCache = require.cache[p];
                delete require.cache[p];
                logging_1.default.warning('the following file was in the require cache => ', p);
                logging_1.default.warning('therefore we will restart the whole watch process.');
                if (inRequireCache || utils_1.isPathMatchesSig(path.basename(p))) {
                    logging_1.default.warning("we will " + chalk.magenta.bold('refresh') + " the watch processed based on this event, in 5 seconds \n            if no other changes occur in the meantime.");
                    clearTimeout(to);
                    to = setTimeout(killAndRestart, 8000);
                }
            };
        };
        watcher.on('change', onEvent('change'));
        watcher.on('add', onEvent('add'));
        watcher.on('unlink', onEvent('unlink'));
    });
};
