import { ISumanWatchOptions } from "../index";
import { INearestRunAndTransformRet } from 'suman-utils';
export declare const makeExecute: (watchOptions: ISumanWatchOptions, projectRoot: string) => (f: string, runData: INearestRunAndTransformRet, $cb: Function) => void;
