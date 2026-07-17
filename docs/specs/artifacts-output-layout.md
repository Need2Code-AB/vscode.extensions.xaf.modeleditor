# Spec: .NET artifacts output layout support & module dependency-closure fallback

- **Issue:** [#1 — Add support for solutions using .NET 8 "artifacts output layout"](https://github.com/Need2Code-AB/vscode.extensions.xaf.modeleditor/issues/1)
- **Reported by:** jhorv-ci — 2026-05-08
- **Status:** Implemented; unit-verified and **validated end-to-end on Linux/Wine** (§4.2). A separate Wine text-rendering crash (§4.3) and macOS/Windows/real-display checks (§4.4) remain.
- **Branch:** `feat/linux-macos-wine-support`
- **Code:** [src/artifactsLayout.ts](../../src/artifactsLayout.ts), used by [src/extension.ts](../../src/extension.ts)

---

## 1. Background

The extension launches the DevExpress **standalone Model Editor** and points it at a project's
output assembly. Its command line (per DevExpress docs) is:

```
DevExpress.ExpressApp.ModelEditor.vXX.exe  <moduleAssemblyFile>  <diffsPath>
```

- `moduleAssemblyFile` — the built DLL of the project whose `*.xafml` was opened.
- `diffsPath` — the project source folder that holds `Model.DesignedDiffs.xafml`.

The Model Editor loads `moduleAssemblyFile`, instantiates the XAF module type, and **resolves that
assembly's references from the same folder the DLL sits in** (standard .NET assembly probing).

### The two problems in the issue

**Problem A — the artifacts output layout (the literal request).**
Historically the extension only looked for `bin/<config>/<tfm>/`. .NET 8+ offers the
[artifacts output layout](https://learn.microsoft.com/en-us/dotnet/core/sdk/artifacts-output)
(`<UseArtifactsOutput>` / `<ArtifactsPath>` in `Directory.Build.props`), which consolidates every
project's output into one folder at the repo root:

```
artifacts/
  bin/<ProjectName>/<pivot>/<ProjectName>.dll     # pivot = debug | release | debug_net8.0 | release_linux-x64 | ...
  obj/…  publish/…  package/…
```

When this layout is used, no `bin/` exists inside each project, so the old lookup found nothing.

**Problem B — the missing dependency closure (surfaced while validating the fix).**
Even after the DLL is found, opening the Model Editor against a **module (class library)** project
fails with:

```
Could not load file or assembly 'DevExpress.Persistent.BaseImpl.EFCore.v26.1,
Version=26.1.3.0, Culture=neutral, PublicKeyToken=b88d1754d700e49a'.
The system cannot find the file specified.
```

Note `Culture=neutral` — this is a **regular** assembly, not a localization/satellite one. The
module DLL's folder contains *only the module DLL*, so the Model Editor cannot resolve the
DevExpress assemblies the module type needs.

Root cause, from Microsoft's own docs:
[`CopyLocalLockFileAssemblies`](https://learn.microsoft.com/en-us/dotnet/core/project-sdk/msbuild-props#copylocallockfileassemblies)
defaults to **`false` for class libraries** (and `true` for executables). So a module project does
not copy its transitive NuGet dependencies to its output folder, whereas the startup app
(`.Blazor`/`.Win`) does. Microsoft frames the fix around plugins — and the Model Editor loads the
module DLL exactly like a plugin. This is **not** artifacts-specific; enabling the artifacts layout
only relocates outputs, it does not change dependency copying.

DevExpress documents the same requirement ("copy all assemblies required by your XAF application")
and the identical error:
[Ways to Invoke the Model Editor](https://docs.devexpress.com/eXpressAppFramework/113326) ·
[Deployment Troubleshooting](https://docs.devexpress.com/eXpressAppFramework/113238).

---

## 2. Why we are doing this

- **Meet the request:** discover the module DLL in the artifacts output layout so the extension
  works for modern .NET 8+ solutions.
- **Make it "just work":** a correctly-located DLL still fails to open when the module's output
  lacks its dependency closure. We want the editor to open without forcing every user to change
  their build first.

## 3. Solutions

### 3.1 User-side (recommended, documented in the issue reply)

Add a solution-root `Directory.Build.props` so every project copies its full dependency closure to
its own output — which also means the Model Editor can be opened from **any** project:

```xml
<Project>
  <PropertyGroup>
    <CopyLocalLockFileAssemblies>true</CopyLocalLockFileAssemblies>
  </PropertyGroup>
</Project>
```

This is how our own solutions (e.g. N2C.Pineapple) are set up.

### 3.2 Extension-side (implemented) — dependency-closure fallback

`findDllInArtifactsLayout(projectFile, log)` in [src/artifactsLayout.ts](../../src/artifactsLayout.ts):

1. Use the module's **own** output folder if it already carries the closure (contains a
   `DevExpress.*.dll`). Preserves existing behaviour for `CopyLocalLockFileAssemblies=true` setups.
2. If the module's own output lacks the closure, load the **same module DLL** from another project's
   output that has it — typically the startup `.Blazor`/`.Win` app. Preference order: a real app
   over a test project, then the richest folder (most DLLs). The `diffsPath` is unchanged, so the
   model being edited is identical; only the physical copy of the module DLL used for loading
   changes, so all sibling dependencies resolve.
3. If nothing complete is found, fall back to the bare module DLL and log a clear warning
   (build the startup project, or set `CopyLocalLockFileAssemblies=true`).

Pivot handling: debug pivots are preferred; multi-target pivots (`debug_net8.0-windows`) are
matched. The search stops at the repo root (`.git`) while walking up to find `artifacts/`.

---

## 4. Validation

### 4.1 Done — selection logic (platform-independent)

The DLL-selection algorithm is exercised against synthetic `artifacts/bin/**` trees
(scratchpad test, 8/8 passing):

| Scenario | Expected |
| --- | --- |
| Incomplete module output + complete `.Blazor` app | loads module DLL from the `.Blazor` output |
| Module output already complete (`CopyLocalLockFileAssemblies=true`) | uses own output (unchanged) |
| Nothing complete | bare module DLL + warning |
| Complete test project + complete app | app preferred over test |
| Multi-target pivot (`debug_net8.0-windows`) | found |
| Debug and release both present | debug preferred |
| No `artifacts/` folder | `undefined` (falls through to `.exe` scenario) |
| Sibling has module DLL but not the closure | ignored → bare module DLL |

> The synthetic test lives in the scratchpad, not the repo — the repo has no test runner yet.
> TODO: decide whether to add a minimal test runner and land these as real tests.

### 4.2 Done — end-to-end on Linux (headless, via Wine + Xvfb)

Validated against the issue's own `XafAppSimple-WithArtifactsOutput` sample, retargeted from
DevExpress 26.1 → 25.2 to match the locally installed Model Editor (26.1-only API
`LookupPropertyEditor.DefaultUseViewMode` commented out), built with `UseArtifactsOutput=true` and
**without** `CopyLocalLockFileAssemblies` — so the fallback path is what makes it open.

- ✅ **Model Editor runs on Linux via Wine** (its WinForms dialogs render under Xvfb).
- ✅ **Bug reproduced on Linux:** launching against the bare module output
  (`artifacts/bin/XafAppSimple.Module/debug/` — 1 DLL, no DevExpress) produces the exact
  `Unable to create an instance … Could not load … DevExpress.Persistent.BaseImpl.EFCore.v25.2,
  Culture=neutral … File not found` dialog — identical to the reporter's Windows screenshot.
- ✅ **Fallback selects the right DLL against the real tree:** `findDllInArtifactsLayout` returns
  the module DLL from `artifacts/bin/XafAppSimple.Blazor.Server/debug/` (144 DLLs, full closure).
- ✅ **Assembly error resolved:** with that DLL the `Culture=neutral` failure is gone; execution
  proceeds past module instantiation into model/UI construction. **The issue #1 fix is validated.**

### 4.3 Separate, pre-existing issue — Wine text-rendering crash (NOT this fix)

After the module loads, the headless run crashes with `0xC0000005` in a native GDI P/Invoke
`GetCharacterPlacement`, inside `DevExpress.XtraRichEdit.Layout.Export.GdiBoxMeasurer` on the
RichEdit background-formatter thread. This is a Wine GDI/text-measurement limitation, independent
of assembly resolution — it would occur equally with the `CopyLocalLockFileAssemblies` workaround;
our fix only lets execution reach it. Copying MS core fonts (Arial/Times/Verdana/…) into the Wine
prefix's `drive_c/windows/Fonts` did **not** clear it headless.

Tracked separately from issue #1. Next steps: confirm on a **real display** (this may be an
Xvfb/font artifact rather than a true failure), and if it persists try `winetricks corefonts`
(with `wineboot` font registration) or a newer Wine build.

### 4.4 Pending

- [ ] **Real display** run on Linux — does the Model Editor window fully render (§4.3)?
- [ ] **macOS** (via Wine).
- [ ] **Windows** (native) — regression check + confirm the fallback line in the "XAF Model Editor"
      output channel.
- [ ] `CopyLocalLockFileAssemblies=true` solution still opens from its own module output (no change).
- [ ] Classic `bin/<config>/<tfm>/` solution still works (no regression).

---

## 5. References

- Issue: <https://github.com/Need2Code-AB/vscode.extensions.xaf.modeleditor/issues/1>
- .NET artifacts output layout: <https://learn.microsoft.com/en-us/dotnet/core/sdk/artifacts-output>
- `CopyLocalLockFileAssemblies`: <https://learn.microsoft.com/en-us/dotnet/core/project-sdk/msbuild-props#copylocallockfileassemblies>
- DevExpress — Ways to Invoke the Model Editor: <https://docs.devexpress.com/eXpressAppFramework/113326>
- DevExpress — Deployment Troubleshooting: <https://docs.devexpress.com/eXpressAppFramework/113238>
