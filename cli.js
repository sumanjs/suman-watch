"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var dashdash = require("dashdash");
var index = require("./index");
var options = require('./lib/cmd-opts');
var opts, parser = dashdash.createParser({ options: options });
try {
    opts = parser.parse(process.argv);
}
catch (e) {
    console.error('foo: error: %s', e.message);
    process.exit(1);
}
console.log("# opts:", opts);
console.log("# args:", opts._args);
if (opts.help) {
    var help = parser.help({ includeEnv: true }).trimRight();
    console.log('usage: node foo.js [OPTIONS]\n'
        + 'options:\n'
        + help);
    process.exit(0);
}
index.run(opts, function (err) {
    if (err) {
        throw err;
    }
    console.log('watch process ready.');
});
