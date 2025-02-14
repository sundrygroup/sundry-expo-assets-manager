const { execSync } = require("child_process");
const process = require("process");

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
  console.log(`Installing ${packages[key]} for ${platform} (${arch})...`);
  execSync(`npm install ${packages[key]}`, { stdio: "inherit" });
} else {
  console.error(`❌ No compatible sharp-libvips package for ${platform} (${arch})`);
  process.exit(1);
}
