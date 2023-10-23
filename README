# ICS Valset Monitoring

Monitor and index validator sets in a blockchain network via Metabase dashboards. 

## Prerequisites
- Node.js v18+
- Docker
- PostgreSQL

## Auto-Setup

### Environment Variables
Set `$MB_USER` and `$MB_PASSWORD` to configure Metabase credentials.

```bash
# Install dependencies and run setup
make setup

# Start the project
make run
```

This will install Docker, Node.js, set up a PostgreSQL database, Metabase, and run the services.

## Manual Setup

### Prerequisites
- [docker.io](https://docs.docker.com/engine/install)
- Node 18 via [nvm (Node Version Manager)](https://github.com/nvm-sh/nvm#installing-and-updating)
- [npm](https://nodejs.org/en/download/package-manager)

### Build and Run Docker Containers
```bash
docker-compose build
docker-compose up
```

### Database and Dashboard Setup
```bash
bash setup_Metabase.sh
```

## Access Dashboards:
- Metabase: http://localhost:3000
- Grafana: http://localhost:3001
