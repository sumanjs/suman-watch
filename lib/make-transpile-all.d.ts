/// <reference types="async" />
import { ISumanTranspileData, ISumanWatchOptions } from "./start-watching";
export declare const makeTranspileAll: (watchOpts: ISumanWatchOptions, projectRoot: string) => (transformPaths: ISumanTranspileData[], cb: AsyncResultArrayCallback<Iterable<any>, Error>) => void;
