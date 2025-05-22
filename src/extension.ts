import * as vscode from 'vscode';
import { initializeStorage, getStorageInstance } from './utils/database';
import { registerSaveSnippetCommand } from './commands/saveSnippet';
import { registerInsertSnippetCommand } from './commands/insertSnippet';
import { registerSearchSnippetsCommand } from './commands/searchSnippets';
import { registerSyncSnippetsCommand } from './commands/syncSnippets';
import { SnippetTreeViewProvider } from './providers/snippetTreeViewProvider';
import { setupInlineSnippetSuggestions } from './providers/inlineSnippetProvider';
import { registerEditSnippetCommand } from './commands/editSnippet';
import { registerDeleteSnippetCommand } from './commands/deleteSnippet';

function registerContextMenuCommands(context: vscode.ExtensionContext) {
  const contextMenuCommand = vscode.commands.registerCommand(
    'snippetSync.saveSelectionAsSnippet', 
    () => {
      vscode.commands.executeCommand('snippetSync.saveSnippet');
    }
  );
  
  context.subscriptions.push(contextMenuCommand);
}

function setupStatusBarItem(context: vscode.ExtensionContext) {
  const snippetStatusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  
  snippetStatusBar.text = '$(bookmark) Snippets';
  snippetStatusBar.tooltip = 'Search and insert snippets';
  snippetStatusBar.command = 'snippetSync.quickAccess';
  snippetStatusBar.show();
  
  context.subscriptions.push(snippetStatusBar);
  const quickAccessCommand = vscode.commands.registerCommand('snippetSync.quickAccess', async () => {
    const options = [
      'Search Snippets',
      'Save Selection as Snippet',
      'View All Snippets',
      'Delete Snippet', 
      'Sync Snippets'
    ];
    
    const selection = await vscode.window.showQuickPick(options, {
      placeHolder: 'SnippetSync Quick Actions'
    });
    
    if (!selection) return;
    
    switch (selection) {
      case 'Search Snippets':
        vscode.commands.executeCommand('snippetSync.searchSnippets');
        break;
      case 'Save Selection as Snippet':
        vscode.commands.executeCommand('snippetSync.saveSnippet');
        break;
      case 'View All Snippets':
        vscode.commands.executeCommand('snippetSyncExplorer.focus');
        break;
      case 'Delete Snippet':
        vscode.commands.executeCommand('snippetSync.deleteSnippet');
        break;
      case 'Sync Snippets':
        vscode.commands.executeCommand('snippetSync.syncSnippets');
        break;
    }
  });
  
  context.subscriptions.push(quickAccessCommand);
}

export async function activate(context: vscode.ExtensionContext) {
  console.log('SnippetSync is now active!');
  await initializeStorage(context);
  const snippetTreeProvider = new SnippetTreeViewProvider(getStorageInstance());
  const treeView = vscode.window.createTreeView('snippetSyncExplorer', {
    treeDataProvider: snippetTreeProvider,
    showCollapseAll: true
  });
  const saveCommand = registerSaveSnippetCommand(context, snippetTreeProvider);
  const insertCommand = registerInsertSnippetCommand(context);
  const searchCommand = registerSearchSnippetsCommand(context);
  const syncCommand = registerSyncSnippetsCommand(context, snippetTreeProvider);
  const editCommand = registerEditSnippetCommand(context, snippetTreeProvider);
  const deleteCommand = registerDeleteSnippetCommand(context, snippetTreeProvider); 
  const refreshCommand = vscode.commands.registerCommand(
    'snippetSync.refreshSnippets', 
    () => snippetTreeProvider.refresh()
  );
  setupInlineSnippetSuggestions(context);
  setupStatusBarItem(context);
  registerContextMenuCommands(context);
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('snippetSync')) {
        snippetTreeProvider.refresh();
        if (e.affectsConfiguration('snippetSync.storageType')) {
          initializeStorage(context).then(() => {
            snippetTreeProvider.updateStorage(getStorageInstance());
          });
        }
        if (e.affectsConfiguration('snippetSync.enableInlineSnippets')) {
          setupInlineSnippetSuggestions(context);
        }
      }
    })
  );
  context.subscriptions.push(
    treeView,
    saveCommand,
    insertCommand,
    searchCommand,
    syncCommand,
    editCommand,
    deleteCommand,
    refreshCommand
  );
}

export function deactivate() {
  const storage = getStorageInstance();
  if (storage) {
    storage.close();
  }
}