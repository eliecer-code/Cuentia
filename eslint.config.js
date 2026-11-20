import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'playwright-report/**', 'test-results/**', '.firebase/**', '.impeccable/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.{js,ts,vue}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.serviceworker },
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // Frontera arquitectónica: shared/ nunca importa features/ ni app/
  {
    files: ['src/shared/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/features/*', '@/app/*'], message: 'src/shared/ debe mantenerse agnóstico de features/ y app/.' },
          ],
        },
      ],
    },
  },
  // Frontera arquitectónica: vistas, componentes y composables no importan el SDK Firebase directamente
  {
    files: ['src/features/**/views/**/*.{ts,vue}', 'src/features/**/components/**/*.{ts,vue}', 'src/features/**/composables/**/*.ts', 'src/app/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@/shared/lib/firebase', message: 'Accede a Firebase únicamente desde src/features/*/services/*.service.ts.' },
          ],
          patterns: [
            { group: ['firebase', 'firebase/*'], message: 'Solo src/shared/lib/firebase.ts y src/features/*/services/ pueden importar Firebase.' },
          ],
        },
      ],
    },
  },
)
