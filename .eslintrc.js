module.exports = {
    extends: [
        '@lcooper/eslint-config-typescript-react',
        '@lcooper/eslint-config-jest',
    ],
    parserOptions: {
        project: 'tsconfig.json',
    },
    settings: {
        'import/resolver': {
            typescript: {
                alwaysTryTypes: true,
                project: 'tsconfig.json',
            },
        },
    },
};