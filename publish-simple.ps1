# Simple publishing script for XAF Model Editor
# This script packages and optionally publishes the extension

param(
    [string]$PublishToken = "",
    [switch]$PublishToMarketplace = $false,
    [switch]$UploadOnly = $false
)

Write-Host "[XAF Model Editor] Simple Publishing Script" -ForegroundColor Green

# Change to extension directory
Set-Location $PSScriptRoot

# Clean and compile
Write-Host "[XAF Model Editor] Cleaning and compiling..." -ForegroundColor Yellow
npm run compile

if ($LASTEXITCODE -ne 0) {
    Write-Error "Compilation failed!"
    exit 1
}

# Package extension
Write-Host "[XAF Model Editor] Packaging extension..." -ForegroundColor Yellow
vsce package --no-dependencies

if ($LASTEXITCODE -ne 0) {
    Write-Error "Packaging failed!"
    exit 1
}

# Get the generated VSIX file
$vsixFile = Get-ChildItem -Name "*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $vsixFile) {
    Write-Error "No VSIX file found!"
    exit 1
}

Write-Host "[XAF Model Editor] Created: $vsixFile" -ForegroundColor Green

if ($UploadOnly) {
    Write-Host "[XAF Model Editor] VSIX file ready for manual upload!" -ForegroundColor Cyan
    Write-Host "Upload at: https://marketplace.visualstudio.com/manage" -ForegroundColor Cyan
    Write-Host "File location: $PWD\$vsixFile" -ForegroundColor White
    
    # Open the folder containing the VSIX
    Start-Process "explorer.exe" -ArgumentList "/select,`"$PWD\$vsixFile`""
    
    # Open the marketplace manage page
    Start-Process "https://marketplace.visualstudio.com/manage"
    
    exit 0
}

if ($PublishToMarketplace -and $PublishToken) {
    Write-Host "[XAF Model Editor] Publishing to marketplace..." -ForegroundColor Yellow
    vsce publish --pat $PublishToken --packagePath $vsixFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[XAF Model Editor] Successfully published to marketplace!" -ForegroundColor Green
        Write-Host "Extension available at: https://marketplace.visualstudio.com/items?itemName=DvisiousNeed2CodeAB.xaf-modeleditor" -ForegroundColor Cyan
    } else {
        Write-Error "Publishing failed!"
        exit 1
    }
} elseif ($PublishToMarketplace) {
    Write-Error "Publishing requires a Personal Access Token. Use -PublishToken parameter."
    exit 1
} else {
    Write-Host "[XAF Model Editor] Package created successfully!" -ForegroundColor Green
    Write-Host "To publish:" -ForegroundColor White
    Write-Host "  Manual upload: https://marketplace.visualstudio.com/manage" -ForegroundColor Gray
    Write-Host "  Command line:  .\publish-simple.ps1 -PublishToMarketplace -PublishToken 'YOUR_PAT'" -ForegroundColor Gray
    Write-Host "  Upload only:   .\publish-simple.ps1 -UploadOnly" -ForegroundColor Gray
}
