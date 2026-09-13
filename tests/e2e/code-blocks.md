# Code-block repair: manual Obsidian checks

Build with `npm ci`, `npm run lint`, and `npm run build`. Install the generated plugin files into a test vault, then reload Gremlins. Enable **Gutter icons** and **Click gutter icons to fix**.

Use a Markdown note with two fenced Python code blocks and a paragraph between them. Paste several actual U+00A0 characters into the indentation of each block and into the paragraph. Include enough lines in the first block to extend below the viewport.

1. In Source mode, check that both opening fences have a larger bug button, while affected content lines retain their original smaller icons.
2. Hover the larger button. It should show one Obsidian tooltip and no browser-native title tooltip.
3. Click the first block's button. All its U+00A0 characters should become ordinary spaces, preserving indentation width. The paragraph and second block should remain unchanged.
4. Watch the visible line icons explode in sequence. Off-screen lines should also be fixed without forced scrolling.
5. Undo once. The entire first block, its highlights, and its larger button should return. Check redo as well.
6. Click a small icon. Only that line should be fixed, using the original explosion animation.
7. Focus a larger button using Tab. Check both Enter and Space activation.
8. Start a block repair, then scroll, resize, edit, undo, or close the note before the animation finishes. No temporary icons or explosions should remain.
9. Repeat with the OS reduced-motion preference enabled. Repairs should still work without animation.
10. Disable **Click gutter icons to fix**, then **Gutter icons**. The bulk button should not be available in either disabled state.
11. Repeat in Live Preview, in light and dark themes, with a narrow pane, and in an Obsidian pop-out window.

Also test a clean block (no bulk button), a tilde fence, a longer fence containing shorter fences, a blockquote, an unfinished fence at the end of the note, and mixed tabs/spaces. Optional typographic punctuation should only be fixed when its setting is enabled.
