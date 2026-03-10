module.exports = {
  displayName: 'wellesley',
  preset: './jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  coverageDirectory: './coverage/wellesley',
  moduleNameMapper: {
    '@ws/stats-core': '<rootDir>/libs/stats-core/src/index.ts',
    '@ws/data-access': '<rootDir>/libs/data-access/src/index.ts',
    '@ws/shared/ui': '<rootDir>/libs/shared/ui/src/index.ts',
    '@ws/shared/util': '<rootDir>/libs/shared/util/src/index.ts',
  },
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
  snapshotSerializers: ['jest-preset-angular/build/serializers/no-ng-attributes', 'jest-preset-angular/build/serializers/ng-snapshot', 'jest-preset-angular/build/serializers/html-comment'],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.[jt]s?(x)', '<rootDir>/src/**/*(*.)@(spec|test).[jt]s?(x)'],
};
