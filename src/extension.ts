/**
 * Expo Asset Manager Extension
 * Copyright (C) Sundry Group Enterprises. All rights reserved.
 *
 * This extension manages app assets for Expo projects, including icons and splash screens,
 * with functionalities to process images, update versions, and preview assets dynamically.
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import * as Jimp from "jimp";

/**
 * Checks if ImageMagick is installed on the system.
 *
 * This function executes the `magick -version` command to determine if ImageMagick is available.
 * It returns a promise that resolves to `true` if ImageMagick is installed, and `false` otherwise.
 *
 * @returns {Promise<boolean>} A promise that resolves to `true` if ImageMagick is installed, and `false` otherwise.
 */
async function isImageMagickInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    exec("magick -version", (error) => {
      resolve(!error);
    });
  });
}

/**
 * Process assets and update app.json using ImageMagick
 * @param data - Contains Base64 files and app version
 * @param workspacePath - Path to the active workspace folder
 * @returns {Promise<Record<string, string>>} - Updated Base64 previews
 */
async function processAssets(
  data: { files: Record<string, any>; appVersion: string },
  workspacePath: string
): Promise<Record<string, string>> {
  if (!data) {
    throw new Error(`No data provided for updating assets.`);
  }

  const assetsDir = path.join(workspacePath, "assets/images");

  // Ensure assets directory exists
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const sizeRequirements: Record<string, [number, number]> = {
    favicon: [32, 32],
    icon: [1024, 1024],
    "splash-icon": [1280, 720],
    "adaptive-icon": [1080, 1080],
  };

  const newPreviews: Record<string, string> = {};
  const isMagickAvailable = await isImageMagickInstalled();

  if (!isMagickAvailable) {
    vscode.window.showWarningMessage(
      "ImageMagick is not installed. You can install it by following these steps:\n" +
        "- macOS: `brew install imagemagick`\n" +
        "- Windows: Download from https://imagemagick.org/script/download.php\n" +
        "- Linux: `sudo apt install imagemagick` or `sudo yum install ImageMagick`\n" +
        "\nContinuing with Jimp. Note: WebP format will not be supported."
    );
  }

  for (const [key, file] of Object.entries(data.files)) {
    const filePath: string = path.join(assetsDir, `${key}.png`);
    const [width, height] = sizeRequirements[key] || [1024, 1024];

    try {
      const buffer = Buffer.from(file.content, "base64");
      const tempFilePath = path.join(assetsDir, `${key}_temp.png`);
      fs.writeFileSync(tempFilePath, buffer);

      if (isMagickAvailable) {
        await new Promise((resolve, reject) => {
          exec(
            `magick convert "${tempFilePath}" -resize ${width}x${height}! "${filePath}"`,
            (error) => {
              if (error) reject(error);
              else resolve(true);
            }
          );
        });
      } else {
        const image = await (Jimp as any).read(tempFilePath);
        image.resize(width, height).write(filePath);
      }

      const updatedBuffer = fs.readFileSync(filePath);
      newPreviews[key] = `data:image/png;base64,${updatedBuffer.toString(
        "base64"
      )}`;
      // Cleanup temporary file
      fs.unlinkSync(tempFilePath);
    } catch (err: any) {
      throw new Error(`Failed to process ${key}: ${err.message}`);
    }
  }

  // Update app.json
  const appJsonPath = path.join(workspacePath, "app.json");
  if (!fs.existsSync(appJsonPath)) {
    throw new Error("app.json not found in the workspace.");
  }

  const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
  appJson.expo.version = data.appVersion || appJson.expo.version;

  Object.keys(data.files).forEach((key) => {
    appJson.expo[key] = `./assets/images/${key}.png`;
  });

  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
  return newPreviews;
}

/**
 * Activate the VS Code extension
 * @param context - VS Code extension context
 */
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("expo-asset-manager.open", () => {
      const panel = vscode.window.createWebviewPanel(
        "expoAssetManager",
        "Expo Asset Manager",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.file(path.join(context.extensionPath, "media")),
          ],
          retainContextWhenHidden: true,
        }
      );

      // Restrict the sandbox to prevent security vulnerabilities
      panel.webview.options = {
        enableScripts: true,
        enableForms: true, // Disable form submission
      };
      const workspaceFolder =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("No folder is open in the workspace.");
        return;
      }

      // Load initial assets and version
      const { appVersion } = reloadHtml(workspaceFolder);

      panel.webview.onDidReceiveMessage(async (message) => {
        if (message.type === "ready") {
          // Send data to the WebView
          panel.webview.postMessage({
            type: "initialize",
            appVersion: appVersion, // Pass the version dynamically
          });
        }
      });

      panel.webview.onDidReceiveMessage(async (message) => {
        if (message.type === "update-assets") {
          try {
            await processAssets(message.data, workspaceFolder);

            setTimeout(() => reloadHtml(workspaceFolder), 0);
            vscode.window.showInformationMessage(
              "Assets updated successfully!"
            );
          } catch (error: any) {
            vscode.window.showErrorMessage(
              `Error updating assets: ${error.message}`
            );
            panel.webview.postMessage({
              type: "error",
              message: error.message,
            });
          }
        }
      });

      function reloadHtml(workspaceFolder: string) {
        const assetImages = loadAssetImages(workspaceFolder);
        const version = loadAppVersion(workspaceFolder);

        const scriptUri = panel.webview.asWebviewUri(
          vscode.Uri.file(
            path.join(context.extensionPath, "media", "script.js")
          )
        );

        const htmlUri = panel.webview.asWebviewUri(
          vscode.Uri.file(
            path.join(context.extensionPath, "media", "index.html")
          )
        );

        panel.webview.html = getWebviewContent(
          context,
          assetImages,
          version,
          scriptUri.toString(),
          htmlUri.toString()
        );
        return { appVersion: version, scriptUri, htmlUri };
      }
    })
  );
}

/**
 * Deactivate the extension
 */
export function deactivate() {}

/**
 * Load asset images as Base64 from the workspace
 * @param workspaceFolder - Path to the workspace folder
 * @returns {Record<string, string>} - Asset images as Base64
 */
function loadAssetImages(workspaceFolder: string): Record<string, string> {
  const assets = ["favicon", "icon", "splash-icon", "adaptive-icon"];
  return assets.reduce((acc, key) => {
    const filePath = path.join(workspaceFolder, "assets/images", `${key}.png`);
    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath);
      acc[key] = `data:image/png;base64,${fileBuffer.toString("base64")}`;
    } else {
      acc[key] = ""; // Return empty string if file doesn't exist
    }
    return acc;
  }, {} as Record<string, string>);
}

/**
 * Load the app version from app.json
 * @param workspaceFolder - Path to the workspace folder
 * @returns {string} - App version
 */
function loadAppVersion(workspaceFolder: string): string {
  const appJsonPath = path.join(workspaceFolder, "app.json");
  if (!fs.existsSync(appJsonPath)) {
    throw new Error("app.json not found in the workspace.");
  }
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
  return appJson.expo.version || "1.0.0";
}

/**
 * Generate WebView content with dynamic data
 * @param assetImages - Base64 previews of the assets
 * @param appVersion - App version
 * @returns {string} - HTML content for the WebView
 */
function getWebviewContent(
  context: vscode.ExtensionContext,
  assetImages: Record<string, string>,
  appVersion: string,
  scriptUri: string,
  htmlUri: string
): string {
  const htmlPath = path.join(context.extensionPath, "media", "index.html");
  let htmlContent = fs.readFileSync(htmlPath, "utf-8");

  Object.keys(assetImages).forEach((key) => {
    htmlContent = htmlContent.replace(
      new RegExp(`{{${key}}}`),
      assetImages[key]
    );
  });

  htmlContent = htmlContent.replace(new RegExp(`{{appVersion}}`), appVersion);

  const nonce = generateNonce();
  htmlContent = htmlContent.replace(new RegExp(`{{nonce}}`), nonce);
  htmlContent = htmlContent.replace(new RegExp(`{{scriptUri}}`), scriptUri);

  return htmlContent;
}

function generateNonce(): string {
  return [...Array(16)].map(() => Math.random().toString(36)[2]).join("");
}
