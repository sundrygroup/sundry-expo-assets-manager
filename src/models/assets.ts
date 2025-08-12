export type AssetKey = 'favicon' | 'icon' | 'splash-icon' | 'adaptive-icon';

export const SIZE: Record<AssetKey, readonly [number, number]> = {
    favicon: [32, 32],
    icon: [1024, 1024],
    'splash-icon': [1280, 720],
    'adaptive-icon': [1080, 1080],
} as const;

export interface IncomingFile {
    name: string;
    /** base64 (no data: prefix) */
    content: string;
}

export interface UpdatePayload {
    appVersion: string;
    files: Partial<Record<AssetKey, IncomingFile>>;
    /** New: per-asset custom destination; relative to workspace (e.g., "assets/images", fileName: "myicon.png") */
    destinations?: Partial<Record<AssetKey, { folder: string; fileName: string }>>;
}
