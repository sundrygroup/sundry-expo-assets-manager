import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
    AiAssetService,
    getAssetGenerationSize,
    mapOpenAiError,
    resolveOpenAiApiKey,
} from '../../src/services/AiAssetService';

describe('AiAssetService', () => {
    const tmp = path.join(__dirname, '..', '.tmp-ai');
    const appPath = path.join(tmp, 'app.json');
    const packagePath = path.join(tmp, 'package.json');

    beforeEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
        fs.mkdirSync(tmp, { recursive: true });
        fs.writeFileSync(appPath, JSON.stringify({
            expo: {
                name: 'Sundry Showroom',
                slug: 'sundry-showroom',
                description: 'Inventory tools for premium retail assets',
                version: '1.2.3',
            },
        }, null, 2));
        fs.writeFileSync(packagePath, JSON.stringify({
            name: 'sundry-showroom',
            description: 'Expo app for asset teams',
            dependencies: {
                expo: '^52.0.0',
                react: '^18.0.0',
            },
        }, null, 2));
    });

    it('maps asset keys to OpenAI generation sizes', () => {
        expect(getAssetGenerationSize('favicon')).toBe('1024x1024');
        expect(getAssetGenerationSize('icon')).toBe('1024x1024');
        expect(getAssetGenerationSize('splash-icon')).toBe('1280x720');
        expect(getAssetGenerationSize('adaptive-icon')).toBe('1088x1088');
    });

    it('builds prompts with Expo requirements and project context', () => {
        const service = new AiAssetService(tmp, vi.fn() as any);
        const prompt = service.buildPrompt({
            key: 'adaptive-icon',
            description: 'Use a green monogram on charcoal.',
            contextMode: 'expoConfigAndPackage',
        });

        expect(prompt).toContain('1080x1080 PNG');
        expect(prompt).toContain('Android adaptive icon');
        expect(prompt).toContain('safe padding');
        expect(prompt).toContain('Sundry Showroom');
        expect(prompt).toContain('Use a green monogram on charcoal.');
    });

    it('can build prompts without project context', () => {
        const service = new AiAssetService(tmp, vi.fn() as any);
        const prompt = service.buildPrompt({
            key: 'splash-icon',
            contextMode: 'none',
        });

        expect(prompt).toContain('1280x720 PNG');
        expect(prompt).not.toContain('Project context');
    });

    it('uses secret, config, then environment API key precedence', () => {
        expect(resolveOpenAiApiKey({
            secret: ' secret-key ',
            configuration: 'config-key',
            environment: 'env-key',
        })).toBe('secret-key');

        expect(resolveOpenAiApiKey({
            configuration: 'config-key',
            environment: 'env-key',
        })).toBe('config-key');

        expect(resolveOpenAiApiKey({
            environment: 'env-key',
        })).toBe('env-key');
    });

    it('posts image generation requests and returns base64 PNG content', async () => {
        const fetchImpl = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ data: [{ b64_json: 'abc123' }] }),
        });
        const service = new AiAssetService(tmp, fetchImpl as any);

        const file = await service.generateAsset({
            key: 'icon',
            description: 'Blue mark',
            apiKey: 'test-key',
            model: 'gpt-image-2',
            quality: 'medium',
            outputFormat: 'png',
            contextMode: 'none',
        });

        const [, init] = fetchImpl.mock.calls[0];
        const body = JSON.parse(init.body);
        expect(init.headers.Authorization).toBe('Bearer test-key');
        expect(body.model).toBe('gpt-image-2');
        expect(body.size).toBe('1024x1024');
        expect(body.quality).toBe('medium');
        expect(body.output_format).toBe('png');
        expect(file).toEqual({ name: 'ai-icon.png', content: 'abc123' });
    });

    it('explains failures when OpenAI returns an image URL that cannot be downloaded', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                json: async () => ({ data: [{ url: 'https://example.test/generated.png' }] }),
            })
            .mockRejectedValueOnce(new Error('Failed to fetch'));
        const service = new AiAssetService(tmp, fetchImpl as any);

        await expect(service.generateAsset({
            key: 'icon',
            apiKey: 'test-key',
            model: 'gpt-image-2',
            quality: 'medium',
            outputFormat: 'png',
            contextMode: 'none',
        })).rejects.toThrow('could not download the returned image URL');
    });

    it('maps common OpenAI errors to user-facing messages', () => {
        expect(mapOpenAiError(401, { error: { message: 'bad key' } })).toContain('API key');
        expect(mapOpenAiError(429, { error: { message: 'quota exceeded' } })).toBe('quota exceeded');
        expect(mapOpenAiError(400, { error: { message: 'Blocked by safety policy' } })).toContain('safety policy');
        expect(mapOpenAiError(500, {})).toContain('temporarily unavailable');
    });
});
