import { validateCONFIG } from './configValidate.js';

let CONFIG;

export async function loadConfig() {
  if (CONFIG) {
    return CONFIG;
  }

  const DEPLOYMENT = process.env.DEPLOYMENT ?? 'test';
  let configModule;

  try {
    if (DEPLOYMENT === 'production') {
      configModule = await import('./config.js');
    } else {
      configModule = await import('./config_test.js');
    }
    CONFIG = configModule.CONFIG;

    // Validate Config
    try {
        const validatedConfig = validateCONFIG(CONFIG);
        CONFIG = validatedConfig;
    } catch (error) {
        throw (error.message);
    }

    global.CONFIG = CONFIG;
    console.log('>>> Loaded config for deployment mode: ' + DEPLOYMENT)
    console.log(`Config valid!`);
  } catch (err) {
    console.error(`Failed to load ${DEPLOYMENT} config:`, err);
    throw err;
  }
}