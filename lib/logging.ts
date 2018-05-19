'use strict';

//polyfills
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');

//npm
import * as chalk from 'chalk';

//project
const name = ' [suman-watch] ';

///////////////////////////////////////////////////////////////////////////

export const log = {
  info: console.log.bind(console, name),
  good: console.log.bind(console, chalk.cyan(name)),
  veryGood: console.log.bind(console, chalk.green(name)),
  warning: console.log.bind(console, chalk.yellow.bold(name)),
  error: console.log.bind(console, chalk.red(name)),
  newLine: function () {
    console.log('\n');
    console.error('\n');
  }
};






