/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        target: 'ES2020',
        module: 'CommonJS',
        esModuleInterop: true,
        skipLibCheck: true,
      }
    }]
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  verbose: true,
};
