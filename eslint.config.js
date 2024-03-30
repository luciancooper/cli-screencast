const base = require('@lcooper/eslint-config-typescript'),
    react = require('@lcooper/eslint-config-typescript-react'),
    jest = require('@lcooper/eslint-config-jest');

module.exports = [
    { ignores: ['lib/**', 'coverage/**'] },
    ...base,
    {
        languageOptions: {
            parserOptions: {
                project: 'tsconfig.json',
                tsconfigRootDir: __dirname,
            },
        },
        settings: {
            'import/resolver': {
                typescript: {
                    project: 'tsconfig.json',
                },
            },
        },
        rules: {
            '@typescript-eslint/prefer-nullish-coalescing': 0,
        },
    },
    react,
    { rules: { 'react/require-default-props': 0 } },
    jest,
];