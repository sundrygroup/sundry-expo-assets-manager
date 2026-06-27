import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AppJsonService } from './services/AppJsonService';
import { AssetPathService } from './services/AssetPathService';
import { createProcessor } from './services/image/processorFactory';
import { SIZE, type AssetKey, type UpdatePayload } from './models/assets';

const STATE_KEY = 'expoAssetManager.sourcePath';
const ASSET_KEYS = Object.keys(SIZE) as AssetKey[];

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('expo-asset-manager.open', () => openPanel(context)),
        vscode.commands.registerCommand('expo-asset-manager.setSourceFolder', () => chooseSourcePath(context)),
        vscode.commands.registerCommand('expo-asset-manager.revealSourceFolder', () => revealSourcePath(context)),
    );
}

export function deactivate() { }

async function openPanel(ctx: vscode.ExtensionContext) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Open a folder to use Expo Asset Manager.');
        return;
    }

    const panel = vscode.window.createWebviewPanel('expoAssetManager', 'Expo Asset Manager', vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(ctx.extensionPath), workspaceFolder.uri],
    });

    panel.webview.html = getHtml(panel.webview, ctx);

    const refresh = async () => postInitialize(panel, ctx, workspaceFolder.uri.fsPath);
    panel.webview.onDidReceiveMessage(async (msg) => {
        try {
            switch (msg.type) {
                case 'ready':
                case 'refresh':
                    await refresh();
                    break;
                case 'choose-source-path':
                    await chooseSourcePath(ctx, panel);
                    await refresh();
                    break;
                case 'reveal-source-path':
                    await revealSourcePath(ctx);
                    break;
                case 'choose-asset-dir':
                    await chooseAssetDir(panel, msg.key);
                    break;
                case 'dropped-uris':
                    await hydrateDroppedUris(panel, msg.uris || [], msg.targetSlot || null);
                    break;
                case 'update-assets':
                    await updateAssets(workspaceFolder.uri.fsPath, msg.data);
                    vscode.window.showInformationMessage('Expo assets updated.');
                    await refresh();
                    break;
            }
        } catch (error: any) {
            panel.webview.postMessage({ type: 'error', message: error?.message ?? String(error) });
        }
    });
}

async function postInitialize(panel: vscode.WebviewPanel, ctx: vscode.ExtensionContext, workspacePath: string) {
    const config = new AppJsonService(workspacePath);
    const previews: Partial<Record<AssetKey, string>> = {};

    for (const key of ASSET_KEYS) {
        const rel = config.getExistingAssetPath(key);
        const abs = rel ? path.join(workspacePath, rel.replace(/^\.?\//, '')) : undefined;
        if (abs && fs.existsSync(abs)) {
            previews[key] = panel.webview.asWebviewUri(vscode.Uri.file(abs)).toString();
        }
    }

    panel.webview.postMessage({
        type: 'initialize',
        appVersion: config.getVersion(),
        sourcePath: getSourcePath(ctx),
        previews,
        destinations: config.getCurrentDestinations(),
        currentPaths: Object.fromEntries(ASSET_KEYS.map((key) => [key, config.getExistingAssetPath(key) ?? ''])),
    });
}

async function updateAssets(workspacePath: string, data: UpdatePayload) {
    const config = new AppJsonService(workspacePath);
    const paths = new AssetPathService(workspacePath);
    const processor = await createProcessor();

    if (data.appVersion) {
        config.updateVersion(data.appVersion);
    }

    const tmpDir = path.join(workspacePath, '.expo-asset-tmp');
    fs.mkdirSync(tmpDir, { recursive: true });

    for (const key of ASSET_KEYS) {
        const file = data.files?.[key];
        if (!file) {
            continue;
        }

        const destination = data.destinations?.[key] ?? { folder: 'assets/images', fileName: `${key}.png` };
        const { outputPath, appJsonPath } = paths.resolve(destination.folder, destination.fileName);
        const tmp = path.join(tmpDir, `${key}-${Date.now()}.input`);

        fs.writeFileSync(tmp, Buffer.from(file.content, 'base64'));
        const [width, height] = SIZE[key];
        try {
            await processor.resizeTo(tmp, width, height, outputPath);
        } finally {
            fs.rmSync(tmp, { force: true });
        }
        config.setAssetPath(key, appJsonPath);
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
}

async function chooseAssetDir(panel: vscode.WebviewPanel, key: AssetKey) {
    const result = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Use folder',
        defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
    });
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!result?.[0] || !workspacePath) {
        return;
    }
    panel.webview.postMessage({
        type: 'asset-dir-chosen',
        key,
        folder: path.relative(workspacePath, result[0].fsPath).replace(/\\/g, '/'),
    });
}

function getSourcePath(ctx: vscode.ExtensionContext): string {
    const setting = vscode.workspace.getConfiguration().get<string>('expoAssetManager.sourcePath') || '';
    return ctx.workspaceState.get<string>(STATE_KEY) || setting;
}

async function chooseSourcePath(ctx: vscode.ExtensionContext, panel?: vscode.WebviewPanel) {
    const pick = await vscode.window.showOpenDialog({
        title: 'Select original assets folder',
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Use folder',
    });
    if (!pick?.[0]) {
        return;
    }
    await ctx.workspaceState.update(STATE_KEY, pick[0].fsPath);
    panel?.webview.postMessage({ type: 'sourcePathUpdated', sourcePath: pick[0].fsPath });
}

async function revealSourcePath(ctx: vscode.ExtensionContext) {
    const current = getSourcePath(ctx);
    if (!current) {
        vscode.window.showWarningMessage('No source folder set yet.');
        return;
    }
    await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(current));
}

async function hydrateDroppedUris(panel: vscode.WebviewPanel, uris: string[], targetSlot: AssetKey | null) {
    const files = [];
    for (const raw of uris) {
        const uri = vscode.Uri.parse(raw);
        if (uri.scheme !== 'file') {
            continue;
        }
        const data = await vscode.workspace.fs.readFile(uri);
        const name = path.basename(uri.fsPath);
        files.push({
            slot: targetSlot ?? inferSlotFromName(name) ?? 'icon',
            name,
            path: toWorkspaceRelative(uri.fsPath),
            dataUrl: `data:${mimeFromName(name)};base64,${Buffer.from(data).toString('base64')}`,
        });
    }
    panel.webview.postMessage({ type: 'dropped-files-ready', files });
}

function getHtml(webview: vscode.Webview, ctx: vscode.ExtensionContext) {
    const htmlPath = path.join(ctx.extensionPath, 'media', 'index.html');
    const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(ctx.extensionPath, 'media', 'script.js'))).toString();
    const nonce = makeNonce();
    const csp = [
        "default-src 'none'",
        `img-src ${webview.cspSource} data:`,
        "style-src 'unsafe-inline'",
        `script-src 'nonce-${nonce}'`,
    ].join('; ');

    return fs.readFileSync(htmlPath, 'utf8')
        .replace('{{scriptUri}}', scriptUri)
        .replace('{{nonce}}', nonce)
        .replace('{{csp}}', csp);
}

function makeNonce() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 32 }, () => alphabet.charAt(Math.floor(Math.random() * alphabet.length))).join('');
}

function inferSlotFromName(name: string): AssetKey | null {
    const normalized = name.toLowerCase();
    if (normalized.includes('favicon')) { return 'favicon'; }
    if (normalized.includes('adaptive')) { return 'adaptive-icon'; }
    if (normalized.includes('splash')) { return 'splash-icon'; }
    if (normalized.includes('icon')) { return 'icon'; }
    return null;
}

function mimeFromName(name: string): string {
    const normalized = name.toLowerCase();
    if (normalized.endsWith('.png')) { return 'image/png'; }
    if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) { return 'image/jpeg'; }
    if (normalized.endsWith('.webp')) { return 'image/webp'; }
    if (normalized.endsWith('.ico')) { return 'image/x-icon'; }
    return 'application/octet-stream';
}

function toWorkspaceRelative(abs: string) {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
        return abs;
    }
    return path.relative(workspacePath, abs).replace(/\\/g, '/') || abs;
}
