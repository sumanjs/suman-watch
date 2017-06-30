import { IMap } from 'suman-utils';
export declare const getAlwaysIgnore: () => string[];
export declare const isPathMatchesSig: (basename: string) => boolean;
export declare const find: (getTransformPaths: IMap, cb: AsyncResultArrayCallback<Error, Iterable<any>>) => void;
