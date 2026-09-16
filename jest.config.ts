import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
          target: 'es2022',
        },
        module: { type: 'commonjs' },
      },
    ],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coveragePathIgnorePatterns: ['\\.module\\.ts$'],
  moduleNameMapper: {
    // Prisma 7 generates .ts files with ESM-style .js imports (e.g. "./internal/class.js").
    // Jest's CJS resolver doesn't understand this pattern — strip .js so it finds the .ts file.
    '^(\\..+)\\.js$': '$1',
    '^@/(.*)$': '<rootDir>/$1',
    '^@common/(.*)$': '<rootDir>/common/$1',
    '^@core/(.*)$': '<rootDir>/core/$1',
  },
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};

export default config;
