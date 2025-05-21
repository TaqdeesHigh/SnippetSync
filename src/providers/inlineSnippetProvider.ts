import * as vscode from 'vscode';
import { getStorageInstance } from '../utils/database';
import { Snippet } from '../models/snippet';
import { insertTextAtCursor } from '../utils/snippetUtils';

interface SnippetCompletionItem extends vscode.CompletionItem {
  snippet: Snippet;
}

class SnippetCompletionProvider implements vscode.CompletionItemProvider {
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[] | undefined> {
    const config = vscode.workspace.getConfiguration('snippetSync');
    if (!config.get<boolean>('enableInlineSnippets', true)) {
      return undefined;
    }
    const linePrefix = document.lineAt(position).text.substring(0, position.character);
    const tagMatch = linePrefix.match(/@(\w*)$/);
    if (!tagMatch) {
      return undefined;
    }
    
    const tagPrefix = tagMatch[1].toLowerCase();
    const storage = getStorageInstance();
    const allTags = await storage.getAllTags();
    const matchingTags = allTags.filter(tag => 
      tag.toLowerCase().startsWith(tagPrefix)
    );
    
    if (matchingTags.length === 0) {
      return undefined;
    }
    const snippets: Snippet[] = [];
    for (const tag of matchingTags) {
      const result = await storage.searchSnippets({ tags: [tag] });
      snippets.push(...result);
    }
    const uniqueSnippets = Array.from(
      new Map(snippets.map(s => [s.id, s])).values()
    );
    uniqueSnippets.sort((a, b) => b.updatedAt - a.updatedAt);
    const maxResults = Math.min(uniqueSnippets.length, 10);
    return uniqueSnippets.slice(0, maxResults).map(snippet => {
      const item: SnippetCompletionItem = {
        label: `@${snippet.tags.join(', @')}: ${snippet.title}`,
        kind: vscode.CompletionItemKind.Snippet,
        detail: snippet.description,
        documentation: new vscode.MarkdownString(
          `**${snippet.title}**\n\n` +
          `${snippet.description || ''}\n\n` +
          `\`\`\`${snippet.language}\n${snippet.code}\n\`\`\``
        ),
        insertText: snippet.code,
        sortText: ('0000' + (maxResults - uniqueSnippets.indexOf(snippet))).slice(-4),
        filterText: `@${snippet.tags.join(' @')} ${snippet.title}`,
        snippet
      };
      item.range = new vscode.Range(
        position.translate(0, -tagMatch[0].length),
        position
      );
      
      return item;
    });
  }
  
  resolveCompletionItem(
    item: vscode.CompletionItem,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CompletionItem> {
    return item;
  }
}

export function setupInlineSnippetSuggestions(context: vscode.ExtensionContext): void {
  for (const sub of context.subscriptions) {
    if ((sub as any)['_id']?.includes('inlineSnippetCompletion')) {
      sub.dispose();
      const index = context.subscriptions.indexOf(sub);
      if (index > -1) {
        context.subscriptions.splice(index, 1);
      }
    }
  }
  const config = vscode.workspace.getConfiguration('snippetSync');
  if (!config.get<boolean>('enableInlineSnippets', true)) {
    return;
  }
  const provider = new SnippetCompletionProvider();
  const completionDisposable = vscode.languages.registerCompletionItemProvider(
    { scheme: 'file' },
    provider,
    '@'
  );
  (completionDisposable as any)['_id'] = 'inlineSnippetCompletion';
  
  context.subscriptions.push(completionDisposable);
}
