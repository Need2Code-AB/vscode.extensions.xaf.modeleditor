#!/usr/bin/env bash
#
# setup-wine.sh — configure Wine so the DevExpress XAF Model Editor (a Windows
# .NET 9 WinForms app) can run on Linux and macOS, driven by the
# "XAF Model Editor Integration" VS Code extension.
#
# What it does (idempotent — safe to re-run):
#   1. Ensures Wine is installed (apt/dnf/pacman/zypper on Linux, Homebrew on macOS).
#   2. Creates a dedicated Wine prefix (default: ~/.wine-modeleditor).
#   3. Installs the Windows .NET 9 Desktop Runtime + ASP.NET Core Runtime into it.
#   4. Prints where to drop the Model Editor binaries so the extension finds them.
#
# Config via environment variables:
#   WINEPREFIX          Wine prefix to use            (default: ~/.wine-modeleditor)
#   DOTNET_CHANNEL      .NET runtime channel          (default: 9.0)
#   MODEL_EDITOR_HOME   where Model Editor versions live
#                       (default: ${XDG_DATA_HOME:-~/.local/share}/xaf-modeleditor)
#
# Usage:
#   ./scripts/setup-wine.sh
#
set -euo pipefail

# ---------------------------------------------------------------------------- #
# Config
# ---------------------------------------------------------------------------- #
WINEPREFIX="${WINEPREFIX:-$HOME/.wine-modeleditor}"
# .NET 10 by default: the Model Editor's runtimeconfig uses rollForward=LatestMajor, so the
# highest installed runtime is used. Projects that reference .NET 10 packages (e.g.
# Microsoft.Extensions.* 10.x) need it; projects on 9.x still work (they roll forward).
# Re-run with DOTNET_CHANNEL=9.0 to also install the .NET 9 runtime alongside.
DOTNET_CHANNEL="${DOTNET_CHANNEL:-10.0}"
MODEL_EDITOR_HOME="${MODEL_EDITOR_HOME:-${XDG_DATA_HOME:-$HOME/.local/share}/xaf-modeleditor}"
export WINEPREFIX
export WINEARCH="win64"
export WINEDEBUG="${WINEDEBUG:--all}"

DL_DIR="$(mktemp -d)"
trap 'rm -rf "$DL_DIR"' EXIT

info()  { printf '\033[1;34m▶ %s\033[0m\n' "$*"; }
ok()    { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn()  { printf '\033[1;33m! %s\033[0m\n' "$*"; }
die()   { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------- #
# 1. Install Wine
# ---------------------------------------------------------------------------- #
install_wine() {
  if command -v wine >/dev/null 2>&1; then
    ok "Wine already installed ($(wine --version 2>/dev/null | head -1))"
    return
  fi
  info "Installing Wine…"
  local os; os="$(uname -s)"
  case "$os" in
    Linux)
      if command -v apt-get >/dev/null 2>&1; then
        sudo dpkg --add-architecture i386 2>/dev/null || true
        sudo apt-get update -qq
        sudo DEBIAN_FRONTEND=noninteractive apt-get install -y wine wine64 || \
          sudo DEBIAN_FRONTEND=noninteractive apt-get install -y wine
      elif command -v dnf >/dev/null 2>&1; then
        sudo dnf install -y wine
      elif command -v pacman >/dev/null 2>&1; then
        sudo pacman -Sy --noconfirm wine
      elif command -v zypper >/dev/null 2>&1; then
        sudo zypper install -y wine
      else
        die "No supported package manager found. Install Wine manually: https://wiki.winehq.org/Download"
      fi
      ;;
    Darwin)
      if command -v brew >/dev/null 2>&1; then
        brew install --cask --no-quarantine wine-stable || brew install --cask wine-stable
      else
        die "Homebrew not found. Install it (https://brew.sh) then: brew install --cask wine-stable"
      fi
      ;;
    *) die "Unsupported OS: $os" ;;
  esac
  command -v wine >/dev/null 2>&1 || die "Wine installation did not succeed."
  ok "Wine installed ($(wine --version 2>/dev/null | head -1))"
}

# ---------------------------------------------------------------------------- #
# 2. Initialize the Wine prefix
# ---------------------------------------------------------------------------- #
init_prefix() {
  info "Initializing Wine prefix at $WINEPREFIX…"
  mkdir -p "$WINEPREFIX"
  wineboot --init >/dev/null 2>&1 || true
  # Give wineserver a moment to settle.
  wineserver -w 2>/dev/null || sleep 3
  ok "Wine prefix ready."
}

# ---------------------------------------------------------------------------- #
# 3. Install the Windows .NET runtimes into the prefix
# ---------------------------------------------------------------------------- #
runtime_present() {
  # $1 = shared framework name (e.g. Microsoft.WindowsDesktop.App)
  local base="$WINEPREFIX/drive_c/Program Files/dotnet/shared/$1"
  [ -d "$base" ] && ls "$base" 2>/dev/null | grep -q "^${DOTNET_CHANNEL}\."
}

install_runtime() {
  # $1 = friendly name, $2 = aka.ms component, $3 = shared framework dir to verify
  local name="$1" component="$2" verify="$3"
  if runtime_present "$verify"; then
    ok "$name ($DOTNET_CHANNEL) already installed in prefix."
    return
  fi
  info "Downloading + installing $name ($DOTNET_CHANNEL)…"
  local url="https://aka.ms/dotnet/${DOTNET_CHANNEL}/${component}-win-x64.exe"
  local exe="$DL_DIR/${component}.exe"
  curl -fsSL "$url" -o "$exe" || die "Download failed: $url"
  wine "$exe" /install /quiet /norestart >/dev/null 2>&1 || true
  runtime_present "$verify" || warn "Could not verify $name in the prefix — the Model Editor may still work; check manually."
  ok "$name installed."
}

install_runtimes() {
  # WindowsDesktop runtime brings NETCore.App + WindowsDesktop.App; ASP.NET Core brings AspNetCore.App.
  install_runtime "Windows Desktop Runtime" "windowsdesktop-runtime" "Microsoft.WindowsDesktop.App"
  install_runtime "ASP.NET Core Runtime"    "aspnetcore-runtime"     "Microsoft.AspNetCore.App"
}

# ---------------------------------------------------------------------------- #
# 4. Guidance for the Model Editor binaries
# ---------------------------------------------------------------------------- #
print_next_steps() {
  cat <<EOF

$(ok "Wine is configured.")

Next: put the Model Editor binaries where the extension looks for them
(version-scoped, mirroring the Windows layout):

    $MODEL_EDITOR_HOME/<version>/

For DevExpress 25.2 that is:

    $MODEL_EDITOR_HOME/25.2/DevExpress.ExpressApp.ModelEditor.x64.v25.2.exe
    (+ the DevExpress *.dll files that ship alongside it)

Copy the whole "Model Editor" folder from a Windows DevExpress install:

    C:\\Program Files\\DevExpress 25.2\\Components\\Tools\\eXpressAppFrameworkNetCore\\Model Editor

Then in VS Code just right-click a Model.xafml → "Open with XAF Model Editor".
The extension auto-detects the version and launches the .exe through Wine
(prefix: $WINEPREFIX).

Optional VS Code settings (only if you deviate from the defaults):
    "xafModelEditor.modelEditorPath": "/abs/path/to/....ModelEditor.x64.v25.2.exe"
    "xafModelEditor.winePrefix":      "$WINEPREFIX"
    "xafModelEditor.wineCommand":     "wine"
EOF
}

# ---------------------------------------------------------------------------- #
main() {
  info "XAF Model Editor — Wine setup"
  install_wine
  init_prefix
  install_runtimes
  mkdir -p "$MODEL_EDITOR_HOME"
  print_next_steps
}
main "$@"
