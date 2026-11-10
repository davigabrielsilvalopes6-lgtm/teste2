import js from '@eslint/js';
import html from 'eslint-plugin-html';
import globals from 'globals';

// Correctness rules only. Prettier owns formatting, so no stylistic ESLint preset
// or automatic fixes are applied to the existing game.
const rules = {
  ...js.configs.recommended.rules,
  'no-unused-vars': ['warn', { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none' }],
  // Existing storage fallbacks intentionally catch access/quota errors.
  'no-empty': ['error', { allowEmptyCatch: true }],
};

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.git/**',
      'playwright-report/**',
      'test-results/**',
      'blob-report/**',
      'playwright/.cache/**',
    ],
  },
  {
    name: 'node-commonjs',
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: globals.node },
    rules,
  },
  {
    name: 'node-esm-config',
    files: ['**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
    rules,
  },
  {
    name: 'browser-inline-javascript',
    files: ['**/*.html'],
    plugins: { html },
    languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: globals.browser },
    rules,
  },
  {
    name: 'playwright-browser-callbacks',
    files: ['tests/e2e/**/*.js'],
    // The files run in Node, but page.evaluate callbacks run in the browser.
    // Read-only game globals are allowed here only, not in Node infrastructure.
    languageOptions: {
      globals: {
        ...globals.browser,
        ...Object.fromEntries(
          [
            'G',
            'busy',
            'blocked',
            'ctx',
            'cv',
            'TC',
            'W0',
            'A',
            'TS',
            'RS',
            'CS',
            'RD',
            'SH',
            'mapOpen',
            'zi',
            'dbg',
            'inventoryOpen',
            'craftingOpen',
            'performCraft',
            'addItems',
            'inventoryChanged',
            'inventoryTotals',
            'resourceBase',
            'resourcePathClear',
            'pickResource',
            'draw',
            'T',
            'RESOURCE_TYPES',
            'activeTool',
            'toolFacing',
            'drawHeldTool',
            'chestOpen',
            'openChestId',
            'canPlaceStorageChest',
            'storageAccessCheck',
            'nearestStorageChest',
            'storagePreviewState',
            'beginCombatAttack',
            'activeWeapon',
            'applyPlayerDamage',
            'updateCombat',
            'combatDirection',
            'resetTrainingTargets',
            'recoverTrainingPlayer',
            'serializeCombat',
            'placeStorageChest',
            'PLAYER_ASSETS',
            'PLAYER_ATLAS',
            'appearanceOpen',
            'loadPlayerAsset',
            'defaultAppearance',
            'validAppearance',
            'serializeAppearance',
            'avatarFrame',
            'drawAppearance',
          ].map((name) => [name, 'readonly']),
        ),
      },
    },
  },
];
