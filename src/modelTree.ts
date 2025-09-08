import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class XafModelTreeProvider implements vscode.TreeDataProvider<ModelTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ModelTreeItem | undefined | void> = new vscode.EventEmitter<ModelTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<ModelTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ModelTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ModelTreeItem): Thenable<ModelTreeItem[]> {
        if (!this.workspaceRoot) {
            return Promise.resolve([]);
        }
        if (!element) {
            // Root: find all .xafml files and group
            return Promise.resolve(this.getGroupedModelFiles());
        } else {
            // Children: return subfiles
            return Promise.resolve(element.children || []);
        }
    }

    private getGroupedModelFiles(): ModelTreeItem[] {
        // Recursively find all .xafml files
        const allFiles: string[] = [];
        function walk(dir: string) {
            for (const f of fs.readdirSync(dir)) {
                const full = path.join(dir, f);
                if (fs.statSync(full).isDirectory()) walk(full);
                else if (f.endsWith('.xafml')) allFiles.push(full);
            }
        }
        walk(this.workspaceRoot);

        // Group by base name (Model.xafml, Model_sv.xafml, Model_sv-SE.xafml, Model.DesignedDiffs.xafml, etc)
        const groups: { [base: string]: string[] } = {};
        for (const file of allFiles) {
            const dir = path.dirname(file);
            const name = path.basename(file);
            // Grouping: Model.xafml is parent, Model_*.xafml and Model.*.xafml are children
            let base: string;
            if (/^(Model|.*\.DesignedDiffs)\.xafml$/i.test(name)) {
                base = path.join(dir, name);
            } else if (/^(Model|.*\.DesignedDiffs)[_.].+\.xafml$/i.test(name)) {
                // e.g. Model_sv.xafml, Model_sv-SE.xafml, Model.DesignedDiffs_sv.xafml
                base = path.join(dir, name.replace(/[_.].+\.xafml$/, '.xafml'));
            } else {
                base = path.join(dir, name); // fallback: treat as own group
            }
            if (!groups[base]) groups[base] = [];
            groups[base].push(file);
        }

        // Build tree items
        const items: ModelTreeItem[] = [];
        for (const base in groups) {
            // Parent is always the base file
            const children = groups[base]
                .filter(f => f !== base)
                .map(f => new ModelTreeItem(f, vscode.TreeItemCollapsibleState.None, undefined, path.relative(this.workspaceRoot, f)));
            const parent = new ModelTreeItem(
                base,
                children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                children,
                path.relative(this.workspaceRoot, base)
            );
            items.push(parent);
        }
        // Sort: parents by path, children by name
        const getLabel = (item: ModelTreeItem) => typeof item.label === 'string' ? item.label : (item.label?.label ?? '');
        items.sort((a, b) => getLabel(a).localeCompare(getLabel(b)));
        for (const item of items) {
            if (item.children) item.children.sort((a, b) => getLabel(a).localeCompare(getLabel(b)));
        }
        return items;
    }
}

export class ModelTreeItem extends vscode.TreeItem {
    constructor(
        public readonly file: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly children?: ModelTreeItem[],
        labelOverride?: string
    ) {
        super(labelOverride || path.basename(file), collapsibleState);
        this.resourceUri = vscode.Uri.file(file);
        this.command = {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [this.resourceUri]
        };
        this.contextValue = 'xafmlFile';
        this.tooltip = file;
        this.iconPath = new vscode.ThemeIcon('file');
    }
}