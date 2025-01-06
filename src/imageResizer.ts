import sharp from "sharp";
// import * as path from "path";
// import * as fs from "fs";

export async function resizeImage(
    inputPath: string,
    outputPath: string,
    width: number,
    height: number
): Promise<void> {
    await sharp(inputPath)
        .resize(width, height)
        .toFile(outputPath);
}
