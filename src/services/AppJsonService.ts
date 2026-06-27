import * as fs from 'fs';
import * as path from 'path';
import type { AssetKey } from '../models/assets';

type ConfigKind = 'app-json' | 'app-config-json' | 'package-json';

interface ConfigTarget {
    kind: ConfigKind;
    filePath: string;
}

const DEFAULT_DESTINATIONS: Record<AssetKey, { folder: string; fileName: string }> = {
    favicon: { folder: 'assets/images', fileName: 'favicon.png' },
    icon: { folder: 'assets/images', fileName: 'icon.png' },
    'splash-icon': { folder: 'assets/images', fileName: 'splash-icon.png' },
    'adaptive-icon': { folder: 'assets/images', fileName: 'adaptive-icon.png' },
};

export class AppJsonService {
    constructor(private workspacePath: string) { }

    private get appJsonPath() { return path.join(this.workspacePath, 'app.json'); }
    private get appConfigJsonPath() { return path.join(this.workspacePath, 'app.config.json'); }
    private get packageJsonPath() { return path.join(this.workspacePath, 'package.json'); }

    private findConfigTarget(): ConfigTarget {
        if (fs.existsSync(this.appJsonPath)) {
            return { kind: 'app-json', filePath: this.appJsonPath };
        }
        if (fs.existsSync(this.appConfigJsonPath)) {
            return { kind: 'app-config-json', filePath: this.appConfigJsonPath };
        }
        if (fs.existsSync(this.packageJsonPath)) {
            const pkg = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf-8'));
            if (pkg?.expo) {
                return { kind: 'package-json', filePath: this.packageJsonPath };
            }
        }

        const dynamicConfig = ['app.config.js', 'app.config.ts', 'app.config.mjs', 'app.config.cjs']
            .find((file) => fs.existsSync(path.join(this.workspacePath, file)));
        if (dynamicConfig) {
            throw new Error(`${dynamicConfig} is dynamic and cannot be updated safely. Use app.json or app.config.json for managed asset updates.`);
        }

        throw new Error('No static Expo config found. Add app.json or app.config.json to the workspace.');
    }

    private readTarget() {
        const target = this.findConfigTarget();
        return { target, json: JSON.parse(fs.readFileSync(target.filePath, 'utf-8')) };
    }

    private getExpoRoot(json: any, kind: ConfigKind) {
        if (kind === 'package-json') {
            json.expo = json.expo ?? {};
            return json.expo;
        }
        json.expo = json.expo ?? {};
        return json.expo;
    }

    read(): any {
        return this.readTarget().json;
    }

    write(json: any) {
        const { target } = this.readTarget();
        fs.writeFileSync(target.filePath, JSON.stringify(json, null, 2));
    }

    updateVersion(version: string) {
        const { target, json } = this.readTarget();
        const expo = this.getExpoRoot(json, target.kind);
        if (version) {
            expo.version = version;
        }
        fs.writeFileSync(target.filePath, JSON.stringify(json, null, 2));
    }

    setAssetPath(key: AssetKey, relPath: string) {
        const { target, json } = this.readTarget();
        const expo = this.getExpoRoot(json, target.kind);
        setExpoAssetPath(expo, key, relPath);
        fs.writeFileSync(target.filePath, JSON.stringify(json, null, 2));
    }

    getVersion(): string {
        const { target, json } = this.readTarget();
        const expo = this.getExpoRoot(json, target.kind);
        return expo?.version ?? '1.0.0';
    }

    getExistingAssetPath(key: AssetKey): string | undefined {
        const { target, json } = this.readTarget();
        const expo = this.getExpoRoot(json, target.kind);
        return getExpoAssetPath(expo, key);
    }

    getCurrentDestinations() {
        const result = { ...DEFAULT_DESTINATIONS };
        (Object.keys(DEFAULT_DESTINATIONS) as AssetKey[]).forEach((key) => {
            const rel = this.getExistingAssetPath(key);
            if (!rel) {
                return;
            }
            const normalized = rel.replace(/^\.?\//, '');
            const parts = normalized.split('/');
            const fileName = parts.pop();
            if (fileName) {
                result[key] = { folder: parts.join('/') || '.', fileName };
            }
        });
        return result;
    }
}

function getExpoAssetPath(expo: any, key: AssetKey): string | undefined {
    switch (key) {
        case 'icon':
            return expo?.icon;
        case 'favicon':
            return expo?.web?.favicon ?? expo?.favicon;
        case 'adaptive-icon':
            return expo?.android?.adaptiveIcon?.foregroundImage ?? expo?.adaptiveIcon?.foregroundImage;
        case 'splash-icon':
            return getSplashPluginImage(expo) ?? expo?.splash?.image ?? expo?.android?.splash?.image ?? expo?.ios?.splash?.image;
    }
}

function setExpoAssetPath(expo: any, key: AssetKey, relPath: string) {
    switch (key) {
        case 'icon':
            expo.icon = relPath;
            return;
        case 'favicon':
            expo.web = expo.web ?? {};
            expo.web.favicon = relPath;
            return;
        case 'adaptive-icon':
            expo.android = expo.android ?? {};
            expo.android.adaptiveIcon = expo.android.adaptiveIcon ?? {};
            expo.android.adaptiveIcon.foregroundImage = relPath;
            return;
        case 'splash-icon':
            if (!setSplashPluginImage(expo, relPath)) {
                expo.splash = expo.splash ?? {};
                expo.splash.image = relPath;
            }
            return;
    }
}

function getSplashPluginImage(expo: any): string | undefined {
    const entry = findSplashPluginEntry(expo);
    return Array.isArray(entry) ? entry[1]?.image : undefined;
}

function setSplashPluginImage(expo: any, relPath: string): boolean {
    const entry = findSplashPluginEntry(expo);
    if (!entry) {
        return false;
    }
    if (typeof entry === 'string') {
        const plugins = expo.plugins as any[];
        const index = plugins.indexOf(entry);
        plugins[index] = ['expo-splash-screen', { image: relPath }];
        return true;
    }
    entry[1] = entry[1] ?? {};
    entry[1].image = relPath;
    return true;
}

function findSplashPluginEntry(expo: any): string | any[] | undefined {
    if (!Array.isArray(expo?.plugins)) {
        return undefined;
    }
    return expo.plugins.find((plugin: any) => {
        if (plugin === 'expo-splash-screen') {
            return true;
        }
        return Array.isArray(plugin) && plugin[0] === 'expo-splash-screen';
    });
}
