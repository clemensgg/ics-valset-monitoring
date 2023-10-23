#!/bin/bash

API_URL="http://localhost:3000"
MB_USER=$MB_USER
MB_PWD=$MB_PWD

#!/bin/bash

echo "--> Obtaining Metabase session ID..."
SESSION_ID=$(curl -s -X POST "$API_URL/api/session" \
	-H "Content-Type: application/json" \
	-d "{\"username\": \"$MB_USER\", \"password\": \"$MB_PWD\"}" | jq -r '.id')

echo "--> Adding PostgreSQL database to Metabase..."
curl -s -X POST "$API_URL/api/database" \
	-H "Content-Type: application/json" \
	-H "X-Metabase-Session: $SESSION_ID" \
	-d '{
		"engine": "postgres",
		"name": "prod",
		"details": {
			"host": "postgres-icsvalset",
			"port": 5432,
			"user": "monitoring",
			"password": "monitoring",
			"dbname": "icsValsetMonitoring"
		},
		"is_full_sync": true,
		"is_on_demand": false
	}'

echo ""
echo "--> Creating Metabase Collection 'ics-valset-monitoring-PROD'..."
curl -s -X POST "$API_URL/api/collection" \
	-H "Content-Type: application/json" \
	-H "X-Metabase-Session: $SESSION_ID" \
	-d '{
		"name": "ics-valset-monitoring-PROD",
		"color": "#509EE3",
		"description": "ICS Valset Monitoring PROD collection"
	}'

echo ""
echo "--> Deploying Cards..."
cat cards.json | jq -c '.[]' | while read -r card; do
    curl -s -X POST "$API_URL/api/card" \
      -H "Content-Type: application/json" \
      -H "X-Metabase-Session: $SESSION_ID" \
      -d "$card" 
done

echo ""
echo "--> Deploying Dashboard..."
curl -s -X POST "$API_URL/api/dashboard" \
    -H "Content-Type: application/json" \
    -H "X-Metabase-Session: $SESSION_ID" \
    --data-binary "@dashboard.json"

echo ""
echo "Disabling Dashboard Caching..."
curl -X PUT "$API_URL/api/dashboard/1" \
	-H "Content-Type: application/json" \
	-H "X-Metabase-Session: $SESSION_ID" \
	-d '{"cache_ttl": null}'

echo ""
echo "--- Metabase Setup Complete! ---"