

https://github.com/user-attachments/assets/809503f0-1a39-4567-91f3-258359d5f146

# Gremlins for Obsidian

Gremlins reveals invisible or easily confused characters in Obsidian's Markdown editor.

![Gremlins highlighting mixed indentation and invisible Unicode characters in Obsidian](images/gremlins-preview.png)

## Features

- Draws a red bar over zero-width and bidirectional control characters.
- Highlights non-breaking spaces, soft hyphens, and similar characters.
- Warns when leading indentation mixes tabs and ordinary spaces.
- Optionally highlights curly quotation marks and en dashes.
- Shows a bug icon beside every visible line containing a gremlin.
- Optionally fixes every gremlin on a line by selecting its bug icon.
- Describes the character, Unicode code point, and severity on hover.
- Provides **Gremlins: Inspect current gremlin** and **Gremlins: Fix current line** for keyboard and touch use.

The plugin works in Source mode and Live Preview. Typographic punctuation and click-to-fix are disabled by default because prose punctuation can be valid and text replacement should be opt-in. Click-to-fix normalizes spacing and punctuation, removes flagged invisible controls, and clears every gremlin from the selected line.

## Inspiration

This plugin is independently implemented for Obsidian and inspired by [Gremlins tracker for Visual Studio Code](https://github.com/nhoizey/vscode-gremlins), released under the MIT License by Nicolas Hoizey.
