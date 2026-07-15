import { XafModelTreeProvider } from './modelTree';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';

// The Model Editor is a Windows-only WinForms .exe. On Linux/macOS we launch it
// through Wine, which maps the Unix root at the Z: drive — so absolute Unix paths
// passed as arguments must be converted to Windows form (Z:\foo\bar).
const isWindows = process.platform === 'win32';

function toWinePath(p: string): string {
    return 'Z:' + path.resolve(p).replace(/\//g, '\\');
}

// VS Code installed as a Snap confines HOME/XDG to ~/snap/code/<rev>/…, so os.homedir()
// points into the sandbox rather than the user's real home. Resolve the real home so the
// Model Editor binaries and Wine prefix are found at their conventional locations.
function userHome(): string {
    if (process.env.SNAP_REAL_HOME) { return process.env.SNAP_REAL_HOME; }
    const home = os.homedir();
    const snapMatch = home.match(/^(.*)\/snap\/[^/]+\/[^/]+\/?$/);
    return snapMatch ? snapMatch[1] : home;
}

function userDataHome(): string {
    // Ignore a snap-redirected XDG_DATA_HOME; anchor on the real home.
    if (!process.env.SNAP && process.env.XDG_DATA_HOME) { return process.env.XDG_DATA_HOME; }
    return path.join(userHome(), '.local', 'share');
}

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
    // Register XAF Model Files Tree View
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        const treeProvider = new XafModelTreeProvider(workspaceFolders[0].uri.fsPath);
        vscode.window.registerTreeDataProvider('xafModelFiles', treeProvider);
        context.subscriptions.push(
            vscode.commands.registerCommand('xaf-modeleditor.refreshModelTree', () => treeProvider.refresh())
        );
    }
    // Command to reset the "Don't show again" dialog
    const resetDialogCmd = vscode.commands.registerCommand('xaf-modeleditor.resetStartDialog', async () => {
        const dontShowKey = 'xaf-modeleditor.suppressStartDialog';
        await context.globalState.update(dontShowKey, false);
        vscode.window.showInformationMessage("The Model Editor start dialog will be shown again next time.");
    });
    context.subscriptions.push(resetDialogCmd);
    // Command: run the bundled Wine setup script (Linux/macOS). The script ships inside the
    // extension package, so users don't need the repo — this locates and runs it for them.
    const setupWineCmd = vscode.commands.registerCommand('xaf-modeleditor.setupWine', async () => {
        if (isWindows) {
            vscode.window.showInformationMessage('Wine setup is only needed on Linux/macOS — on Windows the Model Editor runs natively.');
            return;
        }
        const script = context.asAbsolutePath(path.join('scripts', 'setup-wine.sh'));
        if (!fs.existsSync(script)) {
            vscode.window.showErrorMessage(`Wine setup script not found in the extension package (${script}).`);
            return;
        }
        try { fs.chmodSync(script, 0o755); } catch { /* best effort */ }
        const terminal = vscode.window.createTerminal('XAF Model Editor — Wine setup');
        terminal.show(true);
        terminal.sendText(`bash ${JSON.stringify(script)}`);
    });
    context.subscriptions.push(setupWineCmd);
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
            // 2. Check for user override in settings
            const config = vscode.workspace.getConfiguration('xafModelEditor');
            let exePath: string | undefined = config.get<string>('modelEditorPath');
            if (exePath && exePath.trim().length > 0) {
                exePath = exePath.trim();
                log('Using user-configured Model Editor path: ' + exePath);
            } else if (isWindows) {
                const modelEditorDir = `C:/Program Files/DevExpress ${versionShort}/Components/Tools/eXpressAppFrameworkNetCore/Model Editor/`;
                const exeName = `DevExpress.ExpressApp.ModelEditor.v${versionShort}.exe`;
                exePath = path.join(modelEditorDir, exeName);
                log('Model Editor exe path (auto-detected, Windows): ' + exePath);
            } else {
                // Linux/macOS default: XDG data dir, version-scoped (mirrors the Windows Program Files
                // layout). Drop the version's Model Editor folder here and it is found automatically:
                //   ~/.local/share/xaf-modeleditor/<version>/DevExpress.ExpressApp.ModelEditor.x64.v<version>.exe
                const dataHome = userDataHome();
                const modelEditorDir = path.join(dataHome, 'xaf-modeleditor', versionShort);
                const x64 = path.join(modelEditorDir, `DevExpress.ExpressApp.ModelEditor.x64.v${versionShort}.exe`);
                const anyCpu = path.join(modelEditorDir, `DevExpress.ExpressApp.ModelEditor.v${versionShort}.exe`);
                exePath = fs.existsSync(x64) ? x64 : anyCpu;
                log('Model Editor exe path (auto-detected, Wine): ' + exePath);
            }
            if (!fs.existsSync(exePath)) {
                vscode.window.showErrorMessage(
                    `Model Editor executable not found: ${exePath}\nDownload the correct version from DevExpress or set a custom path in settings.`,
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
                if (isWindows) {
                    modelEditorProc = spawn(exePath, args, { detached: true, stdio: 'ignore' });
                } else {
                    // Linux/macOS: run the Windows .exe through Wine. The .exe path can stay Unix-style
                    // (Wine resolves it), but path arguments handed to the .NET app must be Windows form.
                    const wineCommand = (config.get<string>('wineCommand') || '').trim() || 'wine';
                    const winePrefix = (config.get<string>('winePrefix') || '').trim()
                        || path.join(userHome(), '.wine-modeleditor');
                    const wineArgs = [exePath, ...args.map(a => (path.isAbsolute(a) ? toWinePath(a) : a))];
                    const env = {
                        ...process.env,
                        WINEPREFIX: winePrefix,
                        WINEDEBUG: process.env.WINEDEBUG || '-all',
                        // .NET-under-Wine stability. Loading a large XAF model otherwise crashes the CLR
                        // with an ExecutionEngineException (0x80131506) at the end of model build. Forcing
                        // pure JIT (no tiered/R2R) and the workstation GC keeps Wine's runtime stable.
                        DOTNET_TieredCompilation: process.env.DOTNET_TieredCompilation || '0',
                        DOTNET_TieredPGO: process.env.DOTNET_TieredPGO || '0',
                        DOTNET_ReadyToRun: process.env.DOTNET_ReadyToRun || '0',
                        DOTNET_gcServer: process.env.DOTNET_gcServer || '0',
                    };
                    log(`Launching via Wine: ${wineCommand} (WINEPREFIX=${winePrefix}) args=${JSON.stringify(wineArgs)}`);
                    modelEditorProc = spawn(wineCommand, wineArgs, { detached: true, stdio: 'ignore', env });
                }
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
    // First: search upwards for a Directory.Packages.props (Central Package Management)
    let dir = path.dirname(projectFile);
    while (dir && dir.length > 2) {
        const centralPath = path.join(dir, 'Directory.Packages.props');
        if (fs.existsSync(centralPath)) {
            log(`[getDevExpressVersion] Found Directory.Packages.props at: ${centralPath}`);
            try {
                const centralContent = fs.readFileSync(centralPath, 'utf8');
                // Match PackageVersion entries: <PackageVersion Include="DevExpress.ExpressApp.Blazor" Version="24.2.*" />
                const pkgRegex = /<PackageVersion[^>]*?(?:Include|Update)="([^"]+)"[^>]*?Version="([^"]+)"/g;
                let m;
                while ((m = pkgRegex.exec(centralContent)) !== null) {
                    const pkgName = m[1];
                    const ver = m[2];
                    if (pkgName && pkgName.startsWith('DevExpress')) {
                        log(`[getDevExpressVersion] Found version for ${pkgName} in Directory.Packages.props: ${ver}`);
                        return ver;
                    }
                }
                // Also try PackageReference-like entries inside central file (rare but possible)
                const altRegex = /<PackageReference[^>]*?(?:Include|Update)="([^"]+)"[^>]*?Version="([^"]+)"/g;
                while ((m = altRegex.exec(centralContent)) !== null) {
                    const pkgName = m[1];
                    const ver = m[2];
                    if (pkgName && pkgName.startsWith('DevExpress')) {
                        log(`[getDevExpressVersion] Found version for ${pkgName} in Directory.Packages.props (alternate): ${ver}`);
                        return ver;
                    }
                }
            } catch (e: any) {
                log(`[getDevExpressVersion] ERROR reading Directory.Packages.props: ${e?.message || e}`);
            }
            // If central file exists but no DevExpress entries found, still break and fall back to project file parsing
            break;
        }
        dir = path.dirname(dir);
    }

    // Fallback: read project file and look for DevExpress package versions
    const content = fs.readFileSync(projectFile, 'utf8');
    log(`[getDevExpressVersion] Inspecting project file: ${projectFile}`);
    // Match any DevExpress.ExpressApp.* package reference and extract the version (including wildcards)
    const regex = /<PackageReference[^>]*Include="DevExpress\.ExpressApp[^"]*"[^>]*Version="([^"]+)"/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        if (match[1]) {
            log(`[getDevExpressVersion] Found DevExpress.ExpressApp package version in project file: ${match[1]}`);
            return match[1];
        }
    }

    // Generic PackageReference entries (broader match)
    const pkgRegex2 = /<PackageReference[^>]*?(?:Include|Update)="([^"]+)"[^>]*?Version="([^"]+)"/g;
    while ((match = pkgRegex2.exec(content)) !== null) {
        const pkgName = match[1];
        const ver = match[2];
        if (pkgName && pkgName.startsWith('DevExpress')) {
            log(`[getDevExpressVersion] Found ${pkgName} version in project file: ${ver}`);
            return ver;
        }
    }

    // Fallback: try to find any Version attribute on lines mentioning DevExpress
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        if (line.includes('DevExpress')) {
            const versionMatch = line.match(/Version\s*=\s*['\"]([^'\"]+)['\"]/);
            if (versionMatch) {
                log(`[getDevExpressVersion] Line-based match for DevExpress version: ${versionMatch[1]}`);
                return versionMatch[1];
            }
        }
    }

    log('[getDevExpressVersion] DevExpress version not found in central or project files.');
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
/**
 * Locates the project's output DLL in the .NET 8+ "artifacts output layout"
 * (https://learn.microsoft.com/dotnet/core/sdk/artifacts-output), where bin/obj move out of each
 * project into <repoRoot>/artifacts/. Layout: artifacts/bin/<ProjectName>/<pivot>/<ProjectName>.dll
 * where <pivot> is e.g. "debug", "release", or "debug_net9.0" for multi-targeted projects.
 */
function findDllInArtifactsLayout(projectFile: string): string | undefined {
    const projectName = path.basename(projectFile, path.extname(projectFile));
    let dir = path.dirname(projectFile);
    while (dir && dir.length > 2) {
        const artifactsBin = path.join(dir, 'artifacts', 'bin');
        if (fs.existsSync(artifactsBin)) {
            const projectBin = path.join(artifactsBin, projectName);
            if (fs.existsSync(projectBin)) {
                let pivots: string[] = [];
                try {
                    pivots = fs.readdirSync(projectBin)
                        .filter(p => { try { return fs.statSync(path.join(projectBin, p)).isDirectory(); } catch { return false; } });
                } catch { /* ignore */ }
                // Prefer a Debug build when several pivots exist.
                pivots.sort((a, b) => (a.toLowerCase().startsWith('debug') ? -1 : 0) - (b.toLowerCase().startsWith('debug') ? -1 : 0));
                for (const pivot of pivots) {
                    const candidate = path.join(projectBin, pivot, `${projectName}.dll`);
                    if (fs.existsSync(candidate)) { return candidate; }
                }
            }
            return undefined; // artifacts root found, but no matching DLL — don't keep walking up
        }
        if (fs.existsSync(path.join(dir, '.git'))) { break; } // stop at the repo root
        dir = path.dirname(dir);
    }
    return undefined;
}

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
    }
    // Not found in the per-project bin — try the .NET 8+ artifacts output layout, where every
    // project's output lives under <repoRoot>/artifacts/bin/<ProjectName>/<config>[_<tfm>]/.
    const artifactsDll = findDllInArtifactsLayout(projectFile);
    if (artifactsDll) {
        log(`[getModelEditorArgs] Found DLL in artifacts output layout: ${artifactsDll}`);
        return [artifactsDll, dir];
    }
    log('[getModelEditorArgs] No DLL found in per-project bin or artifacts layout. Fallback to .exe scenario.');
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
