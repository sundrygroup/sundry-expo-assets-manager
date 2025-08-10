/**
 * Expo Asset Manager Extension (refactor)
 * - Preserves ImageMagick + Jimp processing
 * - Adds Source Folder selection + reveal
 * - Adds VS Code Explorer drag & drop (URI → dataURL bridge)
 * - Initializes current paths + previews + version
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import * as Jimp from "jimp";

const STATE_KEY = "expoAssetManager.sourcePath";

/* --------------------------------------------------------
   ImageMagick presence
---------------------------------------------------------*/
/** Checks if ImageMagick (magick) is installed. */
async function isImageMagickInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    exec("magick -version", (error) => resolve(!error));
  });
}

/* --------------------------------------------------------
   Asset processing (kept from your version, tightened a bit)
---------------------------------------------------------*/
/**
 * Process assets and update app.json
 * - Converts to PNG
 * - Resizes to required dims
 * - Writes to ./assets/images/{key}.png
 * - Updates app.json (expo.version + asset paths)
 * Returns data URLs for live preview.
 */
async function processAssets(
  data: { files: Record<string, any>; appVersion: string },
  workspacePath: string
): Promise<Record<string, string>> {
  if (!data) throw new Error("No data provided for updating assets.");

  const assetsDir = path.join(workspacePath, "assets/images");
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  const sizeRequirements: Record<string, [number, number]> = {
    favicon: [32, 32],
    icon: [1024, 1024],
    "splash-icon": [1280, 720],
    "adaptive-icon": [1080, 1080],
  };

  const newPreviews: Record<string, string> = {};
  const magick = await isImageMagickInstalled();
  if (!magick) {
    vscode.window.showWarningMessage(
      "ImageMagick not found. Falling back to Jimp (no WebP). " +
      "Install via: macOS `brew install imagemagick`, Linux `sudo apt install imagemagick`, Windows: download from imagemagick.org."
    );
  }

  for (const [key, file] of Object.entries(data.files)) {
    const outPath = path.join(assetsDir, `${key}.png`);
    const [width, height] = sizeRequirements[key] || [1024, 1024];

    try {
      const buffer = Buffer.from(file.content, "base64");
      const tmp = path.join(assetsDir, `${key}_temp.png`);
      fs.writeFileSync(tmp, buffer);

      if (magick) {
        await new Promise((resolve, reject) => {
          exec(
            `magick convert "${tmp}" -resize ${width}x${height}! "${outPath}"`,
            (err) => (err ? reject(err) : resolve(true))
          );
        });
      } else {
        const image = await (Jimp as any).read(tmp);
        await image.resize(width, height).writeAsync(outPath);
      }

      const updatedBuffer = fs.readFileSync(outPath);
      newPreviews[key] = `data:image/png;base64,${updatedBuffer.toString(
        "base64"
      )}`;

      fs.unlinkSync(tmp);
    } catch (e: any) {
      throw new Error(`Failed to process ${key}: ${e.message}`);
    }
  }

  // Update app.json (version + paths)
  const appJsonPath = path.join(workspacePath, "app.json");
  if (!fs.existsSync(appJsonPath))
    throw new Error("app.json not found in the workspace.");

  const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
  appJson.expo = appJson.expo || {};
  if (data.appVersion) appJson.expo.version = data.appVersion;

  Object.keys(data.files).forEach((key) => {
    appJson.expo[key] = `./assets/images/${key}.png`;
  });

  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
  return newPreviews;
}

/* --------------------------------------------------------
   Activate (webview + messaging + new features)
---------------------------------------------------------*/
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("expo-asset-manager.open", () =>
      openPanel(context)
    ),
    vscode.commands.registerCommand(
      "expo-asset-manager.setSourceFolder",
      () => chooseSourcePath(context)
    ),
    vscode.commands.registerCommand(
      "expo-asset-manager.revealSourceFolder",
      () => revealSourcePath(context)
    )
  );
}

export function deactivate() { }


async function openPanel(ctx: vscode.ExtensionContext) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
  const assetsDir = vscode.Uri.joinPath(workspaceFolder!, "assets", "images");

  const panel = vscode.window.createWebviewPanel(
    "expoAssetManager",
    "Expo Asset Manager",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.file(ctx.extensionPath),
        workspaceFolder!,          // allow workspace
        assetsDir,                 // allow assets/images explicitly
      ],
    }
  );

  const refresh = async () => {
    panel.webview.postMessage({
      type: "initialize",
      appVersion: await readAppVersionOrDefault(),
      sourcePath: getSourcePath(ctx),
      currentPaths: await discoverCurrentAssetPaths(),
    });
    panel.webview.postMessage({
      type: "updated-previews",
      previews: await getPreviewUris(panel.webview, ctx),
      paths: await discoverCurrentAssetPaths(),
    });
  };

  panel.webview.html = getHtml(panel.webview, ctx);

  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspacePath) {
    vscode.window.showErrorMessage("Open a folder to use Expo Asset Manager.");
    return;
  }

  const appVersion = await readAppVersionOrDefault();
  const sourcePath = getSourcePath(ctx);

  panel.webview.onDidReceiveMessage(async (msg) => {
    try {
      switch (msg.type) {
        case "refresh": {
          await refresh();
          break;
        }
        case "ready": {
          panel.webview.postMessage({
            type: "initialize",
            appVersion,
            sourcePath,
            currentPaths: await discoverCurrentAssetPaths(),
          });
          break;
        }

        case "choose-source-path": {
          await chooseSourcePath(ctx, panel);
          await refresh();
          break;
        }

        case "reveal-source-path": {
          await revealSourcePath(ctx);
          break;
        }

        case "dropped-uris": {
          // Drag & drop from Explorer → read file(s) and send back as data URLs
          const filesPayload: any[] = [];
          const uris: string[] = msg.uris || [];
          const targetSlot: string | null = msg.targetSlot || null;

          for (const raw of uris) {
            let uri: vscode.Uri;
            try {
              uri = vscode.Uri.parse(raw);
            } catch {
              continue;
            }
            if (uri.scheme !== "file") continue;

            const data = await vscode.workspace.fs.readFile(uri);
            const name = path.basename(uri.fsPath);
            const inferred = targetSlot || inferSlotFromName(name) || "icon";
            const mime = mimeFromName(name);
            const base64 = Buffer.from(data).toString("base64");
            const dataUrl = `data:${mime};base64,${base64}`;

            filesPayload.push({
              slot: inferred,
              name,
              path: toWorkspaceRelative(uri.fsPath),
              dataUrl,
            });
          }

          panel.webview.postMessage({
            type: "dropped-files-ready",
            files: filesPayload,
          });
          break;
        }

        case "update-assets": {
          // Save images, update app.json, then refresh previews+paths
          await processAssets(msg.data, workspacePath);

          panel.webview.postMessage({
            type: "updated-previews",
            previews: await getPreviewUris(panel.webview, ctx),
            paths: await discoverCurrentAssetPaths(),
          });

          vscode.window.showInformationMessage("Assets updated successfully!");
          break;
        }
      }
    } catch (e: any) {
      panel.webview.postMessage({ type: "error", message: e?.message ?? String(e) });
    }
  });
}

/* --------------------------------------------------------
   Helpers: state, paths, version, previews, HTML
---------------------------------------------------------*/
function getSourcePath(ctx: vscode.ExtensionContext): string {
  const setting =
    vscode.workspace.getConfiguration().get<string>("expoAssetManager.sourcePath") ||
    "";
  const state = ctx.workspaceState.get<string>(STATE_KEY) || "";
  return state || setting;
}

async function chooseSourcePath(
  ctx: vscode.ExtensionContext,
  panel?: vscode.WebviewPanel
) {
  const pick = await vscode.window.showOpenDialog({
    title: "Select original assets folder",
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Use this folder",
  });
  if (!pick || !pick[0]) return;

  const chosen = pick[0].fsPath;
  await ctx.workspaceState.update(STATE_KEY, chosen);

  if (panel)
    panel.webview.postMessage({ type: "sourcePathUpdated", sourcePath: chosen });
  vscode.window.showInformationMessage(`Original assets folder set to: ${chosen}`);
}

async function revealSourcePath(ctx: vscode.ExtensionContext) {
  const current = getSourcePath(ctx);
  if (!current) {
    vscode.window.showWarningMessage("No source folder set yet.");
    return;
  }
  const uri = vscode.Uri.file(current);
  await vscode.commands.executeCommand("revealFileInOS", uri);
}

async function readAppVersionOrDefault(): Promise<string> {
  try {
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!folder) return "1.0.0";
    const appJsonPath = path.join(folder, "app.json");
    const content = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
    const version = content?.expo?.version || content?.version;
    return typeof version === "string" ? version : "1.0.0";
  } catch {
    return "1.0.0";
  }
}

async function discoverCurrentAssetPaths(): Promise<Record<string, string>> {
  const base = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!base) return {};
  const candidates: Record<string, string[]> = {
    favicon: ["assets/images/favicon.png", "public/favicon.png"],
    icon: ["assets/images/icon.png", "assets/icon.png"],
    "splash-icon": ["assets/images/splash.png", "assets/splash.png"],
    "adaptive-icon": ["assets/images/adaptive-icon.png", "assets/adaptive-icon.png"],
  };
  const result: Record<string, string> = {};
  for (const [key, list] of Object.entries(candidates)) {
    for (const rel of list) {
      const full = path.join(base, rel);
      if (fs.existsSync(full)) {
        result[key] = rel;
        break;
      }
    }
  }
  return result;
}

async function getPreviewUris(webview: vscode.Webview, ctx: vscode.ExtensionContext) {
  const base = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ctx.extensionPath;
  const map: Record<string, string> = {
    favicon: path.join(base, "assets/images/favicon.png"),
    icon: path.join(base, "assets/images/icon.png"),
    "splash-icon": path.join(base, "assets/images/splash.png"),
    "adaptive-icon": path.join(base, "assets/images/adaptive-icon.png"),
  };
  const out: Record<string, string> = {};
  // for (const [k, p] of Object.entries(map)) {
  //   try {
  //     out[k] = webview.asWebviewUri(vscode.Uri.file(p)).toString();
  //   } catch {
  //     // ignore missing
  //   }
  // }
  // return out;
  for (const [k, p] of Object.entries(map)) {
    if (fs.existsSync(p)) {
      const uri = webview.asWebviewUri(vscode.Uri.file(p)).toString();
      out[k] = uri;
    }
  }
  return out;
}

/** Build webview HTML with CSP + nonce and point to index.html/script.js in extension root. */
function getHtml(webview: vscode.Webview, ctx: vscode.ExtensionContext) {
  const htmlPath = path.join(ctx.extensionPath,"media", "index.html");
  const jsPath = path.join(ctx.extensionPath,"media", "script.js");

  const scriptUri = webview.asWebviewUri(vscode.Uri.file(jsPath)).toString();
  const nonce = makeNonce();
  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
  ].join("; ");

  let html = fs.readFileSync(htmlPath, "utf8");
  html = html
    .replace("{{scriptUri}}", scriptUri)
    .replace("{{nonce}}", nonce)
    .replace("{{csp}}", csp)
    // optional: blank initial src; we'll push real URIs via postMessage
    .replace(/{{favicon}}/g, "")
    .replace(/{{icon}}/g, "")
    .replace(/{{splash-icon}}/g, "")
    .replace(/{{adaptive-icon}}/g, "");
  return html;
}

function makeNonce() {
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 })
    .map(() => possible.charAt(Math.floor(Math.random() * possible.length)))
    .join("");
}

/* --------------------------------------------------------
   Drag & drop helpers (Explorer URIs)
---------------------------------------------------------*/
function inferSlotFromName(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes("favicon")) return "favicon";
  if (n.includes("adaptive")) return "adaptive-icon";
  if (n.includes("splash")) return "splash-icon";
  if (n.includes("icon")) return "icon";
  return null;
}

function mimeFromName(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

function toWorkspaceRelative(abs: string) {
  const base = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!base) return abs;
  try {
    const rel = path.relative(base, abs);
    return rel || abs;
  } catch {
    return abs;
  }
}

