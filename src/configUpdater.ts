import * as fs from "fs";
import * as path from "path";

export function updateExpoConfig(
  projectPath: string,
  updates: { [key: string]: string }
): void {
  const configPath = path.join(projectPath, "app.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  Object.entries(updates).forEach(([key, value]) => {
    config.expo[key] = value;
  });

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}
