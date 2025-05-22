import * as vscode from 'vscode';
import { getStorageInstance } from '../utils/database';
import { SnippetTreeViewProvider } from '../providers/snippetTreeViewProvider';

export function registerDeleteSnippetCommand(
  context: vscode.ExtensionContext,
  treeProvider: SnippetTreeViewProvider
): vscode.Disposable {
  return vscode.commands.registerCommand('snippetSync.deleteSnippet', async (snippetId?: string) => {
    const storage = getStorageInstance();
    
    try {
      let targetSnippetId = snippetId;
      
      if (!targetSnippetId) {
        const snippets = await storage.getAllSnippets();
        if (snippets.length === 0) {
          vscode.window.showInformationMessage('No snippets available to delete.');
          return;
        }
        
        const snippetItems = snippets.map(snippet => ({
          label: snippet.title,
          description: snippet.language,
          detail: snippet.description || 'No description',
          snippet: snippet
        }));
        
        const selected = await vscode.window.showQuickPick(snippetItems, {
          placeHolder: 'Select a snippet to delete',
          matchOnDescription: true,
          matchOnDetail: true
        });
        
        if (!selected) {
          return;
        }
        
        targetSnippetId = selected.snippet.id;
      }
      const snippet = await storage.getSnippet(targetSnippetId);
      if (!snippet) {
        vscode.window.showErrorMessage('Snippet not found.');
        return;
      }
      const confirmMessage = `Are you sure you want to delete the snippet "${snippet.title}"?`;
      const confirmation = await vscode.window.showWarningMessage(
        confirmMessage,
        { modal: true },
        'Delete',
        'Cancel'
      );
      
      if (confirmation !== 'Delete') {
        return;
      }
      const success = await storage.deleteSnippet(targetSnippetId);
      
      if (success) {
        treeProvider.refresh();
        vscode.window.showInformationMessage(`Snippet "${snippet.title}" deleted successfully.`);
      } else {
        vscode.window.showErrorMessage('Failed to delete snippet.');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete snippet: ${error}`);
    }
  });
}