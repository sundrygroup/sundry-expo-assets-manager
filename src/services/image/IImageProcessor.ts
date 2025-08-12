export interface IImageProcessor {
    resizeTo(inputPath: string, width: number, height: number, outputPath: string): Promise<void>;
}
