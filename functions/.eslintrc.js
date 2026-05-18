module.exports = {
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    "ecmaVersion": 2020,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "warn",
    "quotes": ["warn", "double", {"allowTemplateLiterals": true}],
    // Relax certain stylistic rules to accommodate cross-platform line endings and long generated lines
    "linebreak-style": 0,
    "comma-dangle": 0,
    "max-len": 0,
    "require-jsdoc": 0,
    "valid-jsdoc": 0,
    "indent": 0,
    "operator-linebreak": 0,
    "arrow-parens": 0,
    "no-multi-spaces": 0,
    "no-useless-escape": 0,
    "no-unused-vars": ["warn", {"argsIgnorePattern": "^_", "varsIgnorePattern": "^_"}],
    "eol-last": 0,
    "no-trailing-spaces": 0,
  },
  overrides: [
    {
      files: ["**/*.spec.*"],
      env: {
        mocha: true,
      },
      rules: {},
    },
  ],
  globals: {},
};
