import * as vscode from "vscode";

export async function selectImage(): Promise<string | undefined> {
  const result = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: "Select Image",
    filters: { Images: ["png", "jpg", "jpeg"] },
  });
  return result?.[0]?.fsPath;
}
