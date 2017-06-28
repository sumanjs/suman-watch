import { ISumanWatchOptions } from "../index";
import { INearestRunAndTransformRet } from 'suman-utils';
export declare const makeTranspile: (watchOpts: ISumanWatchOptions, projectRoot: string) => (f: string, transformData: INearestRunAndTransformRet, $cb: Function) => any;
