module.exports = {
  root: true,
  ignorePatterns: ['dist/'],
  overrides: [
    {
      files: ['src/**/*.{js,jsx}'],
      env: {
        browser: true,
        es2021: true,
      },
      extends: [
        'eslint:recommended',
        'plugin:react/recommended',
        'plugin:react/jsx-runtime',
        'plugin:react-hooks/recommended',
      ],
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      plugins: ['react-refresh'],
      settings: {
        react: {
          version: 'detect',
        },
      },
      rules: {
        'no-undef': 'error',
        'no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
            destructuredArrayIgnorePattern: '^_',
          },
        ],
        'no-empty': ['warn', { allowEmptyCatch: false }],
        'no-constant-condition': 'warn',
        'react/prop-types': 'off',
        'react/no-unescaped-entities': 'warn',
        'react-hooks/exhaustive-deps': 'error',
        'react-refresh/only-export-components': [
          'warn',
          { allowConstantExport: true },
        ],
      },
    },
    {
      files: ['*.config.js'],
      env: {
        es2021: true,
        node: true,
      },
      extends: ['eslint:recommended'],
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  ],
};
