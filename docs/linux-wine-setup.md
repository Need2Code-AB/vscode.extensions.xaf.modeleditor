# Running the XAF Model Editor on Linux & macOS (via Wine)

The DevExpress XAF Model Editor is a **Windows .NET 9 WinForms** application. It has no
native Linux/macOS build, but it runs well under [Wine](https://www.winehq.org/) once the
Windows .NET runtimes are present. This extension launches it through Wine automatically.

## TL;DR

```bash
# 1. Configure Wine + the .NET 9 runtimes (idempotent):
./scripts/setup-wine.sh

# 2. Copy the Model Editor binaries from a Windows DevExpress install to:
#      ~/.local/share/xaf-modeleditor/<version>/
#    e.g. for 25.2:
#      ~/.local/share/xaf-modeleditor/25.2/DevExpress.ExpressApp.ModelEditor.x64.v25.2.exe
```

Then in VS Code: right-click a `Model.xafml` → **Open with XAF Model Editor**.

---

## 1. Configure Wine

Run the helper script — it installs Wine (if missing), creates a dedicated prefix, and
installs the Windows **.NET 9 Desktop Runtime** + **ASP.NET Core Runtime** into it:

```bash
./scripts/setup-wine.sh
```

It is safe to re-run. Override defaults with environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `WINEPREFIX` | `~/.wine-modeleditor` | Dedicated Wine prefix for the editor |
| `DOTNET_CHANNEL` | `9.0` | .NET runtime channel to install |
| `MODEL_EDITOR_HOME` | `~/.local/share/xaf-modeleditor` | Where version folders live |

<details>
<summary>What the script does manually (if you prefer to do it by hand)</summary>

```bash
export WINEPREFIX="$HOME/.wine-modeleditor" WINEARCH=win64
wineboot --init

# .NET 10 Windows Desktop Runtime (WinForms) + ASP.NET Core Runtime.
# The Model Editor's runtimeconfig uses rollForward=LatestMajor, so it runs on the highest
# installed runtime. Install .NET 10 if your project references .NET 10 packages
# (e.g. Microsoft.Extensions.* 10.x); .NET 9 projects still work (they roll forward).
curl -fsSL https://aka.ms/dotnet/10.0/windowsdesktop-runtime-win-x64.exe -o /tmp/wd.exe
curl -fsSL https://aka.ms/dotnet/10.0/aspnetcore-runtime-win-x64.exe    -o /tmp/ac.exe
wine /tmp/wd.exe /install /quiet /norestart
wine /tmp/ac.exe /install /quiet /norestart

# Verify:
ls "$WINEPREFIX/drive_c/Program Files/dotnet/shared"
#   Microsoft.AspNetCore.App  Microsoft.NETCore.App  Microsoft.WindowsDesktop.App
```
</details>

## 2. Get the Model Editor binaries

DevExpress does not ship the editor separately for Linux — copy it from any Windows
machine that has DevExpress installed. On Windows it lives here:

```
C:\Program Files\DevExpress 25.2\Components\Tools\eXpressAppFrameworkNetCore\Model Editor
```

Copy that **whole folder** (the `.exe` needs the `DevExpress.*.dll` files beside it) to a
**version-scoped** directory on your machine:

```
~/.local/share/xaf-modeleditor/25.2/
├── DevExpress.ExpressApp.ModelEditor.x64.v25.2.exe   ← launched by the extension
├── DevExpress.ExpressApp.ModelEditor.v25.2.exe
├── DevExpress.*.dll                                  (~44 files)
└── ...
```

The extension detects your project's DevExpress version and looks in
`~/.local/share/xaf-modeleditor/<version>/` automatically — mirroring the Windows layout,
so no per-machine path configuration is needed.

## 3. Use it

Right-click a `Model.xafml` in the Explorer → **Open with XAF Model Editor**. The extension
builds the solution, then launches the editor through Wine.

## Configuration (optional)

Set these in VS Code **Settings** only if you deviate from the defaults:

| Setting | Default | Notes |
|---|---|---|
| `xafModelEditor.modelEditorPath` | *(auto-detected)* | Absolute path to the `.exe` — skips auto-detection |
| `xafModelEditor.winePrefix` | `~/.wine-modeleditor` | Prefix that holds the .NET runtimes |
| `xafModelEditor.wineCommand` | `wine` | Set to e.g. `/usr/bin/wine` if `wine` is not on PATH |

## Troubleshooting

- **"Model Editor executable not found" pointing at `~/snap/code/<rev>/…`**
  VS Code installed as a **Snap** confines `HOME`. The extension resolves your real home
  automatically (via `SNAP_REAL_HOME`); make sure the binaries are under your *real*
  `~/.local/share/xaf-modeleditor/<version>/`, not the snap sandbox. (Upgrade to ≥ 0.0.22.)
- **`wine: command not found` when launched from a Snap VS Code**
  Set `"xafModelEditor.wineCommand": "/usr/bin/wine"` (absolute path).
- **A window never appears**
  Confirm the runtimes installed: `ls "$WINEPREFIX/drive_c/Program Files/dotnet/shared"`.
  Check the **Output → XAF Model Editor** panel for the exact command and Wine errors.
- **macOS (Apple Silicon)**
  Wine needs Rosetta 2 (`softwareupdate --install-rosetta`) and an x86‑64 Wine build.
  Otherwise identical to Linux.
- **Fonts/skinning look rough** — cosmetic only under Wine; the editor is fully functional.
