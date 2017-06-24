'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var process = require('suman-browser-polyfills/modules/process');
var global = require('suman-browser-polyfills/modules/global');
var cp = require("child_process");
var logging_1 = require("./logging");
exports.makeTranspile = function (watchOpts, projectRoot) {
    return function _transpile(root, f, transformPath, cb) {
        console.log(' => transpiling...', '\n', transformPath);
        var k = cp.spawn(transformPath, [], {
            cwd: root,
            env: Object.assign({}, process.env, {
                SUMAN_CHILD_TEST_PATH: f
            })
        });
        k.once('error', function (e) {
            logging_1.logError("transform process experienced spawn error for path \"" + f + "\" =>\n" + (e.stack || e) + ".");
        });
        var stdout = '';
        k.stdout.setEncoding('utf8');
        k.stdout.on('data', function (d) {
            stdout += d;
        });
        var stderr = '';
        k.stderr.setEncoding('utf8');
        k.stderr.on('data', function (d) {
            stderr += d;
        });
        var to = setTimeout(function () {
            cb(new Error("transform process timed out for path \"" + f + "\"."), {
                stdout: String(stdout).trim(),
                stderr: String(stderr).trim()
            });
        }, 1000000);
        k.once('exit', function (code) {
            clearTimeout(to);
            var err;
            if (code > 0) {
                console.error(' => There was an error transforming your tests.');
                err = new Error("transform process at path \"" + f + "\" exited with non-zero exit code =>\n" + stderr);
            }
            cb(err, {
                code: code,
                stdout: String(stdout).trim(),
                stderr: String(stderr).trim()
            });
        });
    };
};
