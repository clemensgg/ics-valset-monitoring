# ICS Valset Monitoring

Monitor and validator sets on ICS provider- and consumer-chains. Index consensus state date into postgres, display relational data on a grafana dashabord. 

## Prerequisites
- Node.js v18+
- Docker
- PostgreSQL

## Setup

Configure via environment variables:
```bash
export DEPLOYMENT="production"
export PROVIDER_RPC="<PROVIDER-RPC-ENDPOINT>"
export PROVIDER_REST="<PROVIDER-REST-ENDPOINT>"
export SOVEREIGN_REST="<SOVEREIGN_REST-ENDPOINT>"
export CONSUMER_RPCS='["<CONSUMER1-RPC-ENDPOINT>","<CONSUMER2-RPC-ENDPOINT>"]'
export NUM_WORKERS=<NUMBER-OF-INDEXER-WORKERS>
```

Setup only:
```
make setup
```

Config validation:
```
make config-validate
```

Install prerequisites, setup and run:
```
make run
```

### Access Dashboards
- Grafana: http://localhost:3001
