const base = {
  testEnvironment: "node",
  transform: {
    "^.+\\.[jt]sx?$": [
      "babel-jest",
      {
        presets: [
          ["@babel/preset-env", { targets: { node: "current" } }],
          "@babel/preset-typescript",
        ],
      },
    ],
  },
  transformIgnorePatterns: ["/node_modules/(?!jose/)"],
  moduleNameMapper: { "^jose$": "<rootDir>/server/src/tests/jose.mock.js" },
};

module.exports = {
  projects: [
    {
      ...base,
      displayName: "oidc-discovery-on",
      testMatch: ["**/oidc-discovery-on.test.js"],
      setupFiles: ["<rootDir>/server/src/tests/env.discovery-on.js"],
    },
    {
      ...base,
      displayName: "oidc-discovery-off",
      testMatch: ["**/oidc-discovery-off.test.js"],
      setupFiles: ["<rootDir>/server/src/tests/env.discovery-off.js"],
    },
    {
      ...base,
      displayName: "unit",
      testMatch: ["**/__tests__/*.spec.js"],
    },
    {
      ...base,
      displayName: "api",
      testMatch: ["**/__tests__/sso-roles-permissions.test.js"],
      moduleNameMapper: { "^jose$": "<rootDir>/server/src/tests/jose.mock.js" },
    },
  ],
};
