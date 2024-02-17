import axios from 'axios';

async function createGrafanaApiToken() {
  const grafanaUrl = 'http://172.19.0.3:3000';
  const username = 'admin';
  const password = 'admin';
  const apiEndpoint = `${grafanaUrl}/api/auth/keys`;

  const data = {
    name: "grafana_live_key_199", // Name your key
    role: "Admin", // Assign a role: Admin, Editor, or Viewer
    // secondsToLive: 3600 // Optional: Time in seconds for the key to be valid (omit or set to 0 for no expiration)
  };

  try {
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
  createGrafanaApiToken
};
