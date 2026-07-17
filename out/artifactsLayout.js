"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.folderHasDependencyClosure = folderHasDependencyClosure;
exports.findDllInArtifactsLayout = findDllInArtifactsLayout;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const noop = () => { };
/**
 * True when a folder contains an XAF module's dependency closure — at least one
 * DevExpress.*.dll next to the module. A bare class-library output (the default,
 * CopyLocalLockFileAssemblies=false) holds only the module DLL, so the standalone
 * Model Editor cannot resolve the DevExpress assemblies the module type needs.
 */
function folderHasDependencyClosure(folder) {
    try {
        return fs.readdirSync(folder).some(f => /^DevExpress\..*\.dll$/i.test(f));
    }
    catch {
        return false;
    }
}
function countDlls(folder) {
    try {
        return fs.readdirSync(folder).filter(f => f.toLowerCase().endsWith('.dll')).length;
    }
    catch {
        return 0;
    }
}
function listDirs(dir) {
    try {
        return fs.readdirSync(dir).filter(p => {
            try {
                return fs.statSync(path.join(dir, p)).isDirectory();
            }
            catch {
                return false;
            }
        });
    }
    catch {
        return [];
    }
}
/**
 * Among the pivot subfolders (debug preferred) of an artifacts project folder,
 * returns the first that contains dllName, or undefined.
 */
function pickPivotFolderContaining(projectBin, dllName) {
    const pivots = listDirs(projectBin)
        .sort((a, b) => (a.toLowerCase().startsWith('debug') ? -1 : 0) - (b.toLowerCase().startsWith('debug') ? -1 : 0));
    for (const pivot of pivots) {
        const folder = path.join(projectBin, pivot);
        if (fs.existsSync(path.join(folder, dllName))) {
            return folder;
        }
    }
    return undefined;
}
/**
 * Locates the project's output DLL in the .NET 8+ "artifacts output layout"
 * (https://learn.microsoft.com/dotnet/core/sdk/artifacts-output), where bin/obj move out of each
 * project into <repoRoot>/artifacts/. Layout: artifacts/bin/<ProjectName>/<pivot>/<ProjectName>.dll
 * where <pivot> is e.g. "debug", "release", or "debug_net9.0" for multi-targeted projects.
 *
 * The standalone Model Editor loads the returned DLL and resolves its references from that same
 * folder. A module (class library) doesn't copy its NuGet dependencies to its own output by default
 * (CopyLocalLockFileAssemblies is false for libraries, true for executables). So when the module's
 * own folder lacks the DevExpress closure, we return the *same* module DLL from a project output
 * that does have it — typically the startup .Blazor/.Win app, whose output carries the full closure.
 * The model differences path passed alongside is unaffected (it stays the module's source folder).
 */
function findDllInArtifactsLayout(projectFile, logFn = noop) {
    const projectName = path.basename(projectFile, path.extname(projectFile));
    const dllName = `${projectName}.dll`;
    let dir = path.dirname(projectFile);
    while (dir && dir.length > 2) {
        const artifactsBin = path.join(dir, 'artifacts', 'bin');
        if (fs.existsSync(artifactsBin)) {
            // 1. The project's own output folder — preferred when it already carries the closure.
            const ownFolder = pickPivotFolderContaining(path.join(artifactsBin, projectName), dllName);
            if (ownFolder && folderHasDependencyClosure(ownFolder)) {
                return path.join(ownFolder, dllName);
            }
            // 2. The module's own output lacks its dependency closure. Find another project's output
            //    that holds a copy of this module DLL next to the full closure, preferring a real app
            //    over a test project and, among those, the richest folder.
            let best;
            for (const proj of listDirs(artifactsBin)) {
                const folder = pickPivotFolderContaining(path.join(artifactsBin, proj), dllName);
                if (!folder || !folderHasDependencyClosure(folder)) {
                    continue;
                }
                const cand = { dll: path.join(folder, dllName), count: countDlls(folder), isTest: /\.tests?$/i.test(proj) };
                const better = !best
                    || (best.isTest && !cand.isTest)
                    || (best.isTest === cand.isTest && cand.count > best.count);
                if (better) {
                    best = cand;
                }
            }
            if (best) {
                logFn(`[artifactsLayout] '${dllName}' output lacks its dependency closure; loading it from a project output that has it: ${best.dll}`);
                return best.dll;
            }
            // 3. Nothing complete found — fall back to the module's own DLL if it exists at all.
            if (ownFolder) {
                logFn(`[artifactsLayout] Warning: no project output with the full dependency closure found for '${dllName}'. ` +
                    `Using the module DLL as-is — build the startup project, or set <CopyLocalLockFileAssemblies>true</CopyLocalLockFileAssemblies>.`);
                return path.join(ownFolder, dllName);
            }
            return undefined; // artifacts root found, but no matching DLL — don't keep walking up
        }
        if (fs.existsSync(path.join(dir, '.git'))) {
            break;
        } // stop at the repo root
        dir = path.dirname(dir);
    }
    return undefined;
}
//# sourceMappingURL=artifactsLayout.js.map