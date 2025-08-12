// Load env vars from .env for Expo Go runtime
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

// Helpful visibility: print whether the token is present (not the value)
if (process.env.EXPO_PUBLIC_LLM_TOKEN) {
  // eslint-disable-next-line no-console
  console.log('env: export EXPO_PUBLIC_LLM_TOKEN');
} else {
  // eslint-disable-next-line no-console
  console.log('env: missing EXPO_PUBLIC_LLM_TOKEN');
}

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra || {}),
    llmUrl: process.env.EXPO_PUBLIC_LLM_URL || (config.extra && config.extra.llmUrl),
    llmModel: process.env.EXPO_PUBLIC_LLM_MODEL || (config.extra && config.extra.llmModel),
    llmToken: process.env.EXPO_PUBLIC_LLM_TOKEN || (config.extra && config.extra.llmToken),
  },
});
