'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const util = require("util");
const path = require("path");
const async = require("async");
const su = require("suman-utils");
const chokidar = require("chokidar");
const chalk = require("chalk");
const logging_1 = require("./logging");
const utils_1 = require("./utils");
const make_transpile_all_1 = require("./make-transpile-all");
const run_changed_test_path_1 = require("./run-changed-test-path");
const alwaysIgnore = utils_1.getAlwaysIgnore();
const onSIG = function () {
    logging_1.log.warning('suman watch is exiting due to SIGTERM/SIGINT.');
    process.exit(139);
};
process.on('SIGINT', onSIG);
process.on('SIGTERM', onSIG);
exports.makeRun = function (projectRoot, $paths, sumanOpts) {
    return function run(sumanConfig, isRunNow, cb) {
        const testDir = process.env['TEST_DIR'];
        const testSrcDir = process.env['TEST_SRC_DIR'];
        if (!sumanConfig) {
            const p = path.resolve(projectRoot + '/suman.conf.js');
            logging_1.log.warning(`new suman.conf.js path => ${p}`);
            delete require.cache[p];
            logging_1.log.warning(`deleted suman.conf.js cache`);
            sumanConfig = require(p);
            logging_1.log.warning(`re-required suman.conf.js file.`);
        }
        const watchOpts = {
            noRun: sumanOpts.no_run,
            paths: $paths,
            noTranspile: sumanOpts.no_transpile
        };
        const runChangedTestPaths = run_changed_test_path_1.makeRunChangedTestPath(watchOpts, projectRoot);
        async.autoInject({
            getTransformPaths: function (cb) {
                if (watchOpts.noTranspile) {
                    logging_1.log.info('watch process will not get all transform paths, because we are not transpiling.');
                    return process.nextTick(cb);
                }
                su.findSumanMarkers(['@run.sh', '@transform.sh', '@config.json'], testDir, [], cb);
            },
            getIgnorePathsFromConfigs: function (getTransformPaths, cb) {
                utils_1.find(getTransformPaths, cb);
            },
            transpileAll: function (getTransformPaths, cb) {
                if (watchOpts.noTranspile) {
                    logging_1.log.info('watch process will not run transpile routine, because we are not transpiling.');
                    return process.nextTick(cb);
                }
                const runTranspileAll = make_transpile_all_1.makeTranspileAll(watchOpts, projectRoot);
                const paths = Object.keys(getTransformPaths).map(function (key) {
                    if (getTransformPaths[key]['@transform.sh']) {
                        return {
                            cwd: getTransformPaths[key],
                            basePath: path.resolve(key + '/@transform.sh'),
                            bashFilePath: path.resolve(key + '/@transform.sh')
                        };
                    }
                    if (getTransformPaths[key]['@config.json']) {
                        try {
                            const config = require(path.resolve(key + '/@config.json'));
                            const plugin = config['@transform']['plugin']['value'];
                            return {
                                cwd: getTransformPaths[key],
                                basePath: path.resolve(key + '/@config.json'),
                                bashFilePath: require(plugin).getTransformPath()
                            };
                        }
                        catch (err) {
                            logging_1.log.warning(err.message || err);
                            return {
                                cwd: getTransformPaths[key],
                                basePath: path.resolve(key + '/@config.json'),
                                bashFilePath: null
                            };
                        }
                    }
                })
                    .filter(i => i);
                runTranspileAll(paths, cb);
            }
        }, function (err, results) {
            if (err) {
                throw err;
            }
            console.log('\n');
            logging_1.log.good('Transpilation results:\n');
            results.transpileAll.forEach(function (t) {
                if (t.code > 0) {
                    logging_1.log.error('transform result error => ', util.inspect(t));
                }
                else {
                    logging_1.log.good(`transform result for => ${chalk.magenta(t.path.basePath)}`);
                    const stdout = String(t.stdout).split('\n').filter(i => i);
                    if (stdout.length > 0) {
                        console.log('\n');
                        console.log('stdout:\n');
                        stdout.forEach(function (l) {
                            logging_1.log.good('stdout:', l);
                        });
                    }
                    const stderr = String(t.stderr).split('\n').filter(i => i);
                    if (stderr.length > 0) {
                        logging_1.log.error('\nstderr:\n');
                        stderr.forEach(function (l) {
                            logging_1.log.warning('stderr:', l);
                        });
                    }
                    logging_1.log.newLine();
                }
            });
            const moreIgnored = results.getIgnorePathsFromConfigs.filter(function (item) {
                return item && item.data && item.data['@target'] && item.data['@target']['marker'];
            })
                .map(function (item) {
                return '^' + path.dirname(item.path) + '/(.*\/)?' + (String(item.data['@target']['marker']).replace(/^\/+/, ''));
            });
            let watcher = chokidar.watch(testDir, {
                persistent: true,
                ignoreInitial: true,
                ignored: alwaysIgnore.concat(moreIgnored).map(v => new RegExp(v))
            });
            watcher.on('error', function (e) {
                logging_1.log.error('watcher experienced an error', e.stack || e);
            });
            watcher.once('ready', function () {
                logging_1.log.veryGood('watcher is ready.');
                let watchCount = 0;
                let watched = watcher.getWatched();
                Object.keys(watched).forEach(function (k) {
                    watchCount += watched[k].length;
                });
                logging_1.log.veryGood('number of files being watched by suman-watch => ', watchCount);
                cb && cb(null, { watched });
            });
            let running = {
                k: null
            };
            let killAndRestart = function () {
                watcher.close();
                running.k && running.k.kill('SIGKILL');
                setImmediate(run, null, false, null);
            };
            let to;
            let restartProcess = function () {
                logging_1.log.warning(`we will ${chalk.magenta.bold('refresh')} the watch processed based on this event, in 2 seconds 
            if no other changes occur in the meantime.`);
                clearTimeout(to);
                to = setTimeout(killAndRestart, 2000);
            };
            let onEvent = function (eventName) {
                return function (p) {
                    logging_1.log.good(chalk.grey(`${eventName} event for path:`), `${chalk.magenta.bold(`"${p}"`)}`);
                    const inRequireCache = require.cache[p];
                    delete require.cache[p];
                    if (inRequireCache) {
                        logging_1.log.warning('the following file was in the require cache => ', p);
                        logging_1.log.warning('therefore we will restart the whole watch process.');
                        restartProcess();
                    }
                    else if (utils_1.isPathMatchesSig(path.basename(p))) {
                        logging_1.log.warning('the following file was a "signifcant" file => ', p);
                        logging_1.log.warning('therefore we will restart the whole watch process.');
                        restartProcess();
                    }
                    else {
                        runChangedTestPaths(p);
                    }
                };
            };
            watcher.on('change', onEvent('change'));
            watcher.on('add', onEvent('add'));
            watcher.on('unlink', onEvent('unlink'));
        });
    };
};
