"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var process = require('suman-browser-polyfills/modules/process');
var global = require('suman-browser-polyfills/modules/global');
var chalk = require("chalk");
var name = ' [suman-watch] ';
exports.info = console.log.bind(console, chalk.cyan(name));
exports.good = console.log.bind(console, chalk.cyan(name));
exports.veryGood = console.log.bind(console, chalk.green(name));
exports.warning = console.error.bind(console, chalk.yellow.bold(name));
exports.warn = exports.warning;
exports.error = console.error.bind(console, chalk.red(name));
exports.newLine = function () {
    console.log('\n');
    console.error('\n');
};
var $exports = module.exports;
exports.default = $exports;
