const axios = require('axios');

const METABASE_URL = 'https://YOUR_METABASE_URL';
const API_TOKEN = 'YOUR_API_TOKEN';
const DATABASE_ID = 'YOUR_DATABASE_ID'; // Replace with your database ID

async function createDashboard() {
    // Create a new dashboard with a dark theme
    const dashboardResponse = await axios.post(`${METABASE_URL}/api/dashboard`, {
        name: "Consensus Monitoring Dashboard",
        description: "Dashboard for monitoring consensus state and related data.",
        parameters: [],
        color: "night"
    }, {
        headers: {
            'X-Metabase-Session': API_TOKEN
        }
    });

    const dashboardId = dashboardResponse.data.id;

    // Define the SQL queries for each card
    const cardQueries = [
        "SELECT chainId, timestamp FROM ConsensusState ORDER BY timestamp DESC LIMIT 10;",
        "SELECT DATE(timestamp) as Date, COUNT(*) as 'Number of Entries' FROM ConsensusState GROUP BY DATE(timestamp);",
        "SELECT v.address, v.voting_power, sv.moniker FROM Validator v LEFT JOIN StakingValidator sv ON json_extract(sv.consumer_signing_keys, '$.chainId') = v.consensusAddress WHERE v.chainId = {{chainId}} ORDER BY v.voting_power DESC LIMIT 10;",
        "SELECT v.address, v.voting_power FROM Validator v WHERE v.chainId = {{chainId}} ORDER BY v.voting_power DESC LIMIT 10;",
        "SELECT operator_address, moniker, tokens FROM StakingValidator ORDER BY tokens DESC LIMIT 10;",
        "SELECT DATE(timestamp) as Date, SUM(tokens) as 'Total Tokens Staked' FROM StakingValidator GROUP BY DATE(timestamp);",
        "SELECT type, COUNT(*) as 'Number of Votes' FROM Votes GROUP BY type;"
    ];

    let positionY = 0;

    // Create each card and add it to the dashboard
    for (const query of cardQueries) {
        const cardResponse = await axios.post(`${METABASE_URL}/api/card`, {
            name: "Generated Card",
            dataset_query: {
                type: "native",
                native: {
                    query: query
                },
                database: DATABASE_ID
            }
        }, {
            headers: {
                'X-Metabase-Session': API_TOKEN
            }
        });

        const cardId = cardResponse.data.id;

        await axios.post(`${METABASE_URL}/api/dashboard/${dashboardId}/cards`, {
            cardId: cardId,
            sizeX: 6,
            sizeY: 4,
            row: positionY,
            col: 0
        }, {
            headers: {
                'X-Metabase-Session': API_TOKEN
            }
        });

        positionY += 4;
    }

    console.log(`Dashboard created at ${METABASE_URL}/dashboard/${dashboardId}`);
}

createDashboard();
