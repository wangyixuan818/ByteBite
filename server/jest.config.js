module.exports = {
   testEnvironment: 'node',
   setupFiles: ['<rootDir>/__tests__/setup.js'],
   testMatch: ['**/__tests__/unit/**/*.test.js', '**/__tests__/integration/**/*.test.js'],
   testPathIgnorePatterns: ['/node_modules/', '/__tests__/setup.js', '/__tests__/helpers/'],
   maxWorkers: 1, // run test files one at a time --> cuz there's only one db
}

