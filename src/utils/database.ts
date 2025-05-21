import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as sqlite3 from 'sqlite3';
import { Snippet, SnippetFilter, CategoryItem } from '../models/snippet';

interface SnippetRow {
  id: string;
  title: string;
  code: string;
  description?: string;
  language: string;
  projectContext: string;
  createdAt: number;
  updatedAt: number;
  gistId?: string;
}

interface TagRow {
  id: number;
  name: string;
}

interface SnippetTagRow {
  snippetId: string;
  tagId: number;
}

interface CategoryRow {
  name: string;
  count: number;
}

export interface StorageProvider {
  getAllSnippets(): Promise<Snippet[]>;
  getSnippet(id: string): Promise<Snippet | undefined>;
  saveSnippet(snippet: Snippet): Promise<Snippet>;
  deleteSnippet(id: string): Promise<boolean>;
  searchSnippets(filter: SnippetFilter): Promise<Snippet[]>;
  getAllTags(): Promise<string[]>;
  getAllLanguages(): Promise<string[]>;
  getAllProjects(): Promise<string[]>;
  getCategories(type: 'tag' | 'language' | 'project'): Promise<CategoryItem[]>;
  close(): void;
}

class JsonStorageProvider implements StorageProvider {
  private filePath: string;
  private snippets: Map<string, Snippet> = new Map();
  
  constructor(filePath: string) {
    this.filePath = filePath;
    this.loadSnippets();
  }
  
  private loadSnippets(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        const snippetArray: Snippet[] = JSON.parse(data);
        this.snippets = new Map(snippetArray.map(s => [s.id, s]));
      } else {
        this.snippets = new Map();
        this.saveToFile();
      }
    } catch (error) {
      console.error('Error loading snippets:', error);
      this.snippets = new Map();
      this.saveToFile();
    }
  }
  
  private saveToFile(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const snippetArray = Array.from(this.snippets.values());
      fs.writeFileSync(this.filePath, JSON.stringify(snippetArray, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving snippets:', error);
      vscode.window.showErrorMessage('Failed to save snippets to file.');
    }
  }
  
  async getAllSnippets(): Promise<Snippet[]> {
    return Array.from(this.snippets.values());
  }
  
  async getSnippet(id: string): Promise<Snippet | undefined> {
    return this.snippets.get(id);
  }
  
  async saveSnippet(snippet: Snippet): Promise<Snippet> {
    this.snippets.set(snippet.id, snippet);
    this.saveToFile();
    return snippet;
  }
  
  async deleteSnippet(id: string): Promise<boolean> {
    const success = this.snippets.delete(id);
    if (success) {
      this.saveToFile();
    }
    return success;
  }
  
  async searchSnippets(filter: SnippetFilter): Promise<Snippet[]> {
    let result = Array.from(this.snippets.values());
    
    if (filter.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      result = result.filter(s => 
        s.title.toLowerCase().includes(term) || 
        s.code.toLowerCase().includes(term) || 
        (s.description && s.description.toLowerCase().includes(term))
      );
    }
    
    if (filter.tags && filter.tags.length > 0) {
      result = result.filter(s => 
        filter.tags!.every(tag => s.tags.includes(tag))
      );
    }
    
    if (filter.language) {
      result = result.filter(s => s.language === filter.language);
    }
    
    if (filter.project) {
      result = result.filter(s => s.projectContext === filter.project);
    }
    
    return result;
  }
  
  async getAllTags(): Promise<string[]> {
    const tags = new Set<string>();
    this.snippets.forEach(snippet => {
      snippet.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags);
  }
  
  async getAllLanguages(): Promise<string[]> {
    const languages = new Set<string>();
    this.snippets.forEach(snippet => {
      languages.add(snippet.language);
    });
    return Array.from(languages);
  }
  
  async getAllProjects(): Promise<string[]> {
    const projects = new Set<string>();
    this.snippets.forEach(snippet => {
      projects.add(snippet.projectContext);
    });
    return Array.from(projects);
  }
  
  async getCategories(type: 'tag' | 'language' | 'project'): Promise<CategoryItem[]> {
    const countMap = new Map<string, number>();
    
    this.snippets.forEach(snippet => {
      if (type === 'tag') {
        snippet.tags.forEach(tag => {
          countMap.set(tag, (countMap.get(tag) || 0) + 1);
        });
      } else if (type === 'language') {
        const lang = snippet.language;
        countMap.set(lang, (countMap.get(lang) || 0) + 1);
      } else if (type === 'project') {
        const project = snippet.projectContext;
        countMap.set(project, (countMap.get(project) || 0) + 1);
      }
    });
    
    return Array.from(countMap.entries()).map(([name, count]) => ({
      type,
      name,
      count
    }));
  }
  
  close(): void {
    // Nothing to close for JSON storage
  }
}
class SqliteStorageProvider implements StorageProvider {
  private db: sqlite3.Database;
  
  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    this.db = new sqlite3.Database(dbPath);
    this.initDb();
  }
  
  private initDb(): void {
    this.db.serialize(() => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS snippets (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          code TEXT NOT NULL,
          description TEXT,
          language TEXT NOT NULL,
          projectContext TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL,
          gistId TEXT
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL
        )
      `);
      
      this.db.run(`
        CREATE TABLE IF NOT EXISTS snippet_tags (
          snippetId TEXT NOT NULL,
          tagId INTEGER NOT NULL,
          PRIMARY KEY (snippetId, tagId),
          FOREIGN KEY (snippetId) REFERENCES snippets(id) ON DELETE CASCADE,
          FOREIGN KEY (tagId) REFERENCES tags(id) ON DELETE CASCADE
        )
      `);
      this.db.run('CREATE INDEX IF NOT EXISTS idx_snippets_language ON snippets(language)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_snippets_project ON snippets(projectContext)');
    });
  }
  
  async getAllSnippets(): Promise<Snippet[]> {
    return new Promise((resolve, reject) => {
      const snippets = new Map<string, Snippet>();
      
      this.db.all(`SELECT * FROM snippets ORDER BY updatedAt DESC`, [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        (rows as SnippetRow[]).forEach(row => {
          snippets.set(row.id, {
            ...row,
            tags: []
          });
        });
        
        if (snippets.size === 0) {
          resolve([]);
          return;
        }
        const snippetIds = Array.from(snippets.keys());
        const placeholders = snippetIds.map(() => '?').join(',');
        
        this.db.all(
          `SELECT t.name, st.snippetId
           FROM tags t
           JOIN snippet_tags st ON t.id = st.tagId
           WHERE st.snippetId IN (${placeholders})`,
          snippetIds,
          (err, tagRows) => {
            if (err) {
              reject(err);
              return;
            }
            
            (tagRows as {name: string, snippetId: string}[]).forEach(row => {
              const snippet = snippets.get(row.snippetId);
              if (snippet) {
                snippet.tags.push(row.name);
              }
            });
            
            resolve(Array.from(snippets.values()));
          }
        );
      });
    });
  }
  
  async getSnippet(id: string): Promise<Snippet | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(`SELECT * FROM snippets WHERE id = ?`, [id], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!row) {
          resolve(undefined);
          return;
        }
        const snippet: Snippet = {
          id: (row as SnippetRow).id,
          title: (row as SnippetRow).title,
          code: (row as SnippetRow).code,
          description: (row as SnippetRow).description,
          language: (row as SnippetRow).language,
          projectContext: (row as SnippetRow).projectContext,
          createdAt: (row as SnippetRow).createdAt,
          updatedAt: (row as SnippetRow).updatedAt,
          gistId: (row as SnippetRow).gistId,
          tags: []
        };
        
        this.db.all(
          `SELECT t.name
           FROM tags t
           JOIN snippet_tags st ON t.id = st.tagId
           WHERE st.snippetId = ?`,
          [id],
          (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            
            snippet.tags = (rows as {name: string}[]).map(r => r.name);
            resolve(snippet);
          }
        );
      });
    });
  }
  
  async saveSnippet(snippet: Snippet): Promise<Snippet> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        try {
          this.db.run(
            `INSERT OR REPLACE INTO snippets
             (id, title, code, description, language, projectContext, createdAt, updatedAt, gistId)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              snippet.id,
              snippet.title,
              snippet.code,
              snippet.description || null,
              snippet.language,
              snippet.projectContext,
              snippet.createdAt,
              snippet.updatedAt,
              snippet.gistId || null
            ]
          );
          
          this.db.run('DELETE FROM snippet_tags WHERE snippetId = ?', [snippet.id]);
          snippet.tags.forEach(tagName => {
            this.db.run('INSERT OR IGNORE INTO tags (name) VALUES (?)', [tagName]);
            this.db.get('SELECT id FROM tags WHERE name = ?', [tagName], (err, row) => {
              if (err) {
                this.db.run('ROLLBACK');
                reject(err);
                return;
              }
              
              this.db.run(
                'INSERT OR IGNORE INTO snippet_tags (snippetId, tagId) VALUES (?, ?)',
                [snippet.id, (row as TagRow).id]
              );
            });
          });
          
          this.db.run('COMMIT', err => {
            if (err) {
              reject(err);
            } else {
              resolve(snippet);
            }
          });
        } catch (err) {
          this.db.run('ROLLBACK');
          reject(err);
        }
      });
    });
  }
  
  async deleteSnippet(id: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM snippets WHERE id = ?', [id], function(err) {
        if (err) {
          reject(err);
          return;
        }
        
        resolve(this.changes > 0);
      });
    });
  }
  
  async searchSnippets(filter: SnippetFilter): Promise<Snippet[]> {
    let query = `SELECT DISTINCT s.* FROM snippets s`;
    const params: any[] = [];
    const conditions: string[] = [];
    if (filter.tags && filter.tags.length > 0) {
      const tagPlaceholders = filter.tags.map(() => '?').join(',');
      query += `
        JOIN snippet_tags st ON s.id = st.snippetId
        JOIN tags t ON st.tagId = t.id
        WHERE t.name IN (${tagPlaceholders})
      `;
      params.push(...filter.tags);
      query += ` GROUP BY s.id HAVING COUNT(DISTINCT t.name) = ?`;
      params.push(filter.tags.length);
    } else {
      query += ` WHERE 1=1`;
    }
    
    if (filter.language) {
      conditions.push(`s.language = ?`);
      params.push(filter.language);
    }
    
    if (filter.project) {
      conditions.push(`s.projectContext = ?`);
      params.push(filter.project);
    }
    
    if (filter.searchTerm) {
      conditions.push(`(s.title LIKE ? OR s.code LIKE ? OR s.description LIKE ?)`);
      const term = `%${filter.searchTerm}%`;
      params.push(term, term, term);
    }
    
    if (conditions.length > 0) {
      if (filter.tags && filter.tags.length > 0) {
        query += ` AND ${conditions.join(' AND ')}`;
      } else {
        query += ` AND ${conditions.join(' AND ')}`;
      }
    }
    
    query += ` ORDER BY s.updatedAt DESC`;
    
    return new Promise((resolve, reject) => {
      this.db.all(query, params, async (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        try {
          const snippets: Snippet[] = [];
          
          for (const row of rows as SnippetRow[]) {
            const tags = await this.getSnippetTags(row.id);
            snippets.push({
              ...row,
              tags
            });
          }
          
          resolve(snippets);
        } catch (err) {
          reject(err);
        }
      });
    });
  }
  
  private async getSnippetTags(snippetId: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT t.name
         FROM tags t
         JOIN snippet_tags st ON t.id = st.tagId
         WHERE st.snippetId = ?`,
        [snippetId],
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          
          resolve((rows as {name: string}[]).map(r => r.name));
        }
      );
    });
  }
  
  async getAllTags(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.db.all(`SELECT name FROM tags ORDER BY name`, [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        resolve((rows as {name: string}[]).map(r => r.name));
      });
    });
  }
  
  async getAllLanguages(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT DISTINCT language FROM snippets ORDER BY language`,
        [],
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          
          resolve((rows as {language: string}[]).map(r => r.language));
        }
      );
    });
  }
  
  async getAllProjects(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT DISTINCT projectContext FROM snippets ORDER BY projectContext`,
        [],
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          
          resolve((rows as {projectContext: string}[]).map(r => r.projectContext));
        }
      );
    });
  }
  
  async getCategories(type: 'tag' | 'language' | 'project'): Promise<CategoryItem[]> {
    let query = '';
    
    if (type === 'tag') {
      query = `
        SELECT t.name, COUNT(st.snippetId) as count
        FROM tags t
        JOIN snippet_tags st ON t.id = st.tagId
        GROUP BY t.name
        ORDER BY count DESC, t.name
      `;
    } else if (type === 'language') {
      query = `
        SELECT language as name, COUNT(*) as count
        FROM snippets
        GROUP BY language
        ORDER BY count DESC, name
      `;
    } else if (type === 'project') {
      query = `
        SELECT projectContext as name, COUNT(*) as count
        FROM snippets
        GROUP BY projectContext
        ORDER BY count DESC, name
      `;
    }
    
    return new Promise((resolve, reject) => {
      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        resolve((rows as CategoryRow[]).map(row => ({
          type,
          name: row.name,
          count: row.count
        })));
      });
    });
  }
  
  close(): void {
    this.db.close();
  }
}
let storageInstance: StorageProvider | null = null;

export function getStorageInstance(): StorageProvider {
  if (!storageInstance) {
    throw new Error('Storage not initialized');
  }
  return storageInstance;
}

export async function initializeStorage(context: vscode.ExtensionContext): Promise<void> {
  if (storageInstance) {
    storageInstance.close();
    storageInstance = null;
  }
  
  const config = vscode.workspace.getConfiguration('snippetSync');
  const storageType = config.get<string>('storageType', 'json');
  const storagePath = config.get<string>('storagePath', '');
  
  let filePath: string;
  
  if (storagePath) {
    filePath = storagePath;
  } else {
    const globalStoragePath = context.globalStorageUri.fsPath;
    filePath = path.join(globalStoragePath, storageType === 'json' ? 'snippets.json' : 'snippets.db');
  }
  
  if (storageType === 'json') {
    storageInstance = new JsonStorageProvider(filePath);
  } else {
    storageInstance = new SqliteStorageProvider(filePath);
  }
}