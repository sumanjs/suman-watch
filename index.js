'use strict';

//core
const util = require('util');
const path = require('path');

//npm
const async = require('async');
const su = require('suman-utils');
let Server = require('socket.io');
const chokidar = require('chokidar');

//project
let io = new Server(6975, {});
let transpile = require('./lib/transpile');
let execute = require('./lib/execute');
let transpileAll = require('./lib/transpile-all');


////////////////////////////////////////////////////////

module.exports = function (obj, cb) {

  const onSIG = function (){
     console.log(' => [suman-watch] suman watch is exiting.');
     process.exit(139);
  };

  process.on('SIGINT', onSIG);
  process.on('SIGTERM', onSIG);

  const projectRoot = obj.projectRoot || su.findProjectRoot(process.cwd());
  const testSrcDir = process.env['TEST_SRC_DIR'];

  async.autoInject({

    getSrcPaths: function (cb) {
      su.findSumanMarkers(['@run.sh', '@transform.sh'], testSrcDir, [], cb);
    },

    transpileAll: function (getSrcPaths, cb) {

      const paths = Object.keys(getSrcPaths).filter(function (key) {
        return getSrcPaths[key]['@transform.sh'];
      })
      .map(function(k){
         return path.resolve(k + '/@transform.sh');
      });

      console.log('paths => ', paths);


      transpileAll(paths, cb);

    },

    startWatching: function (transpileAll, cb) {

      let watcher = chokidar.watch(testSrcDir, {
        ignored: /\/@target\//,
        persistent: true,
        initial: false
      });

      watcher.once('error', cb);
      watcher.once('ready', function () {
        cb(null, {
          watched: watcher.getWatched()
        });
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

    console.log(' => Transpilation results:');
    results.transpileAll.forEach(function(t){
      console.log(t);
    });

  });

};
