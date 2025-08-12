import { describe, it, expect, vi } from 'vitest';
import * as is from '../../src/utils/isImageMagickInstalled';
import { createProcessor } from '../../src/services/image/processorFactory';

describe('processorFactory', () => {
    it('prefers ImageMagick', async () => {
        vi.spyOn(is, 'isImageMagickInstalled').mockResolvedValue(true);
        const p = await createProcessor();
        expect(p.constructor.name).toBe('ImageMagickProcessor');
    });
});
