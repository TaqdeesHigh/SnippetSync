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
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Snippet Preview</title>
      <style>
        * {
          box-sizing: border-box;
        }
        
        body {
          font-family: var(--vscode-font-family, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif);
          margin: 0;
          padding: 0;
          color: var(--vscode-foreground);
          background: linear-gradient(135deg, 
            var(--vscode-editor-background) 0%, 
            var(--vscode-sideBar-background, var(--vscode-editor-background)) 100%);
          min-height: 100vh;
          line-height: 1.6;
        }
        
        .container {
          max-width: 900px;
          margin: 0 auto;
          padding: 2rem;
        }
        
        .header-card {
          background: var(--vscode-sideBar-background, rgba(255, 255, 255, 0.05));
          border-radius: 16px;
          padding: 2rem;
          margin-bottom: 2rem;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          backdrop-filter: blur(10px);
          border: 1px solid var(--vscode-panel-border, rgba(255, 255, 255, 0.1));
          position: relative;
          overflow: hidden;
        }
        
        .header-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, 
            var(--vscode-activityBarBadge-background, #007acc) 0%,
            var(--vscode-button-background, #0e639c) 50%,
            var(--vscode-focusBorder, #007fd4) 100%);
        }
        
        .snippet-title {
          margin: 0 0 1rem 0;
          font-size: 2rem;
          font-weight: 700;
          color: var(--vscode-editor-foreground);
          background: linear-gradient(135deg, 
            var(--vscode-foreground) 0%, 
            var(--vscode-activityBarBadge-background, #007acc) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .meta-container {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }
        
        .language-badge {
          background: linear-gradient(135deg, 
            var(--vscode-activityBarBadge-background, #007acc), 
            var(--vscode-button-background, #0e639c));
          color: var(--vscode-activityBarBadge-foreground, white);
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          box-shadow: 0 4px 12px rgba(0, 122, 204, 0.3);
        }
        
        .tags-container {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        
        .tag {
          background: var(--vscode-badge-background, rgba(255, 255, 255, 0.1));
          color: var(--vscode-badge-foreground);
          padding: 0.375rem 0.75rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 500;
          border: 1px solid var(--vscode-panel-border, rgba(255, 255, 255, 0.2));
          transition: all 0.2s ease;
        }
        
        .tag:hover {
          background: var(--vscode-button-hoverBackground, rgba(255, 255, 255, 0.15));
          transform: translateY(-2px);
        }
        
        .description {
          margin-top: 1rem;
          font-size: 1rem;
          color: var(--vscode-descriptionForeground);
          font-style: italic;
          opacity: 0.9;
        }
        
        .code-card {
          background: var(--vscode-textCodeBlock-background, var(--vscode-editor-background));
          border-radius: 16px;
          overflow: hidden;
          margin-bottom: 2rem;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
          border: 1px solid var(--vscode-panel-border, rgba(255, 255, 255, 0.1));
        }
        
        .code-header {
          background: linear-gradient(135deg, 
            var(--vscode-tab-activeBackground, rgba(255, 255, 255, 0.05)), 
            var(--vscode-sideBar-background, rgba(255, 255, 255, 0.03)));
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--vscode-panel-border, rgba(255, 255, 255, 0.1));
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .code-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--vscode-foreground);
          opacity: 0.8;
        }
        
        .copy-btn {
          background: transparent;
          border: 1px solid var(--vscode-panel-border, rgba(255, 255, 255, 0.2));
          color: var(--vscode-foreground);
          padding: 0.25rem 0.5rem;
          border-radius: 6px;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .copy-btn:hover {
          background: var(--vscode-button-hoverBackground, rgba(255, 255, 255, 0.1));
        }
        
        pre {
          margin: 0;
          padding: 1.5rem;
          overflow: auto;
          max-height: 400px;
          background: transparent;
        }
        
        code {
          font-family: var(--vscode-editor-font-family, 'Fira Code', 'Consolas', monospace);
          font-size: var(--vscode-editor-font-size, 14px);
          line-height: 1.5;
        }
        
        .actions-container {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          justify-content: center;
        }
        
        .action-btn {
          padding: 0.875rem 1.5rem;
          border: none;
          border-radius: 12px;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
          min-width: 120px;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .action-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          transition: left 0.5s;
        }
        
        .action-btn:hover::before {
          left: 100%;
        }
        
        .primary-btn {
          background: linear-gradient(135deg, 
            var(--vscode-button-background, #007acc), 
            var(--vscode-activityBarBadge-background, #0e639c));
          color: var(--vscode-button-foreground, white);
        }
        
        .primary-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 122, 204, 0.4);
        }
        
        .secondary-btn {
          background: var(--vscode-button-secondaryBackground, rgba(255, 255, 255, 0.05));
          color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
          border: 1px solid var(--vscode-panel-border, rgba(255, 255, 255, 0.2));
        }
        
        .secondary-btn:hover {
          background: var(--vscode-button-secondaryHoverBackground, rgba(255, 255, 255, 0.1));
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
        }
        
        .danger-btn {
          background: linear-gradient(135deg, #e74c3c, #c0392b);
          color: white;
        }
        
        .danger-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(231, 76, 60, 0.4);
        }
        
        .icon {
          width: 16px;
          height: 16px;
          opacity: 0.9;
        }
        
        /* Scrollbar styling */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: var(--vscode-scrollbarSlider-background, rgba(255, 255, 255, 0.1));
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb {
          background: var(--vscode-scrollbarSlider-hoverBackground, rgba(255, 255, 255, 0.3));
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: var(--vscode-scrollbarSlider-activeBackground, rgba(255, 255, 255, 0.5));
        }
        
        /* Responsive design */
        @media (max-width: 768px) {
          .container {
            padding: 1rem;
          }
          
          .header-card {
            padding: 1.5rem;
          }
          
          .snippet-title {
            font-size: 1.5rem;
          }
          
          .actions-container {
            flex-direction: column;
          }
          
          .action-btn {
            width: 100%;
          }
        }
        
        /* Animation for smooth appearance */
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .container > * {
          animation: fadeInUp 0.6s ease-out;
        }
        
        .header-card {
          animation-delay: 0.1s;
        }
        
        .code-card {
          animation-delay: 0.2s;
        }
        
        .actions-container {
          animation-delay: 0.3s;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header-card">
          <h1 class="snippet-title">${this._escapeHtml(this._snippet.title)}</h1>
          <div class="meta-container">
            <span class="language-badge">${this._escapeHtml(this._snippet.language)}</span>
            <div class="tags-container">
              ${this._snippet.tags.map(tag => `<span class="tag">${this._escapeHtml(tag)}</span>`).join('')}
            </div>
          </div>
          ${this._snippet.description ? `<div class="description">${this._escapeHtml(this._snippet.description)}</div>` : ''}
        </div>
        
        <div class="code-card">
          <div class="code-header">
            <span class="code-title">Code</span>
            <button class="copy-btn" id="copyBtn">Copy</button>
          </div>
          <pre><code>${this._escapeHtml(this._snippet.code)}</code></pre>
        </div>
        
        <div class="actions-container">
          <button id="findSourceBtn" class="action-btn secondary-btn">
            <svg class="icon" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
            </svg>
            Find Source
          </button>
          <button id="editBtn" class="action-btn secondary-btn">
            <svg class="icon" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708L10.5 8.207l-3-3L12.146.146zM11.207 9l-4-4L2.5 9.707V13.5a.5.5 0 0 0 .5.5h3.793L11.207 9zM13 2.5L10.5 5 11 5.5 13.5 3 13 2.5z"/>
            </svg>
            Edit
          </button>
          <button id="closeBtn" class="action-btn danger-btn">
            <svg class="icon" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z"/>
            </svg>
            Close
          </button>
        </div>
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
          
          document.getElementById('copyBtn').addEventListener('click', function() {
            const codeElement = document.querySelector('code');
            if (codeElement) {
              navigator.clipboard.writeText(codeElement.textContent).then(() => {
                const btn = this;
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(() => {
                  btn.textContent = originalText;
                }, 2000);
              });
            }
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