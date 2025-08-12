import * as Jimp from "jimp";
import { IImageProcessor } from './IImageProcessor';

export class JimpProcessor implements IImageProcessor {
    async resizeTo(input: string, w: number, h: number, output: string) {
        const img = await (Jimp as any).read(input);
        await img.resize(w, h).writeAsync(output);
    }
}
