module.exports = {
  rules: {
    'react/prop-types': 'off'
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    '@electron-toolkit',
    'react/prop-types'
    // '@electron-toolkit/eslint-config-prettier'
  ]
}
