import * as fs from 'fs';
import * as path from 'path';
import type { AssetKey } from '../models/assets';

export class AppJsonService {
    constructor(private workspacePath: string) { }

    private get appJsonPath() { return path.join(this.workspacePath, 'app.json'); }

    read(): any {
        if (!fs.existsSync(this.appJsonPath)) throw new Error('app.json not found');
        return JSON.parse(fs.readFileSync(this.appJsonPath, 'utf-8'));
    }

    write(json: any) {
        fs.writeFileSync(this.appJsonPath, JSON.stringify(json, null, 2));
    }

    updateVersion(version: string) {
        const app = this.read();
        app.expo = app.expo ?? {};
        if (version) app.expo.version = version;
        this.write(app);
    }

    /** Writes the relative path to app.json (e.g., "./assets/images/icon.png") */
    setAssetPath(key: AssetKey, relPath: string) {
        const app = this.read();
        app.expo = app.expo ?? {};
        app.expo[key] = relPath;
        this.write(app);
    }

    getVersion(): string {
        const app = this.read();
        return app?.expo?.version ?? '1.0.0';
    }

    getExistingAssetPath(key: AssetKey): string | undefined {
        const app = this.read();
        return app?.expo?.[key];
    }
}
