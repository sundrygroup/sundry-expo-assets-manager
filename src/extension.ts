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
import sharp from "sharp";

/**
 * Process assets and update app.json
 * @param data - Contains Base64 files and app version
 * @param workspacePath - Path to the active workspace folder
 * @returns {Promise<Record<string, string>>} - Updated Base64 previews
 */
async function processAssets(
	data: {
		files: Record<string, any>,
		appVersion: string;
	},
	workspacePath: string
): Promise<Record<string, string>> {


	if (!data) {
		throw new Error(`Nothing to update.`);
	}


	const assetsDir = path.join(workspacePath, "assets/images");

	// Ensure the assets/images directory exists
	if (!fs.existsSync(assetsDir)) {
		fs.mkdirSync(assetsDir, { recursive: true });
	}

	const sizeRequirements: Record<string, [number, number]> = {
		favicon: [32, 32],
		"icon": [1024, 1024],
		"splash-icon": [1280, 720],
		"adaptive-icon": [1080, 1080],
	};

	const newPreviews: Record<string, string> = {};

	for (const [key, file] of Object.entries(data?.files)) {
		const filePath = path.join(assetsDir, `${key}.png`); // Ensure target is always .png
		const [width, height] = sizeRequirements[key];

		try {
			// Decode the Base64 image
			const buffer = Buffer.from(file.content, "base64");

			// Process the image (convert to PNG and resize)
			await sharp(buffer)
				.resize(width, height, { fit: "cover" }) // Resize to the required dimensions
				.png() // Convert to PNG
				.toFile(filePath);

			// Read the updated file and convert it to Base64 for the preview
			const updatedBuffer = fs.readFileSync(filePath);
			newPreviews[key] = `data:image/png;base64,${updatedBuffer.toString("base64")}`;
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

	Object.keys(data).forEach((key) => {
		appJson.expo[key] = `./assets/images/${key}.png`;
	});

	fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));

	return newPreviews; // Return the updated Base64 previews
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand("expo-asset-manager.open", () => {
			const panel = vscode.window.createWebviewPanel(
				"expoAssetManager",
				"Expo Asset Manager",
				vscode.ViewColumn.One,
				{
					enableScripts: true,
					localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, "media"))],
				}
			);

			const htmlPath = path.join(context.extensionPath, "src", "media", "index.html");
			const htmlContent = fs.readFileSync(htmlPath, "utf-8");


			const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
			if (!workspaceFolder) {
				vscode.window.showErrorMessage("No folder is open in the workspace.");
				return;
			}

			// Resolve existing image paths
			const assetImages = ["favicon", "icon", "splash-icon", "adaptive-icon"].reduce(
				(acc, key) => {
					const filePath = path.join(workspaceFolder, "assets/images", `${key}.png`);
					if (fs.existsSync(filePath)) {
						const fileBuffer = fs.readFileSync(filePath);
						acc[key] = `data:image/png;base64,${fileBuffer.toString("base64")}`;
					} else {
						acc[key] = ""; // Empty string if the image doesn't exist
					}
					return acc;
				},
				{} as Record<string, string>
			);

			const appJsonPath = path.join(workspaceFolder, "app.json");
			const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
			const appVersion = appJson.expo.version;
			console.log('appVersion--->', appVersion);
			// Pass the paths to the WebView
			panel.webview.html = getWebviewContent(htmlContent, assetImages, appVersion);


			// panel.webview.html = htmlContent;

			panel.webview.onDidReceiveMessage(
				async (message) => {
					if (message.type === "update-assets") {
						const workspaceFolder: any = vscode.workspace.workspaceFolders?.[0];
						if (!workspaceFolder) {
							vscode.window.showErrorMessage("No folder is open in the workspace.");
							panel.webview.postMessage({
								type: "error",
								message: "Please open a folder in VS Code before using this extension.",
							});
							return;
						}

						try {
							const newPreviews = await processAssets(message.data, workspaceFolder.uri.fsPath);

							const assetImages = ["favicon", "icon", "splash-icon", "adaptive-icon"].reduce(
								(acc, key) => {
									const filePath = path.join(workspaceFolder.uri.fsPath, "assets/images", `${key}.png`);
									if (fs.existsSync(filePath)) {
										const fileBuffer = fs.readFileSync(filePath);
										acc[key] = `data:image/png;base64,${fileBuffer.toString("base64")}`;
									} else {
										acc[key] = ""; // Empty string if the image doesn't exist
									}
									return acc;
								},
								{} as Record<string, string>
							);

							panel.webview.html = getWebviewContent(htmlContent, assetImages, message?.data?.appVersion || appVersion);

							vscode.window.showInformationMessage("Assets updated successfully!");
							panel.webview.postMessage({
								type: "success",
								message: "Assets updated successfully!",
							});
						} catch (error: any) {
							vscode.window.showErrorMessage(`Error updating assets: ${error.message}`);
							panel.webview.postMessage({
								type: "error",
								message: error.message,
							});
						}
					}
				}
			);

		})
	);
}

export function deactivate() { }

function getWebviewContent(htmlContent: string, assetImages: Record<string, string>, appVersion: string): string {

	Object.keys(assetImages).forEach(key => {
		htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`), assetImages[key]);
	});

	htmlContent = htmlContent.replace(new RegExp(`{{appVersion}}`), appVersion);

	return htmlContent;
}

