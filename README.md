# ICS Consensus Monitoring

Monitor consensus of ICS provider- and consumer-chains. Index consensus state date into postgres, display relational data on a grafana dashabord. 

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

## License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.

## Contributing

We welcome contributions from the community. Here are some ways you can contribute:

1. Report Issues: If you find bugs or issues, please create an issue explaining the problem and any steps to reproduce it.
2. Feature Requests: You can also create an issue for any feature or enhancement requests.
3. Submit Pull Requests: If you've fixed a bug or developed a new feature, feel free to submit a pull request. Please ensure your code adheres to existing style guidelines and all tests pass.
4. Documentation: Improvements to the documentation, tutorials, and examples are always welcome.

Please read our [CONTRIBUTING.md](CONTRIBUTING.md) for more details on our code of conduct and development process.
