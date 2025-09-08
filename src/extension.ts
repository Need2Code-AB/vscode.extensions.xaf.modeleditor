import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

/**
 * Activates the extension.
 * Registers context menu and double-click for Model.xafml files.
 */
export function activate(context: vscode.ExtensionContext) {
    const openModelEditorCmd = vscode.commands.registerCommand('xaf-modeleditor.openModelEditor', async (fileUri: vscode.Uri) => {
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
            const versionShort = version.split('.').slice(0,2).join('.');
            // 2. Build Model Editor path
            const modelEditorDir = `C:/Program Files/DevExpress ${versionShort}/Components/Tools/eXpressAppFrameworkNetCore/Model Editor/`;
            const exeName = `DevExpress.ExpressApp.ModelEditor.v${versionShort}.exe`;
            const exePath = path.join(modelEditorDir, exeName);
            if (!fs.existsSync(exePath)) {
                vscode.window.showErrorMessage(
                    `Model Editor executable not found: ${exePath}\nDownload the correct version from DevExpress.`,
                    'Download'
                ).then(selection => {
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
            spawn(exePath, args, { detached: true });
        } catch (err: any) {
            vscode.window.showErrorMessage('Unexpected error: ' + err.message);
        }
    });
    context.subscriptions.push(openModelEditorCmd);
}

export function deactivate() {}

/**
 * Finds the closest .csproj or Directory.Build.props file from the given file upwards.
 */
async function findProjectFile(fileUri: vscode.Uri): Promise<string | undefined> {
    let dir = path.dirname(fileUri.fsPath);
    while (dir && dir.length > 2) {
        const csproj = fs.readdirSync(dir).find(f => f.endsWith('.csproj'));
        if (csproj) return path.join(dir, csproj);
        if (fs.existsSync(path.join(dir, 'Directory.Build.props'))) return path.join(dir, 'Directory.Build.props');
        dir = path.dirname(dir);
    }
    return undefined;
}

/**
 * Reads DevExpress.ExpressApp version from project file.
 */
async function getDevExpressVersion(projectFile: string): Promise<string | undefined> {
    const content = fs.readFileSync(projectFile, 'utf8');
    const match = content.match(/<PackageReference[^>]*Include="DevExpress.ExpressApp"[^>]*Version="([0-9.]+)"/);
    return match ? match[1] : undefined;
}

/**
 * Finds the closest .sln file from the given file upwards.
 */
async function findSolutionFile(fileUri: vscode.Uri): Promise<string | undefined> {
    let dir = path.dirname(fileUri.fsPath);
    while (dir && dir.length > 2) {
        const sln = fs.readdirSync(dir).find(f => f.endsWith('.sln'));
        if (sln) return path.join(dir, sln);
        dir = path.dirname(dir);
    }
    return undefined;
}

/**
 * Builds the solution using dotnet build.
 */
async function buildSolution(solutionFile: string): Promise<boolean> {
    return new Promise((resolve) => {
        const build = spawn('dotnet', ['build', solutionFile], { shell: true });
        build.on('close', (code) => resolve(code === 0));
    });
}

/**
 * Determines the correct arguments for Model Editor based on project type.
 */
async function getModelEditorArgs(projectFile: string, xafmlUri: vscode.Uri): Promise<string[]> {
    // For simplicity, use the .exe.config and .exe in the same folder as the .csproj
    const dir = path.dirname(projectFile);
    const exe = fs.readdirSync(dir).find(f => f.endsWith('.exe'));
    const config = exe ? exe + '.config' : undefined;
    const args: string[] = [];
    if (exe && config) {
        args.push(path.join(dir, config));
        args.push(path.join(dir, exe));
        args.push(path.dirname(xafmlUri.fsPath));
    } else {
        // fallback: just open Model Editor
        args.push(xafmlUri.fsPath);
    }
    return args;
}
