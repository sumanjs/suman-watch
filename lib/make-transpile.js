'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const fs = require("fs");
const util = require("util");
const cp = require("child_process");
const su = require("suman-utils");
const prepend_transform_1 = require("prepend-transform");
const chalk = require("chalk");
const logging_1 = require("./logging");
exports.makeTranspile = function (watchOpts, projectRoot) {
    return function transpile(f, transformData, isTranspile, cb) {
        if (isTranspile === false) {
            return process.nextTick(cb);
        }
        logging_1.log.info('transform data => ', util.inspect(transformData));
        let transformPath;
        const transformLength = transformData.transform ? transformData.transform.length : 0;
        if (transformData.config && transformData.config.length >= transformLength) {
            try {
                const config = require(transformData.config);
                try {
                    if (config['@transform']['prevent'] === true) {
                        logging_1.log.info('we are not transpiling this file because "prevent" is set to true in @config.json.');
                        return process.nextTick(cb);
                    }
                }
                catch (err) {
                }
                const plugin = config['@transform']['plugin']['value'];
                if (plugin) {
                    transformPath = require(plugin).getTransformPath();
                }
            }
            catch (err) {
            }
        }
        if (!transformPath) {
            if (transformData.transform) {
                transformPath = transformData.transform;
            }
            else {
                logging_1.log.error('no transform method could be found.');
                return process.nextTick(cb);
            }
        }
        su.makePathExecutable(transformPath, function (err) {
            if (err) {
                return cb(err);
            }
            const k = cp.spawn('bash', [], {
                detached: false,
                cwd: projectRoot,
                stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
                env: Object.assign({}, process.env, {
                    SUMAN_PROJECT_ROOT: projectRoot,
                    SUMAN_TEST_PATHS: JSON.stringify([f]),
                    SUMAN_TRANSFORM_ALL_SOURCES: 'no'
                })
            });
            fs.createReadStream(transformPath).pipe(k.stdin);
            k.once('error', function (e) {
                logging_1.log.error(`transform process experienced spawn error for path "${f}" =>\n${e.stack || e}.`);
            });
            let stdout = '';
            k.stdout.setEncoding('utf8');
            k.stdout.pipe(prepend_transform_1.pt(chalk.black.bold(' [watch-worker-transform] '))).pipe(process.stdout);
            k.stdout.on('data', function (d) {
                stdout += d;
            });
            let stderr = '';
            k.stderr.setEncoding('utf8');
            k.stderr.pipe(prepend_transform_1.pt(chalk.yellow(' [watch-worker-transform] '), { omitWhitespace: true })).pipe(process.stderr);
            k.stderr.on('data', function (d) {
                stderr += d;
            });
            let timedout = false;
            let onTimeout = function () {
                timedout = true;
                cb(new Error(`transform process timed out for path "${f}".`), {
                    stdout: String(stdout).trim(),
                    stderr: String(stderr).trim()
                });
            };
            const to = setTimeout(onTimeout, 100000);
            k.once('exit', function (code) {
                if (code > 0) {
                    logging_1.log.warning('transpilation may have failed, the process has exited with code => ', code);
                }
                else {
                    logging_1.log.info('transpilation process appears to be successful, and has exited with code => ', code);
                }
                clearTimeout(to);
                if (!timedout) {
                    let err;
                    if (code > 0) {
                        logging_1.log.error(' => There was an error transforming your tests.');
                        err = new Error(`transform process at path "${f}" exited with non-zero exit code =>\n${stderr}`);
                    }
                    cb(err, {
                        code,
                        path: f,
                        stdout: String(stdout).trim(),
                        stderr: String(stderr).trim()
                    });
                }
            });
        });
    };
};
