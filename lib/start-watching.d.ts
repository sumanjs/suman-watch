export interface ISumanWatchResult {
    code: number;
    stdout: string;
    stderr: string;
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
export declare const run: (projectRoot: string, watchOpts: any, cb?: Function) => void;
