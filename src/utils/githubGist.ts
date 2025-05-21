import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';
import { Snippet } from '../models/snippet';

export class GistSyncProvider {
  private client: AxiosInstance;
  private token: string;
  
  constructor(token: string) {
    this.token = token;
    this.client = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${token}`,
        'User-Agent': 'VSCode-SnippetSync-Extension'
      }
    });
  }
  
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/user');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
  
  async syncSnippetToGist(snippet: Snippet): Promise<string> {
    const files: Record<string, { content: string }> = {
      [`${snippet.title}.${this.getFileExtension(snippet.language)}`]: {
        content: snippet.code
      },
      'metadata.json': {
        content: JSON.stringify({
          id: snippet.id,
          title: snippet.title,
          description: snippet.description,
          language: snippet.language,
          tags: snippet.tags,
          projectContext: snippet.projectContext,
          createdAt: snippet.createdAt,
          updatedAt: snippet.updatedAt
        }, null, 2)
      }
    };
    
    const gistData = {
      description: `SnippetSync: ${snippet.title}`,
      public: false,
      files
    };
    
    try {
      if (snippet.gistId) {
        await this.client.patch(`/gists/${snippet.gistId}`, gistData);
        return snippet.gistId;
      } else {
        const response = await this.client.post('/gists', gistData);
        return response.data.id;
      }
    } catch (error) {
      console.error('Error syncing to Gist:', error);
      throw new Error('Failed to sync snippet to GitHub Gist');
    }
  }
  
async deleteGist(gistId: string): Promise<boolean> {
    try {
      await this.client.delete(`/gists/${gistId}`);
      return true;
    } catch (error) {
      console.error('Error deleting Gist:', error);
      return false;
    }
  }
  
  async fetchAllGists(): Promise<Snippet[]> {
    try {
      const snippets: Snippet[] = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const response = await this.client.get('/gists', {
          params: { per_page: 100, page }
        });
        
        const gists = response.data;
        
        if (gists.length === 0) {
          hasMore = false;
          break;
        }
        
        for (const gist of gists) {
          if (gist.files['metadata.json']) {
            try {
              const metadataResponse = await this.client.get(gist.files['metadata.json'].raw_url);
              const metadata = metadataResponse.data;
              const codeFileName = Object.keys(gist.files).find(name => name !== 'metadata.json');
              
              if (codeFileName) {
                const codeResponse = await this.client.get(gist.files[codeFileName].raw_url);
                const code = codeResponse.data;
                
                snippets.push({
                  id: metadata.id,
                  title: metadata.title,
                  code,
                  description: metadata.description,
                  language: metadata.language,
                  tags: metadata.tags,
                  projectContext: metadata.projectContext,
                  createdAt: metadata.createdAt,
                  updatedAt: metadata.updatedAt,
                  gistId: gist.id
                });
              }
            } catch (error) {
              console.error('Error processing Gist:', error);
              continue;
            }
          }
        }
        
        page++;
      }
      
      return snippets;
    } catch (error) {
      console.error('Error fetching Gists:', error);
      throw new Error('Failed to fetch snippets from GitHub Gists');
    }
  }
  
  private getFileExtension(language: string): string {
    const extensionMap: Record<string, string> = {
      'javascript': 'js',
      'typescript': 'ts',
      'python': 'py',
      'java': 'java',
      'csharp': 'cs',
      'c': 'c',
      'cpp': 'cpp',
      'ruby': 'rb',
      'php': 'php',
      'go': 'go',
      'rust': 'rs',
      'html': 'html',
      'css': 'css',
      'markdown': 'md',
      'json': 'json',
      'yaml': 'yml',
      'shell': 'sh',
      'sql': 'sql',
      'plaintext': 'txt'
    };
    
    return extensionMap[language.toLowerCase()] || 'txt';
  }
}