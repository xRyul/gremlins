import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.mts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  ...obsidianmd.configs.recommended,
  {
    // Declarative settings require Obsidian 1.13; this plugin supports 1.5+.
    rules: {
      'obsidianmd/settings-tab/prefer-setting-definitions': 'off',
    },
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      'import/no-nodejs-modules': 'off',
      'obsidianmd/no-nodejs-modules': 'off',
    },
  },
  globalIgnores([
    'node_modules',
    'main.js',
    'esbuild.config.mjs',
    'versions.json',
  ]),
);
