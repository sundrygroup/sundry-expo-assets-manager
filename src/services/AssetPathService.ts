import * as fs from 'fs';
import * as path from 'path';
import type { AssetKey } from '../models/assets';

/** Resolves user-chosen folder + fileName to:
 *  - absolute outputPath (for writing the PNG)
 *  - relative appJsonPath (starts with "./")
 * Also ensures directory exists.
 */
export class AssetPathService {
    constructor(private workspaceRoot: string) { }

    ensureFolder(absFolder: string) {
        if (!fs.existsSync(absFolder)) fs.mkdirSync(absFolder, { recursive: true });
    }

    resolve(key: AssetKey, folderRel: string, fileName: string) {
        const safeFolderRel = folderRel.replace(/^\.?\//, ''); // normalize
        const relPath = `./${safeFolderRel}/${fileName}`;
        const absFolder = path.join(this.workspaceRoot, safeFolderRel);
        this.ensureFolder(absFolder);
        const absOut = path.join(absFolder, fileName);
        return { outputPath: absOut, appJsonPath: relPath };
    }
}
