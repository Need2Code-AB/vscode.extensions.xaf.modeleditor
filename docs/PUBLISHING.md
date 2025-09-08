# Publishing XAF Model Editor Extension

This guide explains how to set up automated publishing of the XAF Model Editor extension to the VS Code Marketplace.

## Prerequisites

### 1. VS Code Marketplace Publisher Account

1. Go to [Visual Studio Marketplace Manage](https://marketplace.visualstudio.com/manage)
2. Sign in with your Microsoft/Azure account
3. Create a publisher (or use existing): `DvisiousNeed2CodeAB`

### 2. Azure DevOps Personal Access Token (PAT)

⚠️ **Important**: VS Code Marketplace requires an **Azure DevOps PAT**, not a GitHub PAT.

#### Step-by-step PAT Creation:

1. **Create Azure DevOps Organization** (if you don't have one):
   - Go to [Azure DevOps](https://dev.azure.com)
   - Sign in with the same Microsoft account used for VS Code Marketplace
   - Create your own organization (e.g., `vscode` or `your-company-name`)

2. **Create Personal Access Token**:
   - From your organization's home page (e.g., `https://dev.azure.com/your-org`)
   - Click **User settings** dropdown next to your profile image
   - Select **Personal access tokens**

3. **Configure the Token**:
   - Click **New Token**
   - Fill out the details:
     - **Name**: `VS Code Marketplace Publishing`
     - **Organization**: **All accessible organizations**
     - **Expiration**: Set desired expiration date (e.g., 1 year)
     - **Scopes**: Select **Custom defined**
       - Click **Show all scopes**
       - Scroll to **Marketplace** and select **Manage**

4. **Save the Token**:
   - Click **Create**
   - **Copy the token immediately** (you won't see it again!)

#### Verify your Publisher:
```bash
# Test your token works
vsce login DvisiousNeed2CodeAB
# Enter your PAT when prompted
```

### 3. GitHub Repository Secrets

Add the Azure DevOps PAT to your GitHub repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**:
   - **Name**: `VSCE_PAT`
   - **Value**: [Your Azure DevOps PAT from step 2]

## Automated Workflows

### Build on Every Push/PR
- Compiles TypeScript
- Packages extension as VSIX
- Uploads VSIX as artifact (available for 90 days)

### Publish on Release
- Automatically publishes to VS Code Marketplace
- Attaches VSIX file to GitHub release

## Publishing Methods

### Method 1: Automated via GitHub Release (Recommended)

1. Go to **Actions** → **Create Release** workflow
2. Click **Run workflow**
3. Enter version (e.g., `v0.0.19`) and release notes
4. The workflow will:
   - Build the extension
   - Create a GitHub release
   - Automatically publish to VS Code Marketplace
   - Attach VSIX file to the release

### Method 2: Manual Publishing

```bash
# Install vsce globally (if not already installed)
npm install -g @vscode/vsce

# Publish with your Azure DevOps PAT
vsce publish --pat YOUR_AZURE_DEVOPS_PAT

# Or using npm script (requires VSCE_PAT environment variable)
npm run publish
```

### Method 3: Using TFX CLI (Alternative)

```bash
# Install TFX CLI
npm install -g tfx-cli

# Publish extension
tfx extension publish --publisher DvisiousNeed2CodeAB --vsix xaf-modeleditor-0.0.18.vsix --auth-type pat -t YOUR_AZURE_DEVOPS_PAT
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

- **Publisher**: DvisiousNeed2CodeAB
- **Extension ID**: xaf-modeleditor
- **Display Name**: XAF Model Editor Integration
- **Category**: Other

## Links

- [VS Code Extension Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce CLI Documentation](https://github.com/microsoft/vscode-vsce)
- [Marketplace Publisher Portal](https://marketplace.visualstudio.com/manage)
