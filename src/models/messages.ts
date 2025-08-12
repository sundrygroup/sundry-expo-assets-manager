import type { AssetKey } from './assets';

export type ToWebview =
    | { type: 'initialize'; appVersion: string; previews: Partial<Record<AssetKey, string>>; destinations: Record<AssetKey, { folder: string; fileName: string }> }
    | { type: 'updated-previews'; previews: Partial<Record<AssetKey, string>> }
    | { type: 'error'; message: string };

export type FromWebview =
    | { type: 'ready' }
    | { type: 'refresh' }
    | { type: 'update-assets'; data: import('./assets').UpdatePayload }
    | { type: 'select-source-folder' }
    | { type: 'set-destination'; key: AssetKey; folder: string; fileName: string };
