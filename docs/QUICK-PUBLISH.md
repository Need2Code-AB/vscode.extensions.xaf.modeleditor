# Quick Publishing Guide

## ⚡ Fast Track to VS Code Marketplace

### Step 1: Azure DevOps PAT (Required)
1. **Go to**: [dev.azure.com](https://dev.azure.com)
2. **Sign in** with same Microsoft account as VS Code Marketplace
3. **Create organization** if you don't have one (e.g., `your-company`)
4. **User Settings** (profile dropdown) → **Personal Access Tokens** → **New Token**
5. **Configure**:
   - Name: `VS Code Marketplace Publishing`
   - Organization: **All accessible organizations**
   - Scopes: **Custom defined** → **Show all scopes** → **Marketplace** → **✓ Manage**
6. **Create** and **copy token** (won't see again!)

### Step 1.5: Test Your Token
```bash
# Verify your publisher and token work
vsce login DvisiousNeed2CodeAB
# Paste your Azure DevOps PAT when prompted
```

### Step 2: Add GitHub Secret
1. **GitHub repo** → **Settings** → **Secrets** → **Actions**
2. **New secret**:
   - Name: `VSCE_PAT`
   - Value: [Your Azure DevOps PAT]

### Step 3: Publish
**Option A - Automated** (Recommended):
1. **Actions** → **Create Release**
2. Run with version `v0.0.19`
3. ✅ Auto-publishes to marketplace!

**Option B - Manual**:
```bash
vsce publish --pat YOUR_AZURE_DEVOPS_PAT
```

## ❗ Common Mistakes
- ❌ Using GitHub PAT instead of Azure DevOps PAT
- ❌ Wrong marketplace permissions in PAT
- ❌ Different Microsoft accounts for marketplace vs Azure DevOps

## ✅ Verification
After publishing, check: `https://marketplace.visualstudio.com/items?itemName=DvisiousNeed2CodeAB.xaf-modeleditor`
