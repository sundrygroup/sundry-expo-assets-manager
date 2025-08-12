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
});
