export interface ISumanWatchPerItem {
}
export interface ISumanWatchResult {
    code: number;
    stdout: string;
    stderr: string;
}
export interface ISumanWatchOptions {
    paths: Array<string>;
    noTranspile?: boolean;
    noRun?: boolean;
    watchPer?: ISumanWatchPerItem;
}
export interface ISumanTransformResult {
    stdout: string;
    stderr: string;
    code: number;
    path: string;
}
export interface ISumanTranspileData {
    cwd: string;
    basePath: string;
    bashFilePath: string;
}
export declare const startWatching: (watchOpts: ISumanWatchOptions, cb: Function) => void;
