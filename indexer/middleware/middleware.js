import axios from 'axios';


  
async function createNewGrafanaApiToken() {
  // const grafanaUrl = 'http://127.0.0.1:3001'; // TEST
  const grafanaUrl = 'http://grafana-icsvalset:3000';
  
  const username = 'admin';
  const password = 'admin';
  const apiEndpoint = `${grafanaUrl}/api/auth/keys`;
  const keyName = "grafana_live_key_199"; // Name your key

  try {
    // Step 1: List existing API keys
    const keysResponse = await axios.get(apiEndpoint, {
      auth: {
        username: username,
        password: password,
      },
    });

    // Step 2: Check for the existence of the key
    const existingKey = keysResponse.data.find(key => key.name === keyName);
    if (existingKey) {
      // Step 3: Delete the existing key
      await axios.delete(`${apiEndpoint}/${existingKey.id}`, {
        auth: {
          username: username,
          password: password,
        },
      });
      console.log(`Existing key '${keyName}' deleted.`);
    }

    // Step 4: Create the new API key
    const data = {
      name: keyName,
      role: "Admin", // Assign a role: Admin, Editor, or Viewer
      // secondsToLive: 3600 // Optional: Time in seconds for the key to be valid (omit or set to 0 for no expiration)
    };

    const response = await axios.post(apiEndpoint, data, {
      auth: {
        username: username,
        password: password,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('API Token created successfully:');
    const apiKey = response.data.key;
    console.log('Key:', apiKey);
    return apiKey; // Return the API key
  } catch (error) {
    if (error.response) {
      console.error('Failed to create API token:', error.response.data);
    } else if (error.request) {
      console.error('Failed to create API token: No response from server', error.request);
    } else {
      console.error('Error', error.message);
    }
    console.error(error.config);
    return null;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkGrafanaHealth(retryCount = 0) {
  try {
    const response = await axios.get(healthCheckUrl);
    console.log('Grafana server status:', response.data.database);
  } catch (error) {
    if (retryCount < 10) {
      console.log(`Grafana server might be down or unreachable. Retrying... Attempt ${retryCount + 1}`);
      await sleep(2000); // wait for 2 seconds before retrying
      checkGrafanaHealth(retryCount + 1);
    } else {
      console.error('Grafana server is down or unreachable after 10 retries. Please check the Grafana server status.');
    }
  }
}

export {
  createNewGrafanaApiToken
};
