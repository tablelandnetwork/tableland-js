module.exports = {
  env: {
    es2021: true,
  },
  settings: {
    node: {
      tryExtensions: [".js", ".json", ".node", ".ts", ".d.ts"],
    },
  },
  globals: {
    // mocha
    before: true,
    after: true,
    beforeEach: true,
    afterEach: true,
    describe: true,
    it: true
  },
  extends: [
    "standard",
    "plugin:prettier/recommended",
    "plugin:node/recommended",
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    "node/no-unpublished-import": "off",
    "node/no-missing-import": "off", // TODO: If available, find solution to turn this lint rule back on
    "node/no-unsupported-features/es-syntax": [
      "error",
      { ignores: ["modules"] },
    ],
    "node/shebang": "off",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "error",
  },
};
