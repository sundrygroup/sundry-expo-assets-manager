import * as vscode from "vscode";

export function showGuidelinesPanel(context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
      "iconGuidelines",
      "Icon Size Guidelines",
      vscode.ViewColumn.One,
      {}
    );
  
    panel.webview.html = `
      <!DOCTYPE html>
      <html>
        <body>
          <h1>React Native Expo Icon Size Guidelines</h1>
          <ul>
            <li><b>Favicon:</b> 32x32</li>
            <li><b>App Icon:</b> 1024x1024</li>
            <li><b>Splash Icon:</b> 1280x720</li>
            <li><b>Adaptive Icon:</b> 1080x1080</li>
          </ul>
        </body>
      </html>
    `;
  }
  