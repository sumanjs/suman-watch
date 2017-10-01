import { INearestRunAndTransformRet } from "suman-types/dts/suman-utils";
import { ISumanWatchOptions } from "./start-watching";
export declare const makeTranspile: (watchOpts: ISumanWatchOptions, projectRoot: string) => (f: string, transformData: INearestRunAndTransformRet, isTranspile: boolean, cb: Function) => any;
