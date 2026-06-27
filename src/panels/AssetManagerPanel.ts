import * as vscode from 'vscode';
import * as path from 'path';
import { nonce } from '../utils/nonce';
import type { FromWebview, ToWebview } from '../models/messages';
import { AppJsonService } from '../services/AppJsonService';
import { AssetPathService } from '../services/AssetPathService';
import { createProcessor } from '../services/image/processorFactory';
import { SIZE, AssetKey, UpdatePayload } from '../models/assets';
import * as fs from 'fs';

export class AssetManagerPanel {
    static viewType = 'expoAssetManager';
    private disposables: vscode.Disposable[] = [];

    constructor(private context: vscode.ExtensionContext, private workspacePath: string) { }

    createOrReveal() {
        const panel = vscode.window.createWebviewPanel(
            AssetManagerPanel.viewType,
            'Expo Asset Manager',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, 'media'))],
            }
        );

        panel.onDidDispose(() => this.dispose(), null, this.disposables);

        // Build initial HTML
        panel.webview.html = this.getHtml(panel.webview);

        // Initial payload
        this.postInitialize(panel);

        // Messages
        panel.webview.onDidReceiveMessage((msg: FromWebview) => this.onMessage(panel, msg));

        return panel;
    }

    private getHtml(webview: vscode.Webview) {
        const htmlPath = path.join(this.context.extensionPath, 'media', 'index.html');
        let html = fs.readFileSync(htmlPath, 'utf-8');

        const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'main.js')));
        html = html.replace('{{scriptUri}}', scriptUri.toString());
        return html;
    }

    private postInitialize(panel: vscode.WebviewPanel) {
        const app = new AppJsonService(this.workspacePath);
        const version = app.getVersion();

        const previews: Partial<Record<AssetKey, string>> = {};
        (Object.keys(SIZE) as AssetKey[]).forEach((k) => {
            const rel = app.getExistingAssetPath(k);
            if (!rel) {
                return;
            }
            const abs = path.join(this.workspacePath, rel.replace(/^\.\//, ''));
            if (!fs.existsSync(abs)) {
                return;
            }
            const b64 = fs.readFileSync(abs).toString('base64');
            previews[k] = `data:image/png;base64,${b64}`;
        });

        const payload: ToWebview = {
            type: 'initialize',
            appVersion: version,
            previews,
            destinations: this.getCurrentDestinations(app),
        };
        panel.webview.postMessage(payload);
    }

    private getCurrentDestinations(app: AppJsonService) {
        const result: Record<AssetKey, { folder: string; fileName: string }> = {
            favicon: { folder: 'assets/images', fileName: 'favicon.png' },
            icon: { folder: 'assets/images', fileName: 'icon.png' },
            'splash-icon': { folder: 'assets/images', fileName: 'splash-icon.png' },
            'adaptive-icon': { folder: 'assets/images', fileName: 'adaptive-icon.png' },
        };
        (Object.keys(SIZE) as AssetKey[]).forEach((k) => {
            const rel = app.getExistingAssetPath(k);
            if (rel) {
                const m = rel.replace(/^\.\//, '').split('/');
                const fileName = m.pop()!;
                const folder = m.join('/');
                result[k] = { folder, fileName };
            }
        });
        return result;
    }

    private async onMessage(panel: vscode.WebviewPanel, msg: FromWebview) {
        try {
            if (msg.type === 'ready' || msg.type === 'refresh') {
                return this.postInitialize(panel);
            }

            if (msg.type === 'select-source-folder') {
                const pick = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false });
                if (pick?.[0]) {
                    panel.webview.postMessage({ type: 'refresh' }); // Webview will re-request initialize
                }
                return;
            }

            if (msg.type === 'set-destination') {
                const app = new AppJsonService(this.workspacePath);
                const { folder, fileName, key } = msg;
                const rel = `./${folder.replace(/^\.?\//, '')}/${fileName}`;
                app.setAssetPath(key, rel);
                return this.postInitialize(panel);
            }

            if (msg.type === 'update-assets') {
                await this.updateAssets(msg.data);
                return this.postInitialize(panel);
            }
        } catch (err: any) {
            panel.webview.postMessage({ type: 'error', message: err.message } satisfies ToWebview);
        }
    }

    private async updateAssets(data: UpdatePayload) {
        const app = new AppJsonService(this.workspacePath);
        const paths = new AssetPathService(this.workspacePath);
        const proc = await createProcessor();

        // version
        if (data.appVersion) {
            app.updateVersion(data.appVersion);
        }

        // files
        for (const [k, file] of Object.entries(data.files ?? {})) {
            const key: any = k as keyof typeof SIZE as any;
            if (!file) { continue; }

            const [w, h] = (SIZE as any)[key];
            const tmp = path.join(this.workspacePath, '.expo-asset-tmp', `${key}_${Date.now()}.tmp.png`);
            fs.mkdirSync(path.dirname(tmp), { recursive: true });
            fs.writeFileSync(tmp, Buffer.from(file.content, 'base64'));

            const dest = (data.destinations as any)?.[key] ?? { folder: 'assets/images', fileName: `${key}.png` };
            const { outputPath, appJsonPath } = paths.resolve(dest.folder, dest.fileName);

            await proc.resizeTo(tmp, w, h, outputPath);
            fs.unlinkSync(tmp);

            app.setAssetPath(key, appJsonPath);
        }
    }

    dispose() {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
