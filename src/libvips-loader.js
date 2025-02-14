const os = require("os");
const process = require("process");

function getSharpLibvipsPackage() {
  const platform = process.platform;
  const arch = process.arch;

  const packages = {
    "darwin-x64": "@img/sharp-libvips-darwin-x64",
    "darwin-arm64": "@img/sharp-libvips-darwin-arm64",
    "linux-x64": "@img/sharp-libvips-linux-x64",
    "linux-arm64": "@img/sharp-libvips-linux-arm64",
    "win32-x64": "@img/sharp-libvips-win32-x64",
  };

  const key = `${platform}-${arch}`;

  if (packages[key]) {
    return packages[key];
  }

  throw new Error(`Unsupported platform: ${platform} ${arch}`);
}

function loadSharpLibvips() {
  try {
    const packageName = getSharpLibvipsPackage();
    return require(packageName); // Dynamically require the correct package
  } catch (error) {
    console.error("Error loading sharp-libvips:", error);
    throw error;
  }
}

module.exports = loadSharpLibvips;
