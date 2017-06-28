import { ISumanTranspileData, ISumanWatchOptions } from "../index";
export declare const makeTranspileAll: (watchOpts: ISumanWatchOptions, projectRoot: string) => (transformPaths: ISumanTranspileData[], cb: AsyncResultArrayCallback<Error, Iterable<any>>) => void;
