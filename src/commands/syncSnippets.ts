import * as vscode from 'vscode';
import { GistSyncProvider } from '../utils/githubGist';
import { getStorageInstance } from '../utils/database';
import { SnippetTreeViewProvider } from '../providers/snippetTreeViewProvider';

export function registerSyncSnippetsCommand(
  context: vscode.ExtensionContext,
  treeProvider: SnippetTreeViewProvider
): vscode.Disposable {
  return vscode.commands.registerCommand('snippetSync.syncSnippets', async () => {
    const config = vscode.workspace.getConfiguration('snippetSync');
    const enableGistSync = config.get<boolean>('enableGistSync', false);
    
    if (!enableGistSync) {
      const enableSync = await vscode.window.showInformationMessage(
        'GitHub Gists sync is currently disabled. Would you like to enable it?',
        'Enable',
        'Cancel'
      );
      
      if (enableSync !== 'Enable') {
        return;
      }
      
      await config.update('enableGistSync', true, vscode.ConfigurationTarget.Global);
    }
    let token = config.get<string>('githubToken', '');

    
    if (!token) {
        const inputToken = await vscode.window.showInputBox({
        prompt: 'Enter your GitHub Personal Access Token',
        password: true, 
        placeHolder: 'Token needs "gist" scope permission',
        validateInput: (value) => {
            return value.trim() ? null : 'Token is required';
        }
        });

        if (!inputToken) {
        return;
        }
        token = inputToken;
      await config.update('githubToken', token, vscode.ConfigurationTarget.Global);
    }
    const gistProvider = new GistSyncProvider(token);
    const progress = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Testing GitHub connection...',
      cancellable: false
    }, async () => {
      return await gistProvider.testConnection();
    });
    
    if (!progress) {
      vscode.window.showErrorMessage(
        'Failed to connect to GitHub. Please check your token and try again.'
      );
      return;
    }
    const syncDirection = await vscode.window.showQuickPick(
      [
        { 
          label: 'Upload Local → GitHub', 
          description: 'Upload your local snippets to GitHub Gists' 
        },
        { 
          label: 'Download GitHub → Local', 
          description: 'Download your GitHub Gists to local snippets' 
        },
        { 
          label: 'Bidirectional Sync', 
          description: 'Sync both ways (merge local and GitHub snippets)' 
        }
      ],
      { placeHolder: 'Select sync direction' }
    );
    
    if (!syncDirection) {
      return;
    }
    
    const storage = getStorageInstance();
    
    try {
      if (syncDirection.label === 'Upload Local → GitHub') {
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Uploading snippets to GitHub Gists...',
          cancellable: false
        }, async (progress) => {
          const snippets = await storage.getAllSnippets();
          let completed = 0;
          
          for (const snippet of snippets) {
            progress.report({ 
              message: `${completed}/${snippets.length}: ${snippet.title}`,
              increment: (1 / snippets.length) * 100
            });
            
            try {
              const gistId = await gistProvider.syncSnippetToGist(snippet);
              if (!snippet.gistId || snippet.gistId !== gistId) {
                snippet.gistId = gistId;
                await storage.saveSnippet(snippet);
              }
            } catch (error) {
              console.error(`Error syncing snippet ${snippet.id}:`, error);
            }
            
            completed++;
          }
          
          return completed;
        });
        
        vscode.window.showInformationMessage('Snippets uploaded to GitHub Gists successfully!');
      } else if (syncDirection.label === 'Download GitHub → Local') {
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Downloading snippets from GitHub Gists...',
          cancellable: false
        }, async () => {
          const gistSnippets = await gistProvider.fetchAllGists();
          
          for (const snippet of gistSnippets) {
            await storage.saveSnippet(snippet);
          }
          
          return gistSnippets.length;
        });
        
        vscode.window.showInformationMessage(
          'Snippets downloaded from GitHub Gists successfully!'
        );
      } else if (syncDirection.label === 'Bidirectional Sync') {
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Performing bidirectional sync...',
          cancellable: false
        }, async () => {
          const localSnippets = await storage.getAllSnippets();
          const gistSnippets = await gistProvider.fetchAllGists();
          const localSnippetsMap = new Map(localSnippets.map(s => [s.id, s]));
          const gistSnippetsMap = new Map(gistSnippets.map(s => [s.id, s]));
          for (const gistSnippet of gistSnippets) {
            const localSnippet = localSnippetsMap.get(gistSnippet.id);
            
            if (!localSnippet) {
              await storage.saveSnippet(gistSnippet);
            } else if (gistSnippet.updatedAt > localSnippet.updatedAt) {
              await storage.saveSnippet(gistSnippet);
            }
          }
          for (const localSnippet of localSnippets) {
            const gistSnippet = gistSnippetsMap.get(localSnippet.id);
            
            if (!gistSnippet || localSnippet.updatedAt > gistSnippet.updatedAt) {
              const gistId = await gistProvider.syncSnippetToGist(localSnippet);
              if (!localSnippet.gistId || localSnippet.gistId !== gistId) {
                localSnippet.gistId = gistId;
                await storage.saveSnippet(localSnippet);
              }
            }
          }
          
          return true;
        });
        
        vscode.window.showInformationMessage('Bidirectional sync completed successfully!');
      }
      treeProvider.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(`Sync failed: ${error}`);
    }
  });
}