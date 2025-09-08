# Publishing XAF Model Editor Extension

This guide explains how to set up automated publishing of the XAF Model Editor extension to the VS Code Marketplace.

## Prerequisites

### 1. VS Code Marketplace Publisher Account

1. Go to [Visual Studio Marketplace Manage](https://marketplace.visualstudio.com/manage)
2. Sign in with your Microsoft/Azure account
3. Create a publisher (or use existing): `dvisious-need2code-ab`

### 2. Personal Access Token (PAT)

1. Go to [Azure DevOps](https://dev.azure.com)
2. Click on **User settings** → **Personal access tokens**
3. Create a new token with:
   - **Name**: `VS Code Marketplace Publishing`
   - **Scopes**: Select **Custom defined** → **Marketplace** → **Manage**
   - **Expiration**: Set appropriate duration (e.g., 1 year)
4. **Copy the token** (you won't see it again!)

### 3. GitHub Repository Secrets

Add the following secret to your GitHub repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add **Repository secret**:
   - **Name**: `VSCE_PAT`
   - **Value**: [Your Personal Access Token from step 2]

## Automated Workflows

### Build on Every Push/PR
- Compiles TypeScript
- Packages extension as VSIX
- Uploads VSIX as artifact (available for 90 days)

### Publish on Release
- Automatically publishes to VS Code Marketplace
- Attaches VSIX file to GitHub release

## Manual Publishing

### Using Scripts
```bash
# Package extension
npm run package

# Publish to marketplace
npm run publish
```

### Using PowerShell Script
```powershell
# Build and package (existing script)
.\build-vsix.ps1

# Publish manually using vsce
vsce publish --no-dependencies
```

## Creating a Release

1. **Update version** in `package.json` (if not already done by build script)
2. **Commit and push** changes
3. **Create a new release** on GitHub:
   - Tag: `v0.0.18` (match package.json version)
   - Title: `XAF Model Editor v0.0.18`
   - Description: Release notes
4. **Publish release** → Automatic marketplace publishing will start

## Version Management

The extension uses semantic versioning:
- **Patch** (0.0.X): Bug fixes, small improvements
- **Minor** (0.X.0): New features, backward compatible
- **Major** (X.0.0): Breaking changes

The `build-vsix.ps1` script automatically increments the patch version.

## Troubleshooting

### Publishing Fails
- Check if PAT has correct permissions
- Verify publisher name matches in package.json
- Ensure version number is higher than current marketplace version

### Build Fails
- Check TypeScript compilation errors
- Verify all dependencies are properly installed
- Check Node.js version compatibility

## Marketplace Information

- **Publisher**: dvisious-need2code-ab
- **Extension ID**: xaf-modeleditor
- **Display Name**: XAF Model Editor Integration
- **Category**: Other

## Links

- [VS Code Extension Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce CLI Documentation](https://github.com/microsoft/vscode-vsce)
- [Marketplace Publisher Portal](https://marketplace.visualstudio.com/manage)
