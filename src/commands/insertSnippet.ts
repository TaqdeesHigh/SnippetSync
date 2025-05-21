import * as vscode from 'vscode';
import { getStorageInstance } from '../utils/database';
import { Snippet } from '../models/snippet';
import { insertTextAtCursor } from '../utils/snippetUtils';

export function registerInsertSnippetCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('snippetSync.insertSnippet', async (snippet?: Snippet) => {
    if (snippet) {
      await insertTextAtCursor(snippet.code);
      return;
    }
    const storage = getStorageInstance();
    const snippets = await storage.getAllSnippets();
    
    if (snippets.length === 0) {
      vscode.window.showInformationMessage('No snippets found. Save some snippets first.');
      return;
    }
    
    const selectedSnippet = await vscode.window.showQuickPick(
      snippets.map(s => ({
        label: s.title,
        description: `[${s.language}] ${s.tags.join(', ')}`,
        detail: s.description,
        snippet: s
      })),
      {
        placeHolder: 'Select a snippet to insert',
        matchOnDescription: true,
        matchOnDetail: true
      }
    );
    
    if (!selectedSnippet) {
      return;
    }
    
    await insertTextAtCursor(selectedSnippet.snippet.code);
  });
}