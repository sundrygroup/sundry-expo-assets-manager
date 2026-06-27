import { ImageMagickProcessor } from './ImageMagickProcessor';
import { JimpProcessor } from './JimpProcessor';
import { isImageMagickInstalled } from '../../utils/isImageMagickInstalled';
import type { IImageProcessor } from './IImageProcessor';
import * as vscode from 'vscode';

export async function createProcessor(): Promise<IImageProcessor> {
    if (await isImageMagickInstalled()) {
        return new ImageMagickProcessor();
    }
    vscode.window.showWarningMessage(
        'ImageMagick not found. Falling back to Jimp (no WebP support).'
    );
    return new JimpProcessor();
}
