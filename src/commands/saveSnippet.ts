import * as vscode from 'vscode';
import { Snippet } from '../models/snippet';
import { 
  generateId, 
  detectLanguage, 
  detectProjectContext, 
  getTextSelection,
  promptForSnippetDetails,
  analyzeCodeSelection
} from '../utils/snippetUtils';
import { getStorageInstance } from '../utils/database';
import { SnippetTreeViewProvider } from '../providers/snippetTreeViewProvider';

export function registerSaveSnippetCommand(
  context: vscode.ExtensionContext,
  treeProvider: SnippetTreeViewProvider
): vscode.Disposable {
  return vscode.commands.registerCommand('snippetSync.saveSnippet', async () => {
    const selectedText = getTextSelection();
    if (!selectedText) {
      vscode.window.showErrorMessage('Please select some code to save as a snippet.');
      return;
    }
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found.');
      return;
    }
    const detectedLanguage = detectLanguage(editor.document);
    const analysis = analyzeCodeSelection(selectedText, detectedLanguage);
    const projectContext = detectProjectContext();
    const storage = getStorageInstance();
    const snippetInfo = await promptForSnippetDetails(
      analysis.suggestedTitle,
      analysis.suggestedDescription,
      detectedLanguage,
      analysis.suggestedTags
    );
    
    if (!snippetInfo) {
      return;
    }
    const now = Date.now();
    const snippet: Snippet = {
      id: generateId(),
      title: snippetInfo.title,
      code: selectedText,
      description: snippetInfo.description,
      language: snippetInfo.language,
      tags: snippetInfo.tags,
      projectContext,
      createdAt: now,
      updatedAt: now
    };
    
    try {
      await storage.saveSnippet(snippet);
      treeProvider.refresh();
      vscode.window.showInformationMessage(`Snippet "${snippet.title}" saved successfully.`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save snippet: ${error}`);
    }
  });
}