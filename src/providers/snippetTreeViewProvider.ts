import * as vscode from 'vscode';
import { StorageProvider } from '../utils/database';
import { Snippet, CategoryItem } from '../models/snippet';
import { insertTextAtCursor } from '../utils/snippetUtils';

type TreeItemType = 'category' | 'categoryItem' | 'snippet';

class SnippetTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly type: TreeItemType,
    public readonly categoryType?: 'tag' | 'language' | 'project',
    public readonly categoryName?: string,
    public readonly snippet?: Snippet,
    public readonly count?: number
  ) {
    super(
      label,
      type === 'snippet' 
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Collapsed
    );
    
    if (type === 'category') {
      this.contextValue = 'category';
      this.iconPath = new vscode.ThemeIcon('folder');
      this.tooltip = `Browse snippets by ${categoryType}`;
    } else if (type === 'categoryItem') {
      this.contextValue = `categoryItem.${categoryType}`;
      this.description = `(${count})`;
      
      let iconName = 'tag';
      let tooltipText = '';
      
      if (categoryType === 'language') {
        iconName = 'code';
        tooltipText = `Language: ${categoryName} (${count} snippets)`;
      } else if (categoryType === 'project') {
        iconName = 'repo';
        tooltipText = `Project: ${categoryName} (${count} snippets)`;
      } else if (categoryType === 'tag') {
        iconName = 'tag';
        tooltipText = `Tag: ${categoryName} (${count} snippets)`;
      } else if (categoryName === 'all') {
        iconName = 'list-unordered';
        tooltipText = `All snippets (${count} total)`;
      }
      
      this.iconPath = new vscode.ThemeIcon(iconName);
      this.tooltip = tooltipText;
    } else if (type === 'snippet') {
      this.contextValue = 'snippet';
      this.description = snippet?.language;
      this.tooltip = new vscode.MarkdownString(
        `**${snippet?.title}**\n\n` +
        `${snippet?.description ? `*${snippet.description}*\n\n` : ''}` +
        `**Language:** ${snippet?.language}\n\n` +
        `**Tags:** ${snippet?.tags.length ? snippet.tags.join(', ') : 'None'}\n\n` +
        `**Project:** ${snippet?.projectContext}\n\n` +
        `**Created:** ${new Date(snippet?.createdAt || 0).toLocaleDateString()}\n\n` +
        `**Last Updated:** ${new Date(snippet?.updatedAt || 0).toLocaleDateString()}\n\n` +
        `---\n\n` +
        `*Click to preview • Right-click for more options*`
      );
      this.command = {
        command: 'snippetSync.previewSnippet',
        title: 'Preview Snippet',
        arguments: [snippet]
      };
      this.iconPath = this.getLanguageIcon(snippet?.language || '');
    }
  }
  
  private getLanguageIcon(language: string): vscode.ThemeIcon {
    const languageIconMap: { [key: string]: string } = {
      'javascript': 'symbol-method',
      'typescript': 'symbol-class',
      'python': 'symbol-namespace',
      'java': 'symbol-interface',
      'csharp': 'symbol-object',
      'cpp': 'symbol-struct',
      'c': 'symbol-variable',
      'html': 'symbol-tag',
      'css': 'symbol-color',
      'json': 'symbol-key',
      'xml': 'symbol-xml',
      'sql': 'database',
      'bash': 'terminal',
      'powershell': 'terminal-powershell',
      'yaml': 'symbol-array',
      'markdown': 'markdown',
      'dockerfile': 'symbol-container',
      'go': 'symbol-module',
      'rust': 'symbol-gear',
      'php': 'symbol-constant',
      'ruby': 'ruby'
    };
    
    const iconName = languageIconMap[language.toLowerCase()] || 'symbol-snippet';
    return new vscode.ThemeIcon(iconName);
  }
}

export class SnippetTreeViewProvider implements vscode.TreeDataProvider<SnippetTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SnippetTreeItem | undefined | null | void> = 
    new vscode.EventEmitter<SnippetTreeItem | undefined | null | void>();
  
  readonly onDidChangeTreeData: vscode.Event<SnippetTreeItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;
  
  private _searchFilter: string = '';
  private _sortBy: 'name' | 'date' | 'language' = 'date';
  private _sortOrder: 'asc' | 'desc' = 'desc';
  
  constructor(private storage: StorageProvider) {
    this.registerCommands();
  }
  
  private registerCommands(): void {
    vscode.commands.registerCommand('snippetSync.previewSnippet', (snippet: Snippet) => {
      const { SnippetPreviewPanel } = require('../panels/snippetPreviewPanel');
      SnippetPreviewPanel.createOrShow(snippet);
    });
    vscode.commands.registerCommand('snippetSync.quickInsertSnippet', async (snippet: Snippet) => {
      try {
        await insertTextAtCursor(snippet.code);
        vscode.window.showInformationMessage(`Inserted snippet: ${snippet.title}`);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to insert snippet: ${error}`);
      }
    });
    vscode.commands.registerCommand('snippetSync.copySnippet', async (snippet: Snippet) => {
      try {
        await vscode.env.clipboard.writeText(snippet.code);
        vscode.window.showInformationMessage(`Copied snippet: ${snippet.title}`);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to copy snippet: ${error}`);
      }
    });
    vscode.commands.registerCommand('snippetSync.duplicateSnippet', async (snippet: Snippet) => {
      try {
        const newSnippet: Snippet = {
          ...snippet,
          id: this.generateId(),
          title: `${snippet.title} (Copy)`,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        await this.storage.saveSnippet(newSnippet);
        this.refresh();
        vscode.window.showInformationMessage(`Duplicated snippet: ${snippet.title}`);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to duplicate snippet: ${error}`);
      }
    });
    vscode.commands.registerCommand('snippetSync.sortSnippets', async () => {
      const sortOptions = [
        { label: 'Name (A-Z)', value: { by: 'name', order: 'asc' } },
        { label: 'Name (Z-A)', value: { by: 'name', order: 'desc' } },
        { label: 'Date (Newest First)', value: { by: 'date', order: 'desc' } },
        { label: 'Date (Oldest First)', value: { by: 'date', order: 'asc' } },
        { label: 'Language (A-Z)', value: { by: 'language', order: 'asc' } },
        { label: 'Language (Z-A)', value: { by: 'language', order: 'desc' } }
      ];
      
      const selected = await vscode.window.showQuickPick(sortOptions, {
        placeHolder: 'Select sorting method'
      });
      
      if (selected) {
        this._sortBy = selected.value.by as any;
        this._sortOrder = selected.value.order as any;
        this.refresh();
      }
    });
    vscode.commands.registerCommand('snippetSync.filterSnippets', async () => {
      const filter = await vscode.window.showInputBox({
        prompt: 'Enter search term to filter snippets',
        value: this._searchFilter,
        placeHolder: 'Search by title, description, or tags...'
      });
      
      if (filter !== undefined) {
        this._searchFilter = filter;
        this.refresh();
      }
    });
    vscode.commands.registerCommand('snippetSync.clearFilter', () => {
      this._searchFilter = '';
      this.refresh();
      vscode.window.showInformationMessage('Filter cleared');
    });
    vscode.commands.registerCommand('snippetSync.expandAll', () => {
      vscode.commands.executeCommand('workbench.actions.treeView.snippetSyncExplorer.expandAll');
    });
    vscode.commands.registerCommand('snippetSync.collapseAll', () => {
      vscode.commands.executeCommand('workbench.actions.treeView.snippetSyncExplorer.collapseAll');
    });
  }
  
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }
  
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
  
  updateStorage(storage: StorageProvider): void {
    this.storage = storage;
    this.refresh();
  }
  
  getTreeItem(element: SnippetTreeItem): vscode.TreeItem {
    return element;
  }
  
  async getChildren(element?: SnippetTreeItem): Promise<SnippetTreeItem[]> {
    if (!element) {
      const items = [
        new SnippetTreeItem('By Tag', 'category', 'tag'),
        new SnippetTreeItem('By Language', 'category', 'language'),
        new SnippetTreeItem('By Project', 'category', 'project')
      ];
      const allSnippets = await this.storage.getAllSnippets();
      const filteredCount = this._searchFilter ? 
        await this.getFilteredSnippets(allSnippets) : 
        allSnippets;
      
      items.push(
        new SnippetTreeItem(
          this._searchFilter ? `All Snippets (filtered)` : 'All Snippets',
          'categoryItem',
          undefined,
          'all',
          undefined,
          filteredCount.length
        )
      );
      
      return items;
    } else if (element.type === 'category') {
      if (!element.categoryType) {
        return [];
      }
      
      const categories = await this.storage.getCategories(element.categoryType);
      let filteredCategories = categories;
      if (this._searchFilter) {
        const allSnippets = await this.storage.getAllSnippets();
        const filteredSnippets = await this.getFilteredSnippets(allSnippets);
        const categoryCounts = new Map<string, number>();
        
        filteredSnippets.forEach(snippet => {
          if (element.categoryType === 'tag') {
            snippet.tags.forEach(tag => {
              categoryCounts.set(tag, (categoryCounts.get(tag) || 0) + 1);
            });
          } else if (element.categoryType === 'language') {
            const lang = snippet.language;
            categoryCounts.set(lang, (categoryCounts.get(lang) || 0) + 1);
          } else if (element.categoryType === 'project') {
            const project = snippet.projectContext;
            categoryCounts.set(project, (categoryCounts.get(project) || 0) + 1);
          }
        });
        
        filteredCategories = categories
          .filter(cat => categoryCounts.has(cat.name))
          .map(cat => ({ ...cat, count: categoryCounts.get(cat.name) || 0 }));
      }
      
      return filteredCategories.map(category => 
        new SnippetTreeItem(
          category.name, 
          'categoryItem', 
          element.categoryType, 
          category.name, 
          undefined, 
          category.count
        )
      );
    } else if (element.type === 'categoryItem') {
      let snippets: Snippet[] = [];
      
      if (element.categoryName === 'all') {
        snippets = await this.storage.getAllSnippets();
      } else if (element.categoryType === 'tag') {
        snippets = await this.storage.searchSnippets({ 
          tags: [element.categoryName!] 
        });
      } else if (element.categoryType === 'language') {
        snippets = await this.storage.searchSnippets({ 
          language: element.categoryName 
        });
      } else if (element.categoryType === 'project') {
        snippets = await this.storage.searchSnippets({ 
          project: element.categoryName 
        });
      }
      if (this._searchFilter) {
        snippets = await this.getFilteredSnippets(snippets);
      }
      snippets = this.sortSnippets(snippets);
      
      return snippets.map(snippet => 
        new SnippetTreeItem(
          snippet.title, 
          'snippet', 
          undefined, 
          undefined, 
          snippet
        )
      );
    }
    
    return [];
  }
  
  private async getFilteredSnippets(snippets: Snippet[]): Promise<Snippet[]> {
    if (!this._searchFilter) {
      return snippets;
    }
    
    const searchTerm = this._searchFilter.toLowerCase();
    return snippets.filter(snippet => 
      snippet.title.toLowerCase().includes(searchTerm) ||
      (snippet.description && snippet.description.toLowerCase().includes(searchTerm)) ||
      snippet.code.toLowerCase().includes(searchTerm) ||
      snippet.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
      snippet.language.toLowerCase().includes(searchTerm) ||
      snippet.projectContext.toLowerCase().includes(searchTerm)
    );
  }
  
  private sortSnippets(snippets: Snippet[]): Snippet[] {
    return snippets.sort((a, b) => {
      let comparison = 0;
      
      switch (this._sortBy) {
        case 'name':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'date':
          comparison = a.updatedAt - b.updatedAt;
          break;
        case 'language':
          comparison = a.language.localeCompare(b.language);
          break;
      }
      
      return this._sortOrder === 'asc' ? comparison : -comparison;
    });
  }
  
  getSearchFilter(): string {
    return this._searchFilter;
  }
  
  getSortInfo(): { by: string, order: string } {
    return { by: this._sortBy, order: this._sortOrder };
  }
}