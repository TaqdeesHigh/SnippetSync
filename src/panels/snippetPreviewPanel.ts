import * as vscode from 'vscode';
import { Snippet } from '../models/snippet';

export class SnippetPreviewPanel {
  public static currentPanel: SnippetPreviewPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _snippet: Snippet;

  private constructor(panel: vscode.WebviewPanel, snippet: Snippet) {
    this._panel = panel;
    this._snippet = snippet;
    this._update();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.onDidChangeViewState(
      e => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );
    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'insert':
            vscode.commands.executeCommand('snippetSync.insertSnippet', this._snippet);
            return;
          case 'findSource':
            this._findSnippetSource(this._snippet);
            return;
          case 'edit':
            vscode.commands.executeCommand('snippetSync.editSnippet', this._snippet);
            return;
          case 'close':
            this._panel.dispose();  
            return;
        }
      },
      null,
      this._disposables
    );
  }

  private async _findSnippetSource(snippet: Snippet) {
    await vscode.commands.executeCommand('workbench.action.findInFiles', {
      query: snippet.code.substring(0, Math.min(100, snippet.code.length)),
      triggerSearch: true,
      matchWholeWord: false,
      isCaseSensitive: true
    });
  }

  public static createOrShow(snippet: Snippet) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;
    if (SnippetPreviewPanel.currentPanel) {
      SnippetPreviewPanel.currentPanel._panel.reveal(column);
      SnippetPreviewPanel.currentPanel._snippet = snippet;
      SnippetPreviewPanel.currentPanel._update();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'snippetPreview',
      `Snippet: ${snippet.title}`,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    SnippetPreviewPanel.currentPanel = new SnippetPreviewPanel(panel, snippet);
  }

  private _update() {
    this._panel.title = `Snippet: ${this._snippet.title}`;
    this._panel.webview.html = this._getHtmlForWebview();
  }

  private _getHtmlForWebview() {
    // Properly escape the snippet data for JSON embedding
    const snippetJson = JSON.stringify(this._snippet)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"');

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Snippet Preview</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          padding: 20px;
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
          max-width: 800px;
          margin: 0 auto;
        }
        .header {
          margin-bottom: 20px;
          border-bottom: 1px solid var(--vscode-panel-border);
          padding-bottom: 15px;
        }
        h2 {
          margin: 0;
          padding: 0;
          font-size: 24px;
          color: var(--vscode-editor-foreground);
        }
        .meta {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin: 10px 0;
          font-size: 14px;
        }
        .tag {
          background: var(--vscode-badge-background);
          color: var(--vscode-badge-foreground);
          padding: 3px 8px;
          border-radius: 16px;
          font-size: 12px;
        }
        .language {
          background: var(--vscode-activityBarBadge-background);
          color: var(--vscode-activityBarBadge-foreground);
          padding: 3px 8px;
          border-radius: 16px;
          font-size: 12px;
        }
        .description {
          margin-bottom: 15px;
          font-style: italic;
          color: var(--vscode-descriptionForeground);
        }
        pre {
          background: var(--vscode-textCodeBlock-background);
          padding: 15px;
          border-radius: 8px;
          overflow: auto;
          margin-bottom: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        code {
          font-family: var(--vscode-editor-font-family);
          font-size: var(--vscode-editor-font-size);
        }
        .actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        button {
          padding: 8px 16px;
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: background-color 0.2s;
        }
        button:hover {
          background: var(--vscode-button-hoverBackground);
        }
        .secondary-button {
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }
        .secondary-button:hover {
          background: var(--vscode-button-secondaryHoverBackground);
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>${this._escapeHtml(this._snippet.title)}</h2>
        <div class="meta">
          <span class="language">${this._escapeHtml(this._snippet.language)}</span>
          ${this._snippet.tags.map(tag => `<span class="tag">${this._escapeHtml(tag)}</span>`).join('')}
        </div>
        ${this._snippet.description ? `<div class="description">${this._escapeHtml(this._snippet.description)}</div>` : ''}
      </div>
      <pre><code>${this._escapeHtml(this._snippet.code)}</code></pre>
      <div class="actions">
        <button id="findSourceBtn" class="secondary-button">
          Find Source
        </button>
        <button id="editBtn" class="secondary-button">
          Edit Snippet
        </button>
        <button id="closeBtn" class="secondary-button">
          Close
        </button>
      </div>
      
      <script>
        (function() {
          const vscode = acquireVsCodeApi();
          
          document.getElementById('findSourceBtn').addEventListener('click', function() {
            vscode.postMessage({ command: 'findSource' });
          });
          
          document.getElementById('editBtn').addEventListener('click', function() {
            vscode.postMessage({ command: 'edit' });
          });
          
          document.getElementById('closeBtn').addEventListener('click', function() {
            vscode.postMessage({ command: 'close' });
          });
        })();
      </script>
    </body>
    </html>`;
  }

  private _escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public dispose() {
    SnippetPreviewPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}