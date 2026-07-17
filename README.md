# XAF Model Editor Integration for VS Code

[![Build and Publish](https://github.com/Need2Code-AB/vscode.extensions.xaf.modeleditor/actions/workflows/build-and-publish.yml/badge.svg)](https://github.com/Need2Code-AB/vscode.extensions.xaf.modeleditor/actions/workflows/build-and-publish.yml)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/DvisiousNeed2CodeAB.xaf-modeleditor)](https://marketplace.visualstudio.com/items?itemName=DvisiousNeed2CodeAB.xaf-modeleditor)

Open the **DevExpress XAF Model Editor** straight from Visual Studio Code. Right-click a
`Model.xafml` file and the extension detects your DevExpress version, builds the solution,
and launches the matching Model Editor — on **Windows natively, and on Linux & macOS through
Wine**.

---

## Features

- **Automatic version detection** — reads the DevExpress version from your project, including
  `Directory.Packages.props` (central package management).
- **Launches the right editor** for that version, building the solution first.
- **Context-menu & tree integration** for `Model.xafml` files.
- **Cross-platform** — Windows natively; Linux and macOS via Wine.
- **Flexible output discovery** — classic per-project `bin/` *and* the
  [.NET 8+ artifacts output layout](https://learn.microsoft.com/dotnet/core/sdk/artifacts-output).
- **Clear diagnostics** — every step is logged to the **Output → XAF Model Editor** panel.

## Supported platforms

| Platform | How it runs | Extra setup |
|---|---|---|
| **Windows** | Native (`.exe` launched directly) | DevExpress installed |
| **Linux** | Windows `.exe` via **Wine** | Wine + .NET runtimes + editor binaries |
| **macOS** | Windows `.exe` via **Wine** | Wine (+ Rosetta 2 on Apple Silicon) + runtimes + binaries |

**Build layouts:** both the classic per-project `bin/<config>/<tfm>/` layout and the .NET 8+
[artifacts output layout](https://learn.microsoft.com/en-us/dotnet/core/sdk/artifacts-output)
(`<UseArtifactsOutput>`) are supported and auto-detected.

> **Platform notes & deep dives** live in [`docs/`](docs/):
> - [Running on Linux & macOS via Wine](docs/linux-wine-setup.md) — full setup for all three platforms.
> - [Artifacts output layout & module dependency-closure](docs/specs/artifacts-output-layout.md) —
>   why opening the Model Editor against a **module** project needs its dependency closure
>   (set `<CopyLocalLockFileAssemblies>true</CopyLocalLockFileAssemblies>`, or let the extension
>   resolve it from the startup app's output), plus the current cross-platform validation status.

---

## Installation & setup

### 1. Install the extension

- **From the Marketplace:** search for **“XAF Model Editor Integration”** in the Extensions
  view, or install
  [DvisiousNeed2CodeAB.xaf-modeleditor](https://marketplace.visualstudio.com/items?itemName=DvisiousNeed2CodeAB.xaf-modeleditor).
- **From a `.vsix`:** `code --install-extension xaf-modeleditor-<version>.vsix`.

You also need the **.NET SDK** installed (the extension builds your solution before opening
the editor).

### 2. Prepare the Model Editor

The Model Editor itself is **not** bundled with the extension — it ships with DevExpress. How
you provide it depends on your OS.

#### Windows

Install DevExpress and you are done — the editor lives at its standard location and is
auto-detected:

```
C:\Program Files\DevExpress 25.2\Components\Tools\eXpressAppFrameworkNetCore\Model Editor\
```

If DevExpress is on another drive or a custom path, point the extension at the executable via
the `xafModelEditor.modelEditorPath` setting (see [Configuration](#configuration)).

#### Linux & macOS (via Wine)

The Model Editor is a Windows .NET WinForms application, so it runs through
[Wine](https://www.winehq.org/). Two one-time steps:

**a) Configure Wine + the .NET runtimes.** Open the **Command Palette** (`Ctrl+Shift+P`) and run
**“XAF Model Editor: Set up Wine (Linux/macOS)”**. This runs the setup script that ships inside
the extension — it installs Wine (if missing), creates a dedicated prefix, and installs the
Windows .NET Desktop + ASP.NET Core runtimes.

Prefer a terminal? The script is bundled with the installed extension:

```bash
bash ~/.vscode/extensions/dvisiousneed2codeab.xaf-modeleditor-*/scripts/setup-wine.sh
# …or, from a clone of this repository:
./scripts/setup-wine.sh
```

**b) Copy the Model Editor binaries** from any Windows machine with DevExpress installed (the
folder shown above) into a **version-scoped** directory — this mirrors the Windows layout so
the extension finds it automatically:

```
~/.local/share/xaf-modeleditor/25.2/
├── DevExpress.ExpressApp.ModelEditor.x64.v25.2.exe   ← launched by the extension
├── DevExpress.*.dll                                  (~44 DevExpress assemblies)
└── ...
```

Full walkthrough, manual steps, and troubleshooting:
**[docs/linux-wine-setup.md](docs/linux-wine-setup.md)**.

### 3. Verify

Right-click any `Model.xafml` → **Open with XAF Model Editor**. The first launch takes a few
seconds (it builds the solution). Watch **Output → XAF Model Editor** if anything is off.

---

## Usage

1. **Right-click** a `Model.xafml` file in the Explorer (or use the **XAF Model Files** view).
2. Choose **Open with XAF Model Editor**.
3. The extension builds the solution and launches the editor for your DevExpress version.

## Configuration

Settings live under **XAF Model Editor** (`Ctrl+,` → search `xafModelEditor`):

| Setting | Default | Description |
|---|---|---|
| `xafModelEditor.modelEditorPath` | *(auto-detected)* | Absolute path to the Model Editor `.exe`. On Linux/macOS this points at the Windows `.exe` that is launched via Wine. Overrides auto-detection. |
| `xafModelEditor.winePrefix` | `~/.wine-modeleditor` | *(Non-Windows)* Wine prefix holding the Windows .NET runtimes. |
| `xafModelEditor.wineCommand` | `wine` | *(Non-Windows)* Wine executable — set to e.g. `/usr/bin/wine` if `wine` is not on `PATH`. |

Example (Windows):

```jsonc
"xafModelEditor.modelEditorPath": "D:/DevExpress/Tools/ModelEditor/DevExpress.ExpressApp.ModelEditor.v25.2.exe"
```

---

## Troubleshooting

- **Version mismatch / editor not found** — make sure the Model Editor for *your* DevExpress
  version is installed (Windows) or present under `~/.local/share/xaf-modeleditor/<version>/`
  (Linux/macOS). Missing on Windows? Download it from the
  [DevExpress Download Manager](https://www.devexpress.com/ClientCenter/DownloadManager/).
- **Nothing happens / build fails** — open **Output → XAF Model Editor**; it logs the exact
  executable, arguments, and any build errors.
- **Linux/macOS specifics** (path points inside `~/snap/...`, `wine: command not found`, CLR
  crash on model load, …) — see the troubleshooting section in
  [docs/linux-wine-setup.md](docs/linux-wine-setup.md).

---

## Project structure

```text
.
├── .github/workflows/
│   └── build-and-publish.yml     # CI: build, package, publish to the Marketplace
├── src/
│   ├── extension.ts              # Main extension logic (detect version, build, launch)
│   └── modelTree.ts              # "XAF Model Files" tree view provider
├── resources/
│   └── xaf.svg                   # Activity-bar / extension icon
├── scripts/
│   └── setup-wine.sh             # Linux/macOS: configure Wine + .NET runtimes
├── docs/
│   ├── linux-wine-setup.md       # Wine setup guide
│   └── PUBLISHING.md             # Publishing & CI/CD guide
├── build-vsix.ps1                # PowerShell build helper
├── package.json                  # Extension manifest & settings
└── README.md
```

## Development & building

**Prerequisites:** Node.js 18+, npm, TypeScript, VS Code.

```bash
npm install        # install dependencies
npm run compile    # compile TypeScript -> out/
npm run package    # produce a .vsix
npm run watch      # rebuild on change during development
```

Or use the PowerShell helper (compiles, packages, bumps the version):

```powershell
.\build-vsix.ps1
```

## CI/CD & publishing

GitHub Actions (`build-and-publish.yml`):

- **On push / PR to `main`** — build, compile, package, and upload the `.vsix` as an artifact.
- **On a published GitHub Release** — `vsce publish` to the VS Code Marketplace and attach the
  `.vsix` to the release. Requires the repository secret **`VSCE_PAT`** (an Azure DevOps
  Marketplace token).

To ship a new version: bump `version` in `package.json`, merge to `main`, then create a
GitHub Release whose tag matches that version. See [docs/PUBLISHING.md](docs/PUBLISHING.md).

---

## License

MIT License — Copyright (c) 2026 Need2Code AB.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software
and associated documentation files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
