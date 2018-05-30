import { ISumanConfig } from 'suman-types/dts/global';
export interface ISumanWatchPerItem {
    includes: string | Array<string>;
    excludes: string | RegExp | Array<string | RegExp>;
    include: string | Array<string>;
    exclude: string | RegExp | Array<string | RegExp>;
    exec: string;
    confOverride: Partial<ISumanConfig>;
}
export declare const runWatch: (projectRoot: string, paths: string[], sumanConfig: any, sumanOpts: any, cb: Function) => void;
export declare const plugins: any;
