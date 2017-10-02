/// <reference types="async" />
import { ISumanTranspileData } from "./start-watching";
export declare const makeTranspileAll: (watchOpts: any, projectRoot: string) => (transformPaths: ISumanTranspileData[], cb: AsyncResultArrayCallback<Iterable<any>, Error>) => void;
