import * as fs from 'fs';
import * as path from 'path';
import type { AssetKey, IncomingFile } from '../models/assets';
import { SIZE } from '../models/assets';
import { AppJsonService } from './AppJsonService';

export type AiAssetQuality = 'low' | 'medium' | 'high' | 'auto';
export type AiContextMode = 'expoConfigAndPackage' | 'none';

export interface AiAssetGenerateOptions {
    key: AssetKey;
    description?: string;
    apiKey: string;
    model: string;
    quality: AiAssetQuality;
    outputFormat: 'png';
    contextMode: AiContextMode;
}

export interface ApiKeySources {
    secret?: string;
    configuration?: string;
    environment?: string;
}

interface FetchLike {
    (input: string, init?: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
    }): Promise<{
        ok: boolean;
        status: number;
        statusText: string;
        json(): Promise<unknown>;
        arrayBuffer?(): Promise<ArrayBuffer>;
    }>;
}

const ASSET_PURPOSE: Record<AssetKey, string> = {
    favicon: 'small web favicon that remains recognizable at 32 by 32 pixels',
    icon: 'Expo app icon for app stores and home screens',
    'splash-icon': 'landscape splash image for an Expo app loading screen',
    'adaptive-icon': 'Android adaptive icon foreground image with safe padding for masks',
};

const PROMPT_RULES: Record<AssetKey, string> = {
    favicon: 'Use a simple symbol, high contrast, no small details, no text.',
    icon: 'Use a centered, high-contrast, app-store-safe composition. Avoid small text and avoid transparent edges.',
    'splash-icon': 'Use a landscape-safe composition with a central subject, generous background margin, and no small text.',
    'adaptive-icon': 'Use a centered foreground subject with generous padding for circular and rounded-square Android masks. Avoid small text.',
};

const GENERATION_SIZE: Record<AssetKey, string> = {
    favicon: '1024x1024',
    icon: '1024x1024',
    'splash-icon': '1280x720',
    'adaptive-icon': '1088x1088',
};

export function getAssetGenerationSize(key: AssetKey): string {
    return GENERATION_SIZE[key];
}

export function resolveOpenAiApiKey(sources: ApiKeySources): string | undefined {
    return firstNonEmpty(sources.secret) ?? firstNonEmpty(sources.configuration) ?? firstNonEmpty(sources.environment);
}

export class AiAssetService {
    constructor(
        private workspacePath: string,
        private fetchImpl: FetchLike = globalThis.fetch as FetchLike,
    ) { }

    buildPrompt(options: Pick<AiAssetGenerateOptions, 'key' | 'description' | 'contextMode'>): string {
        const [width, height] = SIZE[options.key];
        const parts = [
            `Create a production-ready ${ASSET_PURPOSE[options.key]}.`,
            `Final Expo asset requirement: ${width}x${height} PNG.`,
            PROMPT_RULES[options.key],
            'Make the image polished, modern, legible at the target size, and suitable for a mobile app brand asset.',
        ];

        const context = options.contextMode === 'expoConfigAndPackage' ? this.readProjectContext() : '';
        if (context) {
            parts.push(`Project context:\n${context}`);
        }

        const description = firstNonEmpty(options.description);
        if (description) {
            parts.push(`User description:\n${description}`);
        }

        return parts.join('\n\n');
    }

    async generateAsset(options: AiAssetGenerateOptions): Promise<IncomingFile> {
        const apiKey = firstNonEmpty(options.apiKey);
        if (!apiKey) {
            throw new Error('OpenAI API key is missing. Run "Expo Asset Manager: Set OpenAI API Key" or set OPENAI_API_KEY.');
        }

        let response;
        try {
            response = await this.fetchImpl('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: options.model || 'gpt-image-2',
                    prompt: this.buildPrompt(options),
                    size: getAssetGenerationSize(options.key),
                    quality: options.quality || 'medium',
                    output_format: options.outputFormat || 'png',
                    n: 1,
                }),
            });
        } catch (error) {
            throw new Error(`Could not reach OpenAI image generation API: ${readErrorMessage(error)}`);
        }

        const payload = await response.json();
        if (!response.ok) {
            throw new Error(mapOpenAiError(response.status, payload));
        }

        const b64 = await this.extractBase64(payload);
        return {
            name: `ai-${options.key}.png`,
            content: b64,
        };
    }

    private async extractBase64(payload: unknown): Promise<string> {
        const data = asRecord(payload).data;
        if (Array.isArray(data)) {
            const first = asRecord(data[0]);
            const b64 = first.b64_json ?? first.image_base64;
            if (typeof b64 === 'string' && b64.length > 0) {
                return b64;
            }
            if (typeof first.url === 'string' && first.url.length > 0) {
                let imageResponse;
                try {
                    imageResponse = await this.fetchImpl(first.url);
                } catch (error) {
                    throw new Error(`OpenAI generated the image, but VS Code could not download the returned image URL: ${readErrorMessage(error)}`);
                }
                if (!imageResponse.ok || !imageResponse.arrayBuffer) {
                    throw new Error('OpenAI returned an image URL that could not be downloaded.');
                }
                const buffer = Buffer.from(await imageResponse.arrayBuffer());
                return buffer.toString('base64');
            }
        }

        throw new Error('OpenAI did not return image data.');
    }

    private readProjectContext(): string {
        const context: string[] = [];
        try {
            const app = new AppJsonService(this.workspacePath);
            const raw = app.read();
            const expo = raw?.expo ?? {};
            const appContext = compactRecord({
                name: expo.name,
                slug: expo.slug,
                scheme: expo.scheme,
                owner: expo.owner,
                description: expo.description,
                version: expo.version,
                icon: expo.icon,
                primaryColor: expo.primaryColor,
                backgroundColor: expo.backgroundColor,
            });
            if (Object.keys(appContext).length > 0) {
                context.push(`Expo config: ${JSON.stringify(appContext)}`);
            }
        } catch {
            // Missing dynamic config should not block generation; the panel already surfaces config errors elsewhere.
        }

        try {
            const packageJsonPath = path.join(this.workspacePath, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                const packageContext = compactRecord({
                    name: pkg.name,
                    description: pkg.description,
                    keywords: Array.isArray(pkg.keywords) ? pkg.keywords.slice(0, 12) : undefined,
                    dependencies: Object.keys(pkg.dependencies ?? {}).slice(0, 30),
                });
                if (Object.keys(packageContext).length > 0) {
                    context.push(`Package metadata: ${JSON.stringify(packageContext)}`);
                }
            }
        } catch {
            // Package metadata is helpful, not required.
        }

        return context.join('\n');
    }
}

export function mapOpenAiError(status: number, payload: unknown): string {
    const message = readOpenAiMessage(payload);
    if (status === 401) {
        return 'OpenAI API key was rejected. Update the saved key and try again.';
    }
    if (status === 429) {
        return message || 'OpenAI rate limit or quota was reached. Try again later or check billing.';
    }
    if (status === 400 && /safety|moderation|policy/i.test(message)) {
        return message || 'OpenAI blocked the image request for safety policy reasons. Revise the description and try again.';
    }
    if (status >= 500) {
        return 'OpenAI image generation is temporarily unavailable. Try again later.';
    }
    return message || `OpenAI image generation failed (${status}).`;
}

function readOpenAiMessage(payload: unknown): string {
    const root = asRecord(payload);
    const error = asRecord(root.error);
    const message = error.message ?? root.message;
    return typeof message === 'string' ? message : '';
}

function readErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function firstNonEmpty(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function compactRecord(input: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(input).filter(([, value]) => {
        if (value === undefined || value === null) {
            return false;
        }
        if (Array.isArray(value)) {
            return value.length > 0;
        }
        return String(value).trim().length > 0;
    }));
}
