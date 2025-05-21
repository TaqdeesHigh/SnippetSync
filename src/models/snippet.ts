export interface Snippet {
  id: string;
  title: string;
  code: string;
  description?: string;
  language: string;
  tags: string[];
  projectContext: string;
  createdAt: number;
  updatedAt: number;
  gistId?: string;
}

export interface SnippetFilter {
  searchTerm?: string;
  tags?: string[];
  language?: string;
  project?: string;
}

export type SnippetCategory = 'tag' | 'language' | 'project';

export interface CategoryItem {
  type: SnippetCategory;
  name: string;
  count: number;
}