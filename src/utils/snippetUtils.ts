import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { Snippet } from '../models/snippet';

export function generateId(): string {
  return crypto.randomUUID();
}

export function detectLanguage(document: vscode.TextDocument): string {
  const languageId = document.languageId;
  return languageId === 'plaintext' ? 'plaintext' : languageId;
}

export function detectProjectContext(): string {
  const workspace = vscode.workspace.workspaceFolders;
  if (workspace && workspace.length > 0) {
    return workspace[0].name;
  }
  return 'Global';
}

export function getTextSelection(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }
  
  const selection = editor.selection;
  if (selection.isEmpty) {
    return undefined;
  }
  
  return editor.document.getText(selection);
}

export async function insertTextAtCursor(text: string): Promise<boolean> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return false;
  }
  
  return editor.edit(editBuilder => {
    if (editor.selection.isEmpty) {
      editBuilder.insert(editor.selection.active, text);
    } else {
      editBuilder.replace(editor.selection, text);
    }
  });
}

export async function promptForSnippetDetails(
  defaultTitle: string = '',
  defaultDescription: string = '',
  defaultLanguage: string = 'plaintext',
  previousTags: string[] = []
): Promise<{
  title: string;
  description: string;
  language: string;
  tags: string[];
} | undefined> {
  const title = await vscode.window.showInputBox({
    prompt: 'Enter a title for your snippet',
    value: defaultTitle,
    validateInput: (value) => {
      return value.trim() ? null : 'Title is required';
    }
  });
  
  if (!title) {
    return undefined; // User cancelled
  }
  const description = await vscode.window.showInputBox({
    prompt: 'Enter a description (optional)',
    value: defaultDescription
  });
  
  if (description === undefined) {
    return undefined; // User cancelled
  }
  const languageOptions = getLanguageOptions();
  const languageQuickPickItems = languageOptions.map(lang => ({ label: lang }));
  const defaultLanguageItem = languageQuickPickItems.find(item => item.label === defaultLanguage);
  
  const selectedLanguage = await vscode.window.showQuickPick(
    languageQuickPickItems,
    {
      placeHolder: 'Select language',
      title: 'Select the language for this snippet',
      canPickMany: false
    }
  );
  
  if (!selectedLanguage) {
    return undefined; // User cancelled
  }
  const language = selectedLanguage.label;
  const tagsInput = await vscode.window.showInputBox({
    prompt: 'Enter tags (comma separated)',
    value: previousTags.join(', '),
    placeHolder: 'e.g. api, auth, database'
  });
  
  if (tagsInput === undefined) {
    return undefined; // User cancelled
  }
  
  const tags = tagsInput
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);
  
  return {
    title: title.trim(),
    description: description.trim(),
    language,
    tags
  };
}

export function analyzeCodeSelection(code: string, language: string): {
  suggestedTitle: string;
  suggestedTags: string[];
  suggestedDescription: string;
} {
  let suggestedTitle = '';
  let suggestedDescription = '';
  let suggestedTags: string[] = [];
  const extractFirstWord = (pattern: string): string => {
    const regex = new RegExp(pattern + '\\s+([\\w_$]+)');
    const match = code.match(regex);
    return match ? match[1] : '';
  };
  suggestedTags.push(language);
  if (['javascript', 'typescript'].includes(language)) {
    suggestedTitle = extractFirstWord('function') || 
                     extractFirstWord('class') || 
                     extractFirstWord('const') ||
                     extractFirstWord('let');
    if (code.includes('fetch(') || code.includes('axios.')) suggestedTags.push('api');
    if (code.includes('React.')) suggestedTags.push('react');
    if (code.includes('useState') || code.includes('useEffect')) suggestedTags.push('hooks');
    if (code.includes('async ')) suggestedTags.push('async');
  } else if (['python'].includes(language)) {
    suggestedTitle = extractFirstWord('def') || extractFirstWord('class');
    if (code.includes('import requests')) suggestedTags.push('api');
    if (code.includes('pandas')) suggestedTags.push('data');
    if (code.includes('async ')) suggestedTags.push('async');
  }
  const commentRegex = /\/\/\s*(.*)|#\s*(.*)|\/\*\s*(.*?)\s*\*\//;
  const commentMatch = code.match(commentRegex);
  if (commentMatch) {
    suggestedDescription = commentMatch[1] || commentMatch[2] || commentMatch[3] || '';
  }
  
  return {
    suggestedTitle: suggestedTitle || 'Code Snippet',
    suggestedTags,
    suggestedDescription
  };
}

function getLanguageOptions(): string[] {
  return [
    'plaintext',
    'javascript',
    'typescript',
    'python',
    'java',
    'csharp',
    'c',
    'cpp',
    'ruby',
    'php',
    'go',
    'rust',
    'html',
    'css',
    'markdown',
    'json',
    'yaml',
    'shell',
    'sql'
    // More languages will be added here in the future or just fork it and add more yourself.
  ];
}