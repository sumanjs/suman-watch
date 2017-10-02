

//polyfills
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');

//npm
import * as chalk from 'chalk';

//project
const name = ' [suman-watcher] ';
export const info = console.log.bind(console, chalk.cyan(name));
export const good = console.log.bind(console, chalk.cyan(name));
export const veryGood = console.log.bind(console, chalk.green(name));
export const warning = console.error.bind(console, chalk.yellow.bold(name));
export const warn = warning;
export const error = console.error.bind(console, chalk.red(name));

export const newLine = function(){
  console.log('\n');
  console.error('\n');
};

// special exports
const $exports = module.exports;
export default $exports;
