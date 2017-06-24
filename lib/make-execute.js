"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var cp = require("child_process");
var suman_utils_1 = require("suman-utils");
exports.makeExecute = function (watchOptions, projectRoot) {
    return function (f, runPath, cb) {
        suman_utils_1.default.makePathExecutable(runPath, function (err) {
            if (err) {
                return cb(err);
            }
            var k;
            if (runPath) {
                k = cp.spawn(runPath, [], {
                    cwd: projectRoot,
                    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
                    env: Object.assign({}, process.env, {
                        SUMAN_CHILD_TEST_PATH: f
                    })
                });
            }
            else {
                k = cp.spawn(f, [], {
                    cwd: projectRoot,
                    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
                    env: Object.assign({}, process.env, {
                        SUMAN_CHILD_TEST_PATH: f
                    })
                });
            }
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
            k.once('close', function (code) {
                cb(null, {
                    code: code,
                    stdout: String(stdout).trim(),
                    stderr: String(stderr).trim()
                });
            });
        });
    };
};
