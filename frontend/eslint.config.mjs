import { defineConfig, globalIgnores } from 'eslint/config';
import next from 'eslint-config-next/core-web-vitals';
export default defineConfig([
  ...next,
  globalIgnores(['.next/**', 'node_modules/**', 'next-env.d.ts']),
  { rules: {
    'react/no-unescaped-entities': 'warn',
    'react-hooks/set-state-in-effect': 'warn',
    'react-hooks/refs': 'warn',
    'react-hooks/purity': 'warn',
    'react-hooks/immutability': 'warn',
    'react-hooks/preserve-manual-memoization': 'warn',
  } },
]);
