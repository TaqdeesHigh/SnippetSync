import * as vscode from 'vscode';
import { getStorageInstance } from '../utils/database';
import { Snippet, SnippetFilter } from '../models/snippet';
import { insertTextAtCursor } from '../utils/snippetUtils';

export function registerSearchSnippetsCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('snippetSync.searchSnippets', async () => {
    const storage = getStorageInstance();
    const filter: SnippetFilter = {};
    const searchType = await vscode.window.showQuickPick(
      [
        { label: 'Search by Text', description: 'Search in snippet titles, descriptions, and code' },
        { label: 'Filter by Tags', description: 'Filter snippets by tags' },
        { label: 'Filter by Language', description: 'Filter snippets by programming language' },
        { label: 'Filter by Project', description: 'Filter snippets by project context' }
      ],
      { placeHolder: 'How would you like to search?' }
    );
    
    if (!searchType) {
      return;
    }
    if (searchType.label === 'Search by Text') {
      const searchTerm = await vscode.window.showInputBox({
        prompt: 'Enter search terms',
        placeHolder: 'Search in titles, descriptions, and code'
      });
      
      if (!searchTerm) {
        return;
      }
      
      filter.searchTerm = searchTerm;
    } else if (searchType.label === 'Filter by Tags') {
      const allTags = await storage.getAllTags();
      
      if (allTags.length === 0) {
        vscode.window.showInformationMessage('No tags found. Save some snippets with tags first.');
        return;
      }
      
      const selectedTags = await vscode.window.showQuickPick(
        allTags.map(tag => ({ label: tag })),
        { 
          placeHolder: 'Select tags to filter by',
          canPickMany: true
        }
      );
      
      if (!selectedTags || selectedTags.length === 0) {
        return;
      }
      
      filter.tags = selectedTags.map(item => item.label);
    } else if (searchType.label === 'Filter by Language') {
      const languages = await storage.getAllLanguages();
      
      if (languages.length === 0) {
        vscode.window.showInformationMessage('No languages found. Save some snippets first.');
        return;
      }
      
      const selectedLanguage = await vscode.window.showQuickPick(
        languages.map(lang => ({ label: lang })),
        { placeHolder: 'Select language' }
      );
      
      if (!selectedLanguage) {
        return;
      }
      
      filter.language = selectedLanguage.label;
    } else if (searchType.label === 'Filter by Project') {
      const projects = await storage.getAllProjects();
      
      if (projects.length === 0) {
        vscode.window.showInformationMessage('No projects found. Save some snippets first.');
        return;
      }
      
      const selectedProject = await vscode.window.showQuickPick(
        projects.map(project => ({ label: project })),
        { placeHolder: 'Select project' }
      );
      
      if (!selectedProject) {
        return;
      }
      
      filter.project = selectedProject.label;
    }
    const snippets = await storage.searchSnippets(filter);
    
    if (snippets.length === 0) {
      vscode.window.showInformationMessage('No snippets found matching your criteria.');
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
        placeHolder: `Found ${snippets.length} snippets. Select one to insert.`,
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