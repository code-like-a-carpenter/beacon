'use strict';

/** @type {Partial<import('@jest/types').Config.ProjectConfig>} */
const commonProjectConfig = {
  clearMocks: true,
  // A list of paths to modules that run some code to configure or set up the testing framework before each test
  setupFilesAfterEnv: ['<rootDir>/jest.d/setup-files-after-env/dotenv.ts'],
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/'],
};

exports.commonProjectConfig = commonProjectConfig;
