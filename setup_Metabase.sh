#!/bin/bash

API_URL="http://localhost:3000"
MB_USER=$MB_USER
MB_PASSWORD=$MB_PASSWORD

#!/bin/bash

echo "Obtaining Metabase session ID..."
SESSION_ID=$(curl -s -X POST "$API_URL/api/session" \
	-H "Content-Type: application/json" \
	-d "{\"username\": \"$MB_USER\", \"password\": \"$MB_PASSWORD\"}" | jq -r '.id')

echo "Adding PostgreSQL database to Metabase..."
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
			"dbname": "prod"
		},
		"is_full_sync": true,
		"is_on_demand": false
	}'

echo "Setting up Metabase Dashboard..."
curl -s -X POST "$API_URL/api/dashboard" \
	-H "Content-Type: application/json" \
	-H "X-Metabase-Session: $SESSION_ID" \
	-d @./metabase_dashboard.json

echo "Disabling Dashboard Caching..."
curl -X PUT "$API_URL/api/dashboard/1" \
	-H "Content-Type: application/json" \
	-H "X-Metabase-Session: $SESSION_ID" \
	-d '{"cache_ttl": null}'

echo "--- Metabase Setup Complete! ---"