import { exec } from 'child_process';
export function isImageMagickInstalled(): Promise<boolean> {
    return new Promise((resolve) => exec('magick -version', (err) => resolve(!err)));
}
