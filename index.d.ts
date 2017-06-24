export interface ISumanWatchPerItem {
}
export interface ISumanWatchResult {
    code: number;
    stdout: string;
    stderr: string;
}
export interface ISumanWatchOptions {
    noTranspile?: boolean;
    noRun?: boolean;
    watchPer?: ISumanWatchPerItem;
}
export declare const startWatching: (watchOpts: ISumanWatchOptions, cb: Function) => void;
