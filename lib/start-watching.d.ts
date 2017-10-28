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
export declare const makeRun: (projectRoot: string, $paths: string[], sumanOpts: any) => (sumanConfig: any, isRunNow: boolean, cb?: Function) => void;
