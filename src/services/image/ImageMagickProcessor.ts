import { exec } from 'child_process';
import { IImageProcessor } from './IImageProcessor';

export class ImageMagickProcessor implements IImageProcessor {
    resizeTo(input: string, w: number, h: number, output: string) {
        return new Promise<void>((res, rej) => {
            exec(`magick convert "${input}" -resize ${w}x${h}! "${output}"`, (err) => (err ? rej(err) : res()));
        });
    }
}
