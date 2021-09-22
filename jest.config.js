const isCI = process.env.CI && (typeof process.env.CI !== 'string' || process.env.CI.toLowerCase() === 'true');

module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    runner: './jest-runner-serial.js',
    coverageReporters: isCI ? ['clover', 'json', 'lcovonly', 'cobertura'] : ['html', 'text'],
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'src/**/*.[jt]s?(x)',
    ],
    testMatch: [
        '**/*.test.[jt]s?(x)',
    ],
    moduleNameMapper: {
        '^@src/(.+)$': '<rootDir>/src/$1',
    },
    setupFilesAfterEnv: [
        '<rootDir>/jest.setup.ts',
    ],
};