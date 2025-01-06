
# Expo Asset Manager

**Expo Asset Manager** is a powerful VS Code extension that helps you manage app assets for Expo projects. This tool allows you to process and resize images, update the app version, and preview assets dynamically.

---

### **Features**

1. **Image Processing**:
   - Converts all image formats (e.g., JPG, WEBP) into PNG.
   - Resizes images to match required dimensions (e.g., favicon, app icons, splash screens).

2. **Dynamic Previews**:
   - Displays Base64-encoded previews of assets directly in the WebView.

3. **App Version Management**:
   - View, edit, and manage the `major`, `minor`, and `patch` version parts.
   - Automatically update the `app.json` file with the new version.

4. **Seamless Integration**:
   - Automatically updates the `app.json` file with asset paths and app version.

5. **User-Friendly Interface**:
   - WebView interface to select files, update assets, and manage versions.

6. **Error Handling**:
   - Graceful error handling with meaningful error messages displayed in VS Code.

---

### **How to Use**

1. **Launch the Extension**:
   - Open a folder containing an **Expo project** in VS Code.
   - Press `F1` or `Ctrl+Shift+P` and type `Expo Asset Manager: Open`.

2. **WebView Interface**:
   - A WebView will open, displaying the app version and current asset previews.

3. **Update App Version**:
   - Use the `+` and `-` buttons or directly edit the `major`, `minor`, and `patch` version fields.
   - The app version will be updated in the `app.json` file.

4. **Upload and Process Assets**:
   - Upload new assets (e.g., favicon, splash screen) by selecting files in the WebView.
   - The assets are automatically converted to PNG and resized to required dimensions.
   - The updated images are saved in the `assets/images` directory, and paths are added to `app.json`.

5. **Preview Changes**:
   - The WebView dynamically updates to show the modified assets and new app version.

6. **Error Notifications**:
   - If an error occurs (e.g., missing `app.json`), it will be displayed as a VS Code notification.

---

### **Supported Asset Types and Dimensions**

| **Asset**         | **Dimensions** |
|--------------------|----------------|
| Favicon           | 32x32          |
| Icon              | 1024x1024      |
| Splash Screen     | 1280x720       |
| Adaptive Icon     | 1080x1080      |

---

### **Development and Debugging**

1. Open the project in VS Code.
2. Press `F5` to launch the extension in a new VS Code window.
3. Debug using the WebView console (`Ctrl+Shift+I`) or the extension's output in the VS Code Debug Console.

---

### **Error Handling and Logs**

- **Missing `app.json`**: Ensure your workspace folder contains a valid `app.json` file.
- **Invalid Files**: Upload valid image files (e.g., PNG, JPG, WEBP).
- **Unexpected Errors**: View detailed logs in the VS Code Debug Console.

---

### **License**

**Copyright © Sundry Group Enterprises. All rights reserved.**

This project is licensed under the terms and conditions specified by Sundry Group Enterprises.
