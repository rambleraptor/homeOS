import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      // Disable Vite-specific rule that's not available in Next.js
      'react-refresh/only-export-components': 'off',
      // Allow unescaped entities in JSX for readability
      'react/no-unescaped-entities': 'off',
      // Allow img elements for dynamic images from PocketBase
      '@next/next/no-img-element': 'off',
      // Disable display-name requirement
      'react/display-name': 'off',
    },
  },
];

export default eslintConfig;
