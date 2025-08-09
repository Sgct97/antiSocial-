module.exports = {
  root: true,
  env: { es2021: true, node: true, 'jest/globals': true },
  extends: [
    '@react-native',
    'plugin:@typescript-eslint/recommended',
    'plugin:jest/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'react-native', 'import', 'jest'],
  settings: {
    react: { version: 'detect' },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'import/order': ['warn', { groups: [['builtin', 'external', 'internal']] }],
  },
  ignorePatterns: ['node_modules/', 'dist/', 'build/', 'coverage/'],
};
