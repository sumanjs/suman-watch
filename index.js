'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var process = require('suman-browser-polyfills/modules/process');
var global = require('suman-browser-polyfills/modules/global');
var util = require("util");
var path = require("path");
var logging_1 = require("./lib/logging");
var async = require("async");
var suman_utils_1 = require("suman-utils");
var chokidar = require("chokidar");
var chalk = require("chalk");
var make_transpile_1 = require("./lib/make-transpile");
var make_execute_1 = require("./lib/make-execute");
var make_transpile_all_1 = require("./lib/make-transpile-all");
var alwaysIgnore = [
    '___jb_old___',
    '___jb_tmp___',
    '/node_modules/',
    '/.git/',
    '.*\.log$',
    '.*\.json$',
    '/logs/'
];
exports.startWatching = function (watchOpts, cb) {
    var onSIG = function () {
        logging_1.logInfo('suman watch is exiting.');
        process.exit(139);
    };
    process.on('SIGINT', onSIG);
    process.on('SIGTERM', onSIG);
    var projectRoot = suman_utils_1.default.findProjectRoot(process.cwd());
    var testDir = process.env['TEST_DIR'];
    var testSrcDir = process.env['TEST_SRC_DIR'];
    var transpile = make_transpile_1.makeTranspile(watchOpts, projectRoot);
    var transpileAll = make_transpile_all_1.makeTranspileAll(watchOpts, projectRoot);
    var execute = make_execute_1.makeExecute(watchOpts, projectRoot);
    async.autoInject({
        getTransformPaths: function (cb) {
            if (watchOpts.noTranspile) {
                logging_1.logInfo('watch process will not get all transform paths, because we are not transpiling.');
                return process.nextTick(cb);
            }
            suman_utils_1.default.findSumanMarkers(['@run.sh', '@transform.sh', '@config.json'], testDir, [], cb);
        },
        transpileAll: function (getTransformPaths, cb) {
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
        var watcher = chokidar.watch(testSrcDir, {
            cwd: projectRoot,
            persistent: true,
            ignoreInitial: true,
            ignored: [
                /___jb_old___/,
                /___jb_tmp___/,
                /(\/@target\/|\/node_modules\/|@run.sh$|@transform.sh$|.*\.log$|.*\.json$|\/logs\/)/
            ]
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
        watcher.on('change', function (f) {
            logging_1.logInfo('file change event for path => ', f);
            suman_utils_1.default.findNearestRunAndTransform(projectRoot, f, function (err, ret) {
                if (err) {
                    logging_1.logError("error locating @run.sh / @transform.sh for file " + f + ".\n" + err);
                    return;
                }
                transpile(f, ret, function (err) {
                    if (err) {
                        logging_1.logError("error running transpile process for file " + f + ".\n" + err);
                        return;
                    }
                    execute(f, ret, function (err, result) {
                        if (err) {
                            logging_1.logError("error executing corresponding test process for source file " + f + ".\n" + (err.stack || err));
                            return;
                        }
                        var stdout = result.stdout, stderr = result.stderr, code = result.code;
                        console.log('\n');
                        console.error('\n');
                        logging_1.logInfo("your corresponding test process for path " + f + ", exited with code " + code);
                        if (code > 0) {
                            logging_1.logError("there was an error executing your test with path " + f + ", because the exit code was greater than 0.");
                        }
                        if (stderr) {
                            logging_1.logWarning("the stderr for path " + f + ", is as follows =>\n" + chalk.yellow(stderr) + ".");
                            console.error('\n');
                        }
                        if (stdout) {
                            logging_1.logInfo("the stdout for path " + f + ", is as follows =>\n" + stdout + ".");
                            console.log('\n');
                        }
                    });
                });
            });
        });
    });
};
