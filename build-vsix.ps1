
# Build and Package VSIX for XAF Model Editor Extension
# Requires:
# - Node.js and npm
# - vsce (Visual Studio Code Extension Manager)
#
# Usage:
#   .\build-vsix.ps1


# Increment patch version in package.json
$packageJson = Get-Content -Raw -Path "package.json" | ConvertFrom-Json
$versionParts = $packageJson.version -split '\.'
$versionParts[2] = [int]$versionParts[2] + 1
$packageJson.version = "$($versionParts[0]).$($versionParts[1]).$($versionParts[2])"
$packageJson | ConvertTo-Json -Depth 10 | Set-Content -Path "package.json"

Write-Host "[XAF Model Editor] Version bumped to $($packageJson.version)"

Write-Host "[XAF Model Editor] Installing dependencies..."
npm install

Write-Host "[XAF Model Editor] Compiling TypeScript..."
npm run compile

# Check if vsce is installed
if (-not (Get-Command vsce -ErrorAction SilentlyContinue)) {
	Write-Host "[XAF Model Editor] 'vsce' not found. Installing globally..."
	npm install -g vsce
}

Write-Host "[XAF Model Editor] Packaging extension as VSIX..."
vsce package

Write-Host "[XAF Model Editor] Done. The resulting .vsix file can be found in the current directory."
