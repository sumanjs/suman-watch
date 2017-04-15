//core
const util = require('util');
const path = require('path');
const fs = require('fs');
const cp = require('child_process');

//npm
const async = require('async');

////////////////////////////////////////////

module.exports = function (transformPaths, cb) {

  async.mapLimit(transformPaths, 5, function (t, cb) {

    const dir = path.dirname(t);
    const p = path.resolve(dir + '/target/.transpiled');

    fs.stat(p, function (err, stats) {

      if (err || !stats.isFile()) {

        console.log(' => src has not been transpiled => ', t);

        console.log(' => About to spawn => ', t);
        const k = cp.spawn(t, [], {
          env: Object.assign({}, process.env, {
            SUMAN_CHILD_TEST_PATH: null
          })
        });

        k.once('error', function(){
           console.error(' => child_process#spawn error for path => ', t);
        });

        k.once('close', function(code){
          k.unref();
          cb(null, {
            dir: dir,
            code: code
          });
        });

      }
      else {
        console.log(' => src path seems to be transpiled => ', t);
        process.nextTick(cb);
      }

    });

  }, cb);

};