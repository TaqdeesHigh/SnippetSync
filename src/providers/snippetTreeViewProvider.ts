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
      this.iconPath = new vscode.ThemeIcon('symbol-folder');
    } else if (type === 'categoryItem') {
      this.contextValue = `categoryItem.${categoryType}`;
      this.description = `(${count})`;
      
      let iconName = 'tag';
      if (categoryType === 'language') {
        iconName = 'symbol-namespace';
      } else if (categoryType === 'project') {
        iconName = 'archive';
      }
      
      this.iconPath = new vscode.ThemeIcon(iconName);
    } else if (type === 'snippet') {
      this.contextValue = 'snippet';
      this.description = snippet?.language;
      this.tooltip = new vscode.MarkdownString(
        `**${snippet?.title}**\n\n` +
        `${snippet?.description || ''}\n\n` +
        `Tags: ${snippet?.tags.join(', ')}\n\n` +
        `Project: ${snippet?.projectContext}\n\n` +
        `Language: ${snippet?.language}`
      );
      this.command = {
        command: 'snippetSync.previewSnippet',
        title: 'Preview Snippet',
        arguments: [snippet]
      };
      
      this.iconPath = new vscode.ThemeIcon('symbol-snippet');
    }
  }
}

export class SnippetTreeViewProvider implements vscode.TreeDataProvider<SnippetTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SnippetTreeItem | undefined | null | void> = 
    new vscode.EventEmitter<SnippetTreeItem | undefined | null | void>();
  
  readonly onDidChangeTreeData: vscode.Event<SnippetTreeItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;
  
  constructor(private storage: StorageProvider) {
    vscode.commands.registerCommand('snippetSync.previewSnippet', (snippet: Snippet) => {
      const { SnippetPreviewPanel } = require('../panels/snippetPreviewPanel');
      SnippetPreviewPanel.createOrShow(snippet);
    });
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
      return [
        new SnippetTreeItem('By Tag', 'category', 'tag'),
        new SnippetTreeItem('By Language', 'category', 'language'),
        new SnippetTreeItem('By Project', 'category', 'project'),
        new SnippetTreeItem('All Snippets', 'categoryItem', undefined, 'all')
      ];
    } else if (element.type === 'category') {
      if (!element.categoryType) {
        return [];
      }
      
      const categories = await this.storage.getCategories(element.categoryType);
      return categories.map(category => 
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
}