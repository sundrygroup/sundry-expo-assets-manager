import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { AppJsonService } from '../../src/services/AppJsonService';

describe('AppJsonService', () => {
    const tmp = path.join(__dirname, '..', '.tmp');
    const appPath = path.join(tmp, 'app.json');

    beforeEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
        fs.mkdirSync(tmp, { recursive: true });
        fs.writeFileSync(appPath, JSON.stringify({ expo: { version: '1.2.3' } }, null, 2));
    });

    it('reads version', () => {
        const s = new AppJsonService(tmp);
        expect(s.getVersion()).toBe('1.2.3');
    });

    it('updates asset path', () => {
        const s = new AppJsonService(tmp);
        s.setAssetPath('icon' as any, './assets/images/icon.png');
        const json = JSON.parse(fs.readFileSync(appPath, 'utf-8'));
        expect(json.expo.icon).toBe('./assets/images/icon.png');
    });

    it('writes Expo nested asset structures', () => {
        const s = new AppJsonService(tmp);
        s.setAssetPath('favicon', './assets/images/favicon.png');
        s.setAssetPath('splash-icon', './assets/images/splash-icon.png');
        s.setAssetPath('adaptive-icon', './assets/images/adaptive-icon.png');

        const json = JSON.parse(fs.readFileSync(appPath, 'utf-8'));
        expect(json.expo.web.favicon).toBe('./assets/images/favicon.png');
        expect(json.expo.splash.image).toBe('./assets/images/splash-icon.png');
        expect(json.expo.android.adaptiveIcon.foregroundImage).toBe('./assets/images/adaptive-icon.png');
    });

    it('updates modern splash plugin config when present', () => {
        fs.writeFileSync(appPath, JSON.stringify({
            expo: {
                version: '1.2.3',
                plugins: [['expo-splash-screen', { image: './old.png' }]],
            },
        }, null, 2));

        const s = new AppJsonService(tmp);
        s.setAssetPath('splash-icon', './assets/images/splash-icon.png');

        const json = JSON.parse(fs.readFileSync(appPath, 'utf-8'));
        expect(json.expo.plugins[0][1].image).toBe('./assets/images/splash-icon.png');
    });

    it('reads app.config.json', () => {
        fs.rmSync(appPath);
        fs.writeFileSync(path.join(tmp, 'app.config.json'), JSON.stringify({ expo: { version: '2.0.0', icon: './icon.png' } }, null, 2));

        const s = new AppJsonService(tmp);
        expect(s.getVersion()).toBe('2.0.0');
        expect(s.getExistingAssetPath('icon')).toBe('./icon.png');
    });
});
