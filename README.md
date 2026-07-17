# Gremlins for Obsidian

Gremlins reveals invisible or easily confused characters in Obsidian's Markdown editor.

![Gremlins highlighting mixed indentation and invisible Unicode characters in Obsidian](images/gremlins-preview.png)

## Features

- Draws a red bar over zero-width and bidirectional control characters.
- Highlights non-breaking spaces, soft hyphens, and similar characters.
- Warns when leading indentation mixes tabs and ordinary spaces.
- Optionally highlights curly quotation marks and en dashes.
- Shows a bug icon beside every visible line containing a gremlin.
- Describes the character, Unicode code point, and severity on hover.
- Provides **Gremlins: Inspect current gremlin** for keyboard and touch use.

The plugin works in Source mode and Live Preview. Typographic punctuation is disabled by default because it is common and valid in prose.

## Inspiration

This plugin is independently implemented for Obsidian and inspired by [Gremlins tracker for Visual Studio Code](https://github.com/nhoizey/vscode-gremlins), released under the MIT License by Nicolas Hoizey.
