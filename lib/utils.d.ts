/// <reference types="async" />
import { ISumanOpts, ISumanConfig } from 'suman-types/dts/global';
export declare const getAlwaysIgnore: () => string[];
export declare const isPathMatchesSig: (basename: string) => boolean;
export declare const getWatchObj: (sumanOpts: ISumanOpts, sumanConfig?: ISumanConfig) => void;
export declare const find: (getTransformPaths: any, cb: AsyncResultArrayCallback<Error, Iterable<any>>) => void;
declare const $exports: any;
export default $exports;
