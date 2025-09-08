# XAF Model Editor VS Code Extension

[![Build and Publish](https://github.com/Need2Code-AB/vscode.extensions.xaf.modeleditor/actions/workflows/build-and-publish.yml/badge.svg)](https://github.com/Need2Code-AB/vscode.extensions.xaf.modeleditor/actions/workflows/build-and-publish.yml)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/DvisiousNeed2CodeAB.xaf-modeleditor)](https://marketplace.visualstudio.com/items?itemName=DvisiousNeed2CodeAB.xaf-modeleditor)

This extension integrates the DevExpress XAF Model Editor into Visual Studio Code, enabling seamless editing of `Model.xafml` files with automatic version detection and robust error handling.

## Features
- Detects DevExpress version from your project files
- Launches the correct Model Editor executable for your version
- Registers context menu and double-click actions for `Model.xafml`
- Automatically builds the solution before launching the Model Editor
- Provides user-friendly error messages and troubleshooting links
- Designed for Windows environments

## Requirements
- Windows OS
- DevExpress eXpressApp Framework (XAF) installed
- .NET SDK (for building the solution)

## Usage

### Customizing the Model Editor Path

If you have installed DevExpress on a different drive or custom location, you can override the default Model Editor path:

1. Open **VS Code Settings** (File > Preferences > Settings).
2. Search for `XAF Model Editor` or `xafModelEditor.modelEditorPath`.
3. Enter the full path to your Model Editor executable, e.g.:

	`D:/DevExpress/Tools/ModelEditor/DevExpress.ExpressApp.ModelEditor.v24.2.exe`

If this setting is provided, the extension will use your custom path instead of the auto-detected one.

### How to open Model.xafml with XAF Model Editor

1. **Right-click** on a `Model.xafml` file in your XAF project.
2. Select **Open with XAF Model Editor** from the context menu:

	![Open with XAF Model Editor](docs/context-menu.png)

3. The extension will build your solution and launch the correct Model Editor.
4. If the Model Editor executable is missing, a helpful message and download link will be shown.

## Troubleshooting
- Ensure DevExpress is installed and the version matches your project.
- If the Model Editor cannot be found, download it from: https://www.devexpress.com/ClientCenter/DownloadManager/
- For issues, check the Output panel in VS Code for detailed logs.

## Contributing
Contributions are welcome! Please follow best practices for VS Code extension development and ensure all code is robust, well-documented, and maintainable.

   tree
├── .github/
│   └── workflows/
│       └── build-and-publish.yml    # GitHub Actions workflow
├── .vscode/
│   └── settings.json                # VS Code workspace settings
├── src/
│   ├── extension.ts                 # Main extension logic
│   └── modelTree.ts                 # Tree view provider for grouped .xafml files
├── resources/
│   └── xaf.svg                      # Extension icon
├── docs/
│   ├── context-menu.png             # Documentation screenshot
│   └── PUBLISHING.md                # Publishing and CI/CD guide
├── build-vsix.ps1                   # PowerShell build script
├── package.json                     # Extension manifest and configuration
├── README.md                        # This file
└── ...

## Development and Building

### Prerequisites
- Node.js (v16 or later)
- npm
- TypeScript
- Visual Studio Code

### Building Locally
```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package extension
npm run package

# Watch for changes during development
npm run watch
```

### PowerShell Build Script
```powershell
# Builds, compiles, and packages the extension with version bump
.\build-vsix.ps1
```

### Automated CI/CD
The extension uses GitHub Actions for:
- **Continuous Integration**: Build and test on every push/PR
- **Artifact Creation**: VSIX files available for download
- **Marketplace Publishing**: Automatic publishing on GitHub releases

See [PUBLISHING.md](docs/PUBLISHING.md) for detailed setup instructions.

## License

This project is licensed under the MIT License.

Copyright (c) 2025 Need2Code AB

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
