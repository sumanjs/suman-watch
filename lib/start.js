#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var path = require("path");
var fs = require("fs");
var suman_utils_1 = require("suman-utils");
var chokidar = require("chokidar");
var chalk = require("chalk");
var make_transpile_1 = require("./make-transpile");
var make_execute_1 = require("./make-execute");
var utils_1 = require("./utils");
var logging_1 = require("./logging");
var testDir = process.env['TEST_DIR'];
var ignored = JSON.parse(process.env['SUMAN_TOTAL_IGNORED']);
var projectRoot = process.env['SUMAN_PROJECT_ROOT'];
var watchOpts = JSON.parse(process.env['SUMAN_WATCH_OPTS']);
var transpile = make_transpile_1.makeTranspile(watchOpts, projectRoot);
var execute = make_execute_1.makeExecute(watchOpts, projectRoot);
var watcher = chokidar.watch(testDir, {
    persistent: true,
    ignoreInitial: true,
    ignored: utils_1.getAlwaysIgnore().concat(ignored).map(function (v) { return new RegExp(v); })
});
process.once('exit', function () {
    watcher.close();
});
process.on('SIGINT', function () {
    watcher.on('close', function () {
        process.exit(0);
    });
    watcher.close();
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
});
watcher.on('change', function (f) {
    if (utils_1.isPathMatchesSig(path.basename(f))) {
        return;
    }
    var dn = path.basename(path.dirname(f));
    console.log('dn => ', dn);
    var canonicalDirname = String('/' + dn + '/').replace(/\/+/g, '/');
    console.log('canonicalDirname => ', canonicalDirname);
    var originalFile;
    var resolvedWithRoot = false;
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
            console.error('file was resolved against project root => ', originalFile);
            console.error("this file may have been resolved incorrectly; it was resolved to \"" + f + "\".");
            throw new Error("suman watch implementation error - watched paths must be absolute - \"" + originalFile + "\"");
        }
    }
    delete require.cache[f];
    logging_1.default.info('file change event for path => ', f);
    suman_utils_1.default.findNearestRunAndTransform(projectRoot, f, function (err, ret) {
        if (err) {
            logging_1.default.error("error locating @run.sh / @transform.sh for file " + f + ".\n" + err);
            return;
        }
        var matched = false;
        try {
            var config = require(ret.config);
            var match = config['@src']['marker'];
            console.log('match => ', match);
            var canonicalMatch = String('/' + match + '/').replace(/\/+/g, '/');
            console.log('canonicalMatch => ', canonicalMatch);
            if (canonicalDirname.match(new RegExp(canonicalMatch))) {
                console.log('canonicalDirname matched canonicalMatch');
                console.log(canonicalDirname + " matched " + canonicalMatch);
                matched = true;
            }
        }
        catch (err) {
            console.error(err.stack);
            if (dn.match(/\/@src\//)) {
                matched = true;
            }
        }
        if (!matched) {
            logging_1.default.error('file will not be transpiled.');
        }
        transpile(f, ret, matched, function (err) {
            if (err) {
                logging_1.default.error("error running transpile process for file " + f + ".\n" + err);
                return;
            }
            execute(f, ret, function (err, result) {
                if (err) {
                    logging_1.default.error("error executing corresponding test process for source file " + f + ".\n" + (err.stack || err));
                    return;
                }
                var stdout = result.stdout, stderr = result.stderr, code = result.code;
                console.log('\n');
                console.error('\n');
                logging_1.default.info("your corresponding test process for path " + f + ", exited with code " + code);
                if (code > 0) {
                    logging_1.default.error("there was an error executing your test with path " + f + ", because the exit code was greater than 0.");
                }
                if (stderr) {
                    logging_1.default.warning("the stderr for path " + f + ", is as follows =>\n" + chalk.yellow(stderr) + ".");
                    console.error('\n');
                }
            });
        });
    });
});