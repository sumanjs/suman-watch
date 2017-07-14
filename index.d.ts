import { ISumanWatchOptions } from "./start-watching";
export interface ISumanWatchPerItem {
    includes: string | Array<string>;
    excludes: string | RegExp | Array<string | RegExp>;
    exec: string;
    confOverride: Partial<Object>;
}
export declare const run: (watchOpts: ISumanWatchOptions, cb?: Function) => void;
