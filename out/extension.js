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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
/**
 * Activates the extension.
 * Registers context menu and double-click for Model.xafml files.
 */
function activate(context) {
    const openModelEditorCmd = vscode.commands.registerCommand('xaf-modeleditor.openModelEditor', async (fileUri) => {
        try {
            // 1. Find project file and DevExpress version
            const projectFile = await findProjectFile(fileUri);
            if (!projectFile) {
                vscode.window.showErrorMessage('Could not find a project file (.csproj) or Directory.Build.props in the workspace.');
                return;
            }
            const version = await getDevExpressVersion(projectFile);
            if (!version) {
                vscode.window.showErrorMessage('Could not determine DevExpress version from project file.');
                return;
            }
            const versionShort = version.split('.').slice(0, 2).join('.');
            // 2. Build Model Editor path
            const modelEditorDir = `C:/Program Files/DevExpress ${versionShort}/Components/Tools/eXpressAppFrameworkNetCore/Model Editor/`;
            const exeName = `DevExpress.ExpressApp.ModelEditor.v${versionShort}.exe`;
            const exePath = path.join(modelEditorDir, exeName);
            if (!fs.existsSync(exePath)) {
                vscode.window.showErrorMessage(`Model Editor executable not found: ${exePath}\nDownload the correct version from DevExpress.`, 'Download').then(selection => {
                    if (selection === 'Download') {
                        vscode.env.openExternal(vscode.Uri.parse('https://www.devexpress.com/ClientCenter/DownloadManager/'));
                    }
                });
                return;
            }
            // 3. Build the solution
            const solutionFile = await findSolutionFile(fileUri);
            if (!solutionFile) {
                vscode.window.showErrorMessage('Could not find a .sln file in the workspace.');
                return;
            }
            const buildResult = await buildSolution(solutionFile);
            if (!buildResult) {
                vscode.window.showErrorMessage('Build failed. Model Editor will not be started.');
                return;
            }
            // 4. Start Model Editor with correct arguments
            const args = await getModelEditorArgs(projectFile, fileUri);
            (0, child_process_1.spawn)(exePath, args, { detached: true });
        }
        catch (err) {
            vscode.window.showErrorMessage('Unexpected error: ' + err.message);
        }
    });
    context.subscriptions.push(openModelEditorCmd);
}
function deactivate() { }
/**
 * Finds the closest .csproj or Directory.Build.props file from the given file upwards.
 */
async function findProjectFile(fileUri) {
    let dir = path.dirname(fileUri.fsPath);
    while (dir && dir.length > 2) {
        const csproj = fs.readdirSync(dir).find(f => f.endsWith('.csproj'));
        if (csproj)
            return path.join(dir, csproj);
        if (fs.existsSync(path.join(dir, 'Directory.Build.props')))
            return path.join(dir, 'Directory.Build.props');
        dir = path.dirname(dir);
    }
    return undefined;
}
/**
 * Reads DevExpress.ExpressApp version from project file.
 */
async function getDevExpressVersion(projectFile) {
    const content = fs.readFileSync(projectFile, 'utf8');
    const match = content.match(/<PackageReference[^>]*Include="DevExpress.ExpressApp"[^>]*Version="([0-9.]+)"/);
    return match ? match[1] : undefined;
}
/**
 * Finds the closest .sln file from the given file upwards.
 */
async function findSolutionFile(fileUri) {
    let dir = path.dirname(fileUri.fsPath);
    while (dir && dir.length > 2) {
        const sln = fs.readdirSync(dir).find(f => f.endsWith('.sln'));
        if (sln)
            return path.join(dir, sln);
        dir = path.dirname(dir);
    }
    return undefined;
}
/**
 * Builds the solution using dotnet build.
 */
async function buildSolution(solutionFile) {
    return new Promise((resolve) => {
        const build = (0, child_process_1.spawn)('dotnet', ['build', solutionFile], { shell: true });
        build.on('close', (code) => resolve(code === 0));
    });
}
/**
 * Determines the correct arguments for Model Editor based on project type.
 */
async function getModelEditorArgs(projectFile, xafmlUri) {
    // For simplicity, use the .exe.config and .exe in the same folder as the .csproj
    const dir = path.dirname(projectFile);
    const exe = fs.readdirSync(dir).find(f => f.endsWith('.exe'));
    const config = exe ? exe + '.config' : undefined;
    const args = [];
    if (exe && config) {
        args.push(path.join(dir, config));
        args.push(path.join(dir, exe));
        args.push(path.dirname(xafmlUri.fsPath));
    }
    else {
        // fallback: just open Model Editor
        args.push(xafmlUri.fsPath);
    }
    return args;
}
//# sourceMappingURL=extension.js.map