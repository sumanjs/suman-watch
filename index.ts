import {ISumanWatchOptions} from "./start-watching";

export const run = function (projectRoot: string, watchOpts: ISumanWatchOptions, cb?: Function) {

  if (watchOpts.watchPer) {
    require('./lib/watch-per').run(projectRoot, watchOpts, cb);
  }
  else {
    require('./start-watching').run(projectRoot, watchOpts, cb);
  }

};