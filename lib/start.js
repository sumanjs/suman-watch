#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const su = require("suman-utils");
const chokidar = require("chokidar");
const chalk = require("chalk");
const make_transpile_1 = require("./make-transpile");
const make_execute_1 = require("./make-execute");
const utils_1 = require("./utils");
const logging_1 = require("./logging");
const testDir = process.env['TEST_DIR'];
const ignored = JSON.parse(process.env['SUMAN_TOTAL_IGNORED']);
const projectRoot = process.env['SUMAN_PROJECT_ROOT'];
const watchOpts = JSON.parse(process.env['SUMAN_WATCH_OPTS']);
const transpile = make_transpile_1.makeTranspile(watchOpts, projectRoot);
const execute = make_execute_1.makeExecute(watchOpts, projectRoot);
let watcher = chokidar.watch(testDir, {
    persistent: true,
    ignoreInitial: true,
    ignored: utils_1.getAlwaysIgnore().concat(ignored).map((v) => new RegExp(v))
});
process.once('exit', function () {
    watcher.close();
});
process.once('SIGINT', function () {
    watcher.once('close', function () {
        console.log('watch is closed due to SIGINT event.');
        process.exit(0);
    });
    watcher.close();
});
watcher.on('error', function (e) {
    logging_1.default.error('watcher experienced an error', e.stack || e);
});
watcher.once('ready', function () {
    logging_1.default.veryGood('watcher is ready.');
    let watchCount = 0;
    let watched = watcher.getWatched();
    Object.keys(watched).forEach(function (k) {
        watchCount += watched[k].length;
    });
    logging_1.default.veryGood('number of files being watched by suman-watch => ', watchCount);
});
watcher.on('change', function (f) {
    if (utils_1.isPathMatchesSig(path.basename(f))) {
        return;
    }
    let dn = path.basename(path.dirname(f));
    const canonicalDirname = String('/' + dn + '/').replace(/\/+/g, '/');
    let originalFile;
    let resolvedWithRoot = false;
    if (!path.isAbsolute(f)) {
        originalFile = f;
        f = path.resolve(projectRoot + '/' + f);
        resolvedWithRoot = true;
    }
    try {
        fs.statSync(f);
    }
    catch (err) {
        if (originalFile) {
            logging_1.default.error('file was resolved against project root => ', originalFile);
            logging_1.default.error(`this file may have been resolved incorrectly; it was resolved to: "${f}".`);
            throw new Error(`'suman-watch' implementation error - watched paths must be absolute -> \n\t "${originalFile}"`);
        }
    }
    delete require.cache[f];
    logging_1.default.info('file change event for path => ', f);
    su.findNearestRunAndTransform(projectRoot, f, function (err, ret) {
        if (err) {
            logging_1.default.error(`error locating @run.sh / @transform.sh for file ${f}.\n${err}`);
            return;
        }
        let matched = false;
        try {
            if (ret.config) {
                const config = require(ret.config);
                const match = config['@src']['marker'];
                const canonicalMatch = String('/' + match + '/').replace(/\/+/g, '/');
                if (canonicalDirname.match(new RegExp(canonicalMatch))) {
                    matched = true;
                }
            }
        }
        catch (err) {
            logging_1.default.error(err.stack || err);
        }
        finally {
            if (dn.match(/\/@src\//)) {
                matched = true;
            }
        }
        if (!matched) {
            logging_1.default.error('file will not be transpiled.');
        }
        transpile(f, ret, matched, function (err) {
            if (err) {
                logging_1.default.error(`error running transpile process for file ${f}.\n${err}`);
                return;
            }
            execute(f, ret, function (err, result) {
                if (err) {
                    logging_1.default.error(`error executing corresponding test process for source file ${f}.\n${err.stack || err}`);
                    return;
                }
                const { stdout, stderr, code } = result;
                if (code === -1) {
                    return;
                }
                if (code === undefined) {
                    logging_1.default.warning('suman-watcher implementation warning, exit code was undefined.');
                }
                console.log('\n');
                logging_1.default.info(`your corresponding test process for path ${f}, exited with code ${code}`);
                if (code > 0) {
                    logging_1.default.error(`there was an error executing your test with path ${f}, because the exit code was greater than 0.`);
                }
                if (stderr) {
                    logging_1.default.warning(`the stderr for path ${f}, is as follows =>\n${chalk.yellow(stderr)}.`);
                    console.log('\n');
                }
            });
        });
    });
});
