// Config ESLint du front.
//
// `next/core-web-vitals` apporte les règles React / react-hooks / jsx-a11y / Next
// que le seul `.eslintrc.cjs` racine ne couvrait pas (le front tournait jusqu'ici
// sur les règles TypeScript de base uniquement). On y réaligne les réglages
// TypeScript du monorepo pour que le comportement reste identique d'un workspace
// à l'autre.
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['next/core-web-vitals', 'plugin:@typescript-eslint/recommended'],
  rules: {
    // Identique à la racine : `_` en préfixe = binding volontairement inutilisé.
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    'prefer-const': 'warn',
    'no-empty': 'warn',

    // `next/image` n'apporterait rien ici : `images.unoptimized: true` est activé
    // dans next.config.js, l'optimiseur est donc désactivé pour tout le projet.
    // Les `<img>` restants pointent vers des logos distants (AN, Sénat, HATVP) ou
    // un SVG local, et passer par l'optimiseur augmenterait l'egress Railway —
    // exactement ce que cette branche cherche à réduire.
    '@next/next/no-img-element': 'off',
  },
};
