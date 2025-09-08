import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

// Output channel for extension logs
const outputChannel = vscode.window.createOutputChannel('XAF Model Editor');

// Optional: log to file (uncomment if needed)
// const logFilePath = path.join(__dirname, 'xaf-modeleditor.log');
function log(message: string) {
    const timestamp = new Date().toISOString();
    outputChannel.appendLine(`[${timestamp}] ${message}`);
    // Uncomment to also log to file
    // fs.appendFileSync(logFilePath, `[${timestamp}] ${message}\n`);
}

/**
 * Activates the extension.
 * Registers context menu and double-click for Model.xafml files.
 */
export function activate(context: vscode.ExtensionContext) {
    const openModelEditorCmd = vscode.commands.registerCommand('xaf-modeleditor.openModelEditor', async (fileUri: vscode.Uri) => {
        outputChannel.show(true);
        log('Command triggered for file: ' + (fileUri?.fsPath || 'undefined'));
        try {
            // 1. Find project file and DevExpress version
            const projectFile = await findProjectFile(fileUri);
            log('Project file found: ' + projectFile);
            if (!projectFile) {
                vscode.window.showErrorMessage('Could not find a project file (.csproj) or Directory.Build.props in the workspace.');
                log('ERROR: Project file not found.');
                return;
            }
            const version = await getDevExpressVersion(projectFile);
            log('DevExpress version: ' + version);
            if (!version) {
                vscode.window.showErrorMessage('Could not determine DevExpress version from project file.');
                log('ERROR: DevExpress version not found.');
                return;
            }
            const versionShort = version.split('.').slice(0,2).join('.');
            // 2. Build Model Editor path
            const modelEditorDir = `C:/Program Files/DevExpress ${versionShort}/Components/Tools/eXpressAppFrameworkNetCore/Model Editor/`;
            const exeName = `DevExpress.ExpressApp.ModelEditor.v${versionShort}.exe`;
            const exePath = path.join(modelEditorDir, exeName);
            log('Model Editor exe path: ' + exePath);
            if (!fs.existsSync(exePath)) {
                vscode.window.showErrorMessage(
                    `Model Editor executable not found: ${exePath}\nDownload the correct version from DevExpress.`,
                    'Download'
                ).then(selection => {
                    if (selection === 'Download') {
                        vscode.env.openExternal(vscode.Uri.parse('https://www.devexpress.com/ClientCenter/DownloadManager/'));
                    }
                });
                log('ERROR: Model Editor executable not found.');
                return;
            }
            // 3. Kontrollera att DLL eller EXE finns, annars be användaren bygga själv
            let args: string[] = [];
            let foundExecutable = false;
            try {
                args = await getModelEditorArgs(projectFile, fileUri);
                // Kontrollera om args innehåller en DLL eller EXE som faktiskt finns
                if (args.length > 0) {
                    const firstArg = args[0];
                    if (firstArg.endsWith('.dll') || firstArg.endsWith('.exe')) {
                        if (fs.existsSync(firstArg)) {
                            foundExecutable = true;
                        }
                    } else {
                        // fallback: xafml path, så ingen exe/dll hittad
                        foundExecutable = false;
                    }
                }
            } catch (argErr: any) {
                log('ERROR: Exception in getModelEditorArgs: ' + (argErr?.message || argErr));
                vscode.window.showErrorMessage('Error while preparing Model Editor arguments: ' + (argErr?.message || argErr));
                return;
            }
            if (!foundExecutable) {
                log('No DLL or EXE found for Model Editor. Please build the solution first.');
                vscode.window.showErrorMessage('No DLL or EXE found for Model Editor. Please build the solution first.');
                return;
            }
            // Show info dialog with "Don't show again" button (for compatibility)
            const dontShowKey = 'xaf-modeleditor.suppressStartDialog';
            const suppressDialog = context.globalState.get<boolean>(dontShowKey, false);
            if (!suppressDialog) {
                const infoMsg =
                    'Model Editor is starting.\n' +
                    'This may take several seconds (just like in Visual Studio 2022).\n' +
                    '\n' +
                    'Executable: ' + exePath + '\n' +
                    'Arguments: ' + args.map(a => `"${a}"`).join(' ') + '\n' +
                    '\n' +
                    'If the Model Editor does not appear, check the Output panel for details.';
                vscode.window.showInformationMessage(infoMsg, { modal: true }, 'OK', "Don't show again")
                    .then(result => {
                        if (result === "Don't show again") {
                            context.globalState.update(dontShowKey, true);
                        }
                    });
            }
            log('Launching Model Editor with args: ' + JSON.stringify(args));
            let modelEditorProc: any = undefined;
            try {
                modelEditorProc = spawn(exePath, args, { detached: true, stdio: 'ignore' });
            } catch (spawnErr: any) {
                log('ERROR: Failed to spawn Model Editor process: ' + (spawnErr?.message || spawnErr));
                vscode.window.showErrorMessage('Failed to start Model Editor: ' + (spawnErr?.message || spawnErr));
                return;
            }
            if (!modelEditorProc || !modelEditorProc.pid) {
                log('ERROR: Model Editor process did not start.');
                vscode.window.showErrorMessage('Model Editor process did not start. Check path and permissions.');
                return;
            }
            log('Model Editor process started. PID: ' + modelEditorProc.pid);
            modelEditorProc.on('error', (err: any) => {
                log('ERROR: Model Editor process error: ' + (err?.message || err));
                vscode.window.showErrorMessage('Model Editor process error: ' + (err?.message || err));
            });
            modelEditorProc.on('exit', (code: number, signal: string) => {
                log(`Model Editor process exited. Code: ${code}, Signal: ${signal}`);
                if (code !== 0) {
                    vscode.window.showErrorMessage(`Model Editor exited with code ${code} (signal: ${signal})`);
                }
            });
            log('Model Editor launched (event listeners attached).');
        } catch (err: any) {
            vscode.window.showErrorMessage('Unexpected error: ' + err.message);
            log('UNEXPECTED ERROR: ' + err.message + '\n' + (err.stack || ''));
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
    // Match any DevExpress.ExpressApp.* package reference and extract the version
    const regex = /<PackageReference[^>]*Include="DevExpress\.ExpressApp[^"]*"[^>]*Version="([0-9.]+)"/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        if (match[1]) return match[1];
    }
    // Fallback: try to match Version attribute anywhere on a line with DevExpress.ExpressApp
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        if (line.includes('DevExpress.ExpressApp')) {
            const versionMatch = line.match(/Version\s*=\s*['\"]([0-9.]+)['\"]/);
            if (versionMatch) return versionMatch[1];
        }
    }
    return undefined;
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
        log(`[buildSolution] Running: dotnet build "${solutionFile}"`);
        const build = spawn('dotnet', ['build', solutionFile], { shell: true });
        let stdout = '';
        let stderr = '';
        build.stdout && build.stdout.on('data', (data) => {
            const text = data.toString();
            stdout += text;
        });
        build.stderr && build.stderr.on('data', (data) => {
            const text = data.toString();
            stderr += text;
        });
        build.on('close', (code) => {
            log(`[buildSolution] dotnet build exited with code ${code}`);
            if (stdout) log(`[buildSolution] stdout:\n${stdout}`);
            if (stderr) log(`[buildSolution] stderr:\n${stderr}`);
            if (code !== 0) {
                vscode.window.showErrorMessage('dotnet build failed. See Output for details.');
            }
            resolve(code === 0);
        });
        build.on('error', (err) => {
            log(`[buildSolution] ERROR: ${err?.message || err}`);
            vscode.window.showErrorMessage('dotnet build process could not be started: ' + (err?.message || err));
            resolve(false);
        });
    });
}

/**
 * Determines the correct arguments for Model Editor based on project type.
 */
async function getModelEditorArgs(projectFile: string, xafmlUri: vscode.Uri): Promise<string[]> {
    const dir = path.dirname(projectFile);
    log(`[getModelEditorArgs] Project dir: ${dir}`);
    // Sök efter DLL i valfri bin/<config>/net*/-mapp
    let binDir: string | undefined;
    let foundConfig: string | undefined;
    let foundTarget: string | undefined;
    const binRoot = path.join(dir, 'bin');
    log(`[getModelEditorArgs] Checking binRoot: ${binRoot}`);
    if (fs.existsSync(binRoot)) {
        const configs = fs.readdirSync(binRoot).filter(f => fs.statSync(path.join(binRoot, f)).isDirectory());
        log(`[getModelEditorArgs] Found configs: ${configs.join(', ')}`);
        for (const cfg of configs) {
            const cfgDir = path.join(binRoot, cfg);
            log(`[getModelEditorArgs] Checking config dir: ${cfgDir}`);
            const targets = fs.readdirSync(cfgDir).filter(f => fs.statSync(path.join(cfgDir, f)).isDirectory() && f.toLowerCase().startsWith('net'));
            log(`[getModelEditorArgs] Found targets in ${cfg}: ${targets.join(', ')}`);
            for (const t of targets) {
                const targetDir = path.join(cfgDir, t);
                log(`[getModelEditorArgs] Checking target dir: ${targetDir}`);
                const dlls = fs.readdirSync(targetDir).filter(f => f.endsWith('.dll') && f.toLowerCase().includes(path.basename(dir).toLowerCase()));
                log(`[getModelEditorArgs] DLLs in ${targetDir}: ${dlls.join(', ')}`);
                if (dlls.length > 0) {
                    binDir = targetDir;
                    foundConfig = cfg;
                    foundTarget = t;
                    log(`[getModelEditorArgs] Using DLL: ${dlls[0]} in ${binDir}`);
                    break;
                }
            }
            if (binDir) break;
        }
    } else {
        log(`[getModelEditorArgs] binRoot does not exist: ${binRoot}`);
    }
    let dll: string | undefined;
    if (binDir) {
        dll = fs.readdirSync(binDir).find(f => f.endsWith('.dll') && f.toLowerCase().includes(path.basename(dir).toLowerCase()));
        if (dll) {
            dll = path.join(binDir, dll);
            log(`[getModelEditorArgs] Final DLL path: ${dll}`);
        } else {
            log(`[getModelEditorArgs] No matching DLL found in ${binDir}`);
        }
    }
    // Logga sökväg och val
    if (binDir && dll) {
        log(`[getModelEditorArgs] Found DLL: ${dll} (config: ${foundConfig}, target: ${foundTarget})`);
        return [dll, dir];
    } else {
        log('[getModelEditorArgs] No DLL found in any bin/<config>/net*/ folder. Fallback to .exe scenario.');
    }
    // Otherwise, fallback to .exe.config and .exe (Win scenario)
    log('[getModelEditorArgs] Fallback: searching for .exe and .config in ' + dir);
    const exe = fs.readdirSync(dir).find(f => f.endsWith('.exe'));
    const config = exe ? exe + '.config' : undefined;
    const args: string[] = [];
    log(`[getModelEditorArgs] Found exe: ${exe}, config: ${config}`);
    if (exe && config) {
        args.push(path.join(dir, config));
        args.push(path.join(dir, exe));
        args.push(path.dirname(xafmlUri.fsPath));
        log(`[getModelEditorArgs] Using args: ${args.join(', ')}`);
    } else {
        // fallback: just open Model Editor
        args.push(xafmlUri.fsPath);
        log(`[getModelEditorArgs] Fallback: only xafml path as arg: ${xafmlUri.fsPath}`);
    }
    return args;
}
