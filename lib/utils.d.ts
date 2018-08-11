import { ISumanOpts, ISumanConfig } from 'suman-types/dts/global';
import { IMap } from "suman-types/dts/suman-utils";
import { AsyncResultArrayCallback } from 'async';
export declare const getAlwaysIgnore: () => string[];
export declare const isPathMatchesSig: (basename: string) => boolean;
export declare const getWatchObj: (projectRoot: string, sumanOpts: ISumanOpts, sumanConfig?: ISumanConfig) => {
    watchObj: import("global").ISumanConfWatchPerItem;
    sumanConfig: ISumanConfig;
};
export declare const find: (getTransformPaths: IMap, cb: AsyncResultArrayCallback<Error, Iterable<any>>) => void;
declare const $exports: any;
export default $exports;
