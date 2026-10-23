/** Headless unit tests via jest-preset-angular (no browser required). */
module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  testEnvironmentOptions: { pretendToBeVisual: true },
};
