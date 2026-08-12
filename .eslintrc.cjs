module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // `_` en préfixe = binding volontairement inutilisé : paramètres, mais aussi
    // rest destructuring du type `const { contenu, seanceId: _s, ...rest } = row`.
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-require-imports': 'off',
    '@typescript-eslint/no-unsafe-declaration-merging': 'off',
    'no-console': 'off',
    'no-constant-condition': 'off',
    'no-case-declarations': 'off',
    'no-empty': 'warn',
    'prefer-const': 'warn',
  },
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/', '*.js', '*.cjs', '*.mjs'],
};
