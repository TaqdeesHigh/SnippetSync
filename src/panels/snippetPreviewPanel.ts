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
            this._panel.dispose();
            return;
          case 'edit':
            vscode.commands.executeCommand('snippetSync.editSnippet', this._snippet);
            this._panel.dispose();
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
    const encodedSnippet = JSON.stringify(this._snippet).replace(/"/g, '&quot;');

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
        }
        .header {
          margin-bottom: 20px;
        }
        h2 {
          margin: 0;
          padding: 0;
          font-size: 24px;
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
          padding: 2px 8px;
          border-radius: 4px;
        }
        .language {
          background: var(--vscode-editor-infoForeground);
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
        }
        .description {
          margin-bottom: 15px;
          font-style: italic;
        }
        pre {
          background: var(--vscode-editor-background);
          padding: 15px;
          border-radius: 5px;
          overflow: auto;
          margin-bottom: 20px;
        }
        code {
          font-family: var(--vscode-editor-font-family);
          font-size: var(--vscode-editor-font-size);
        }
        .actions {
          display: flex;
          gap: 10px;
        }
        button {
          padding: 8px 16px;
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        button:hover {
          background: var(--vscode-button-hoverBackground);
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>${this._snippet.title}</h2>
        <div class="meta">
          <span class="language">${this._snippet.language}</span>
          ${this._snippet.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
        </div>
        <div class="description">${this._snippet.description || ''}</div>
      </div>
      <pre><code>${this._escapeHtml(this._snippet.code)}</code></pre>
      <div class="actions">
        <button id="insertBtn">Insert Snippet</button>
        <button id="editBtn">Edit Snippet</button>
        <button id="closeBtn">Close</button>
      </div>
      
      <script>
        const vscode = acquireVsCodeApi();
        const snippet = ${encodedSnippet};
        
        document.getElementById('insertBtn').addEventListener('click', () => {
          vscode.postMessage({ command: 'insert' });
        });
        
        document.getElementById('editBtn').addEventListener('click', () => {
          vscode.postMessage({ command: 'edit' });
        });
        
        document.getElementById('closeBtn').addEventListener('click', () => {
          vscode.postMessage({ command: 'close' });
        });
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