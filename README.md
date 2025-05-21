# SnippetSync for VS Code

SnippetSync is a powerful and efficient code snippet manager for VS Code that enables you to save, organize, and reuse code snippets across your projects. It focuses on local-first storage and doesn't use any AI/ML features.

## Features

- **Instant Snippet Saving**: Quickly save selected code as snippets with title, description, language, and tags
- **Local-First Storage**: Store snippets in either JSON or SQLite format
- **Manual Tagging**: Assign custom tags to your snippets for better organization
- **Powerful Search**: Find snippets by text, tags, language, or project
- **Inline Suggestions**: Get snippet suggestions when typing `@tagname`
- **Categorized View**: Browse snippets by tags, languages, or projects
- **Optional GitHub Gists Sync**: Sync your snippets with GitHub Gists
- **Keyboard Shortcuts**: Save and insert snippets quickly

## Getting Started

1. Install the extension from the VS Code Marketplace
2. Select some code in your editor
3. Use the command palette (`Ctrl+Shift+P`) and search for "SnippetSync: Save Selected Code as Snippet"
4. Enter a title, optional description, and tags for your snippet
5. Your snippet is now saved and available for future use!

## Commands

- **SnippetSync: Save Selected Code as Snippet** - Save the currently selected code as a snippet
- **SnippetSync: Insert Snippet** - Insert a saved snippet at cursor position
- **SnippetSync: Search Snippets** - Search for snippets using various filters
- **SnippetSync: Sync Snippets** - Sync snippets with GitHub Gists
- **SnippetSync: Refresh Snippets View** - Refresh the snippets explorer view

## Keyboard Shortcuts

- `Ctrl+Alt+S` (Windows/Linux) or `Cmd+Alt+S` (Mac) - Save selected code as snippet
- `Ctrl+Alt+I` (Windows/Linux) or `Cmd+Alt+I` (Mac) - Insert a snippet

## Settings

- **Storage Type**: Choose between JSON or SQLite storage (`json` or `sqlite`)
- **Storage Path**: Custom path for storing snippets (leave empty for default location)
- **GitHub Gists Integration**:
  - Enable/disable GitHub Gists sync
  - Set your GitHub Personal Access Token
  - Configure auto-sync interval
- **Inline Suggestions**:
  - Enable/disable inline snippet suggestions
  - Configure tag suggestion behavior

## Storage

By default, SnippetSync stores your snippets in:
- Windows: `%APPDATA%\Code\User\globalStorage\snippet-sync\snippets.json` (or `.db`)
- Mac: `~/Library/Application Support/Code/User/globalStorage/snippet-sync/snippets.json` (or `.db`)
- Linux: `~/.config/Code/User/globalStorage/snippet-sync/snippets.json` (or `.db`)

You can change this location in the settings.

## GitHub Gists Sync

To use GitHub Gists sync:

1. Create a [GitHub Personal Access Token](https://github.com/settings/tokens) with the `gist` scope
2. Open Settings and enable GitHub Gists sync
3. Enter your token when prompted
4. Use the "SnippetSync: Sync Snippets" command to sync your snippets

## Usage Tips

- Use tags consistently to organize your snippets
- Create project-specific snippets by using the project name as a tag
- Use the side panel to browse your snippets by category
- When typing code, use `@tagname` to see relevant snippets as you type

## Security

- Your GitHub token is stored securely using VS Code's secret storage
- No data is sent to any third-party servers (except GitHub if you enable Gists sync)
- All snippet data is stored locally on your machine

## License

MIT