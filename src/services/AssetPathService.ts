import * as fs from 'fs';
import * as path from 'path';
/** Resolves user-chosen folder + fileName to:
 *  - absolute outputPath (for writing the PNG)
 *  - relative appJsonPath (starts with "./")
 * Also ensures directory exists.
 */
export class AssetPathService {
    constructor(private workspaceRoot: string) { }

    ensureFolder(absFolder: string) {
        if (!fs.existsSync(absFolder)) {
            fs.mkdirSync(absFolder, { recursive: true });
        }
    }

    resolve(folderRel: string, fileName: string) {
        const safeFolderRel = normalizeRel(folderRel || 'assets/images');
        const safeFileName = path.basename(fileName || 'asset.png');
        const relPath = `./${path.posix.join(safeFolderRel, safeFileName)}`;
        const absFolder = path.join(this.workspaceRoot, safeFolderRel);
        this.ensureFolder(absFolder);
        const absOut = path.join(absFolder, safeFileName);
        return { outputPath: absOut, appJsonPath: relPath };
    }
}

function normalizeRel(input: string) {
    const normalized = input.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^\/+|\/+$/g, '');
    const safe = path.posix.normalize(normalized || 'assets/images');
    if (safe === '..' || safe.startsWith('../') || path.isAbsolute(safe)) {
        throw new Error('Asset output folder must stay inside the workspace.');
    }
    return safe;
}
