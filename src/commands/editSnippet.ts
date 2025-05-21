import * as vscode from 'vscode';
import { Snippet } from '../models/snippet';
import { promptForSnippetDetails } from '../utils/snippetUtils';
import { getStorageInstance } from '../utils/database';
import { SnippetTreeViewProvider } from '../providers/snippetTreeViewProvider';

export function registerEditSnippetCommand(
  context: vscode.ExtensionContext,
  treeProvider: SnippetTreeViewProvider
): vscode.Disposable {
  return vscode.commands.registerCommand('snippetSync.editSnippet', async (snippet: Snippet) => {
    if (!snippet) {
      vscode.window.showErrorMessage('No snippet selected for editing.');
      return;
    }
    const updatedInfo = await promptForSnippetDetails(
      snippet.title,
      snippet.description || '',
      snippet.language,
      snippet.tags
    );
    
    if (!updatedInfo) {
      return;
    }
    const document = await vscode.workspace.openTextDocument({
      content: snippet.code,
      language: updatedInfo.language
    });
    
    const editor = await vscode.window.showTextDocument(document);
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(save) Save Snippet Changes';
    statusBarItem.tooltip = 'Save changes to this snippet';
    statusBarItem.command = 'snippetSync.saveSnippetChanges';
    statusBarItem.show();
    const disposable = vscode.commands.registerCommand('snippetSync.saveSnippetChanges', async () => {
      const storage = getStorageInstance();
      const updatedSnippet: Snippet = {
        ...snippet,
        title: updatedInfo.title,
        description: updatedInfo.description,
        language: updatedInfo.language,
        tags: updatedInfo.tags,
        code: editor.document.getText(),
        updatedAt: Date.now()
      };
      
      try {
        await storage.saveSnippet(updatedSnippet);
        treeProvider.refresh();
        vscode.window.showInformationMessage(`Snippet "${updatedSnippet.title}" updated successfully.`);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update snippet: ${error}`);
      } finally {
        statusBarItem.dispose();
        disposable.dispose();
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      }
    });
    context.subscriptions.push(disposable);
  });
}