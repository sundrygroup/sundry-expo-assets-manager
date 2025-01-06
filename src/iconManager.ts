import * as vscode from "vscode";
import { selectImage } from "./imagePicker";
import { resizeImage } from "./imageResizer";
import { updateExpoConfig } from "./configUpdater";
import path from "path";

export async function manageIcons(context: vscode.ExtensionContext) {
  const projectPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (!projectPath) {
    vscode.window.showErrorMessage("No workspace folder found.");
    return;
  }

  const sizes = {
    favicon: [32, 32],
    icon: [1024, 1024],
    "splash-icon": [1280, 720],
    "adaptive-icon": [1080, 1080],
  };

  for (const [key, [width, height]] of Object.entries(sizes)) {
    vscode.window.showInformationMessage(`Select ${key}`);
    const imagePath = await selectImage();
    if (imagePath) {
      const outputPath = path.join(projectPath, "assets", "images", `${key}.png`);
      await resizeImage(imagePath, outputPath, width, height);
      updateExpoConfig(projectPath, { [key]: `./assets/images/${key}.png` });
      vscode.window.showInformationMessage(`${key} updated successfully.`);
    }
  }
}
