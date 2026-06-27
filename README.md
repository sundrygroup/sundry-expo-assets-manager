# Expo Asset Manager

Expo Asset Manager is a VS Code extension for creating, previewing, resizing, and wiring the core image assets in an Expo app.

Use it when you need to update an app icon, favicon, splash image, or Android adaptive icon without manually resizing files or editing Expo config paths by hand. You can upload your own artwork or generate a new asset with OpenAI directly inside the extension.

## What It Does

- Generates individual Expo assets with AI from an optional description.
- Reads project context from your Expo config and `package.json` to improve AI prompts.
- Lets you upload, drag, drop, or browse for existing image files.
- Converts supported source images to PNG.
- Resizes each asset to the Expo-ready dimensions.
- Shows previews before anything is written.
- Updates static Expo config paths when you click `Update Assets`.
- Lets you edit the app version from the same panel.
- Supports custom output folders and file names per asset.

## Supported Assets

| Asset | Final size | Expo config field |
| --- | ---: | --- |
| Favicon | `32 x 32` | `expo.web.favicon` |
| App icon | `1024 x 1024` | `expo.icon` |
| Splash image | `1280 x 720` | `expo.splash.image` or `expo-splash-screen` plugin image |
| Adaptive icon | `1080 x 1080` | `expo.android.adaptiveIcon.foregroundImage` |

AI generation uses a generation size that best fits each target, then the extension runs the result through the same resize pipeline as uploaded files.

## Quick Start

1. Open an Expo project folder in VS Code.
2. Run `Open Expo Asset Manager` from the Command Palette.
3. Pick or generate assets for the slots you want to update.
4. Review previews and output paths.
5. Click `Update Assets`.

Nothing is saved just because you click `Generate`. AI-generated images are staged in the preview slot first. Files and Expo config paths are written only when you click `Update Assets`.

## AI Asset Generation

Each asset card includes an `AI description` field and a `Generate` button.

The description is optional. If you leave it blank, the extension still includes useful context such as:

- Expo app name
- slug
- description
- version
- package metadata
- asset type and required dimensions

Good descriptions are short and visual:

```text
Minimal green monogram on charcoal, premium retail operations brand
```

```text
Clean geometric cube mark, white background, high contrast, no text
```

Avoid asking for small text inside icons or favicons. It usually becomes unreadable at final asset sizes.

## OpenAI API Key Setup

For AI generation, set an OpenAI API key:

1. Run `Expo Asset Manager: Set OpenAI API Key`.
2. Paste your key.
3. Reopen the asset manager panel if it is already open.

The key is stored with VS Code SecretStorage. This is preferred over putting secrets in project files or plain settings.

The extension resolves keys in this order:

1. VS Code SecretStorage from `Expo Asset Manager: Set OpenAI API Key`
2. `expoAssetManager.openaiApiKey` VS Code setting
3. `OPENAI_API_KEY` environment variable

To remove a saved key, run `Expo Asset Manager: Clear OpenAI API Key`.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `expoAssetManager.sourcePath` | `""` | Optional original assets folder. |
| `expoAssetManager.openaiApiKey` | `""` | Plain setting fallback for the OpenAI API key. Prefer SecretStorage. |
| `expoAssetManager.aiModel` | `gpt-image-2` | OpenAI image generation model. |
| `expoAssetManager.aiQuality` | `medium` | AI image quality: `low`, `medium`, `high`, or `auto`. |
| `expoAssetManager.aiOutputFormat` | `png` | Output format for generated images. |
| `expoAssetManager.aiContextMode` | `expoConfigAndPackage` | Use project context in prompts. Set to `none` to use only the description and asset requirements. |
| `expoAssetManager.statusMessageClearMs` | `8000` | Time before status/error messages clear. Set to `0` to keep them visible. |

## Expo Config Support

Expo Asset Manager updates static Expo config files:

- `app.json`
- `app.config.json`
- `package.json` with an `expo` object

Dynamic config files such as `app.config.js` or `app.config.ts` cannot be updated safely by this extension. If a dynamic config is detected without a static config target, the extension will ask you to use a static Expo config file for managed asset updates.

## Image Processing

The extension prefers ImageMagick when it is installed. If ImageMagick is not available, it falls back to Jimp.

Install ImageMagick for best format support:

```bash
brew install imagemagick
```

```bash
sudo apt install imagemagick
```

On Windows, install ImageMagick from the official installer and make sure it is available on your `PATH`.

## Common Issues

### `Billing hard limit has been reached`

This is an OpenAI API billing or quota error. Check that the API key belongs to the organization/project with active billing. ChatGPT Plus/Pro billing is separate from OpenAI API billing.

If you changed keys and still see the same error, run `Expo Asset Manager: Clear OpenAI API Key`, then set the key again. SecretStorage takes precedence over settings and environment variables.

### No image preview after generation

Reload the VS Code Extension Development Host or restart the extension host after rebuilding. Older running webviews may keep stale HTML/CSP.

### `Failed to fetch`

If usage appears in the OpenAI dashboard, generation likely reached OpenAI and failed during image retrieval or preview rendering. Current builds convert generated image data in memory and avoid fetching generated data URLs from the webview.

### WebP does not work

Install ImageMagick. The Jimp fallback has more limited format support.

## Development

Install dependencies:

```bash
yarn install
```

Run checks:

```bash
yarn run check-types
yarn run lint
npx vitest run
```

Build the extension:

```bash
yarn run package
```

Package a VSIX:

```bash
yarn package:vsix
```

Publish to the VS Code Marketplace:

```bash
yarn publish:vsce
```

Patch or minor version publish:

```bash
yarn publish:vsce:patch
yarn publish:vsce:minor
```

Publishing requires a valid Visual Studio Marketplace publisher and token configured for `vsce`.

## License

Copyright © Sundry Group Enterprises.

This project is licensed under the terms and conditions specified by Sundry Group Enterprises.
