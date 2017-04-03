'use strict';

//core
const util = require('util');

//npm
const async = require('async');
const su = require('suman-utils');
let Server = require('socket.io');
const chokidar = require('chokidar');

//project
let io = new Server(6975, {});
let transpile = require('./lib/transpile');
let execute = require('./lib/execute');

////////////////////////////////////////////////////////

module.exports = function (obj, cb) {

  const projectRoot = obj.projectRoot || su.findProjectRoot(process.cwd());
  const testSrcDir = process.env.TEST_SRC_DIR;

  async.autoInject({

    // getSrcPaths: function(cb){
    //   su.findSumanMarkers(['@run.sh', '@transform.sh'], testSrcDir, [], cb);
    // },

    startWatching: function (cb) {

      let watcher = chokidar.watch(testSrcDir, {
        ignored: /\/@target\//,
        persistent: true,
        initial: false
      });

      watcher.once('error', cb);
      watcher.once('ready', function(){
        cb(null, watcher.getWatched());
      });

      watcher.on('change', function (f) {

        console.log(' => Change => ', f);

        su.findNearestRunAndTransform(projectRoot, f, function (err, ret) {
          if (ret.transform) {
            transpile(f, ret);
          }
          else {
            execute(f, ret);
          }

        });
      });

    }

  }, function (err, results) {

    if (err) {
      throw err;
    }

    console.log('=> Watching files => ', results);

  })

};
