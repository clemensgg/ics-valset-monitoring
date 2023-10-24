# Makefile

DOCKER := $(shell command -v docker 2> /dev/null)
NODE := $(shell command -v node 2> /dev/null)
API_URL="http://localhost:3000"

install-docker:
ifndef DOCKER
	@echo "Installing Docker..."
	sudo apt update
	sudo apt install -y docker.io docker-compose jq
	sudo usermod -aG docker $$USER
endif

install-npm:
	@echo "Installing NPM..."
	sudo apt install -y npm

install-node:
ifndef NODE
	@echo "Installing NVM and Node.js..."
	curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
	export NVM_DIR="$$HOME/.nvm" ;\
	[ -s "$$NVM_DIR/nvm.sh" ] && \. "$$NVM_DIR/nvm.sh" ;\
	nvm install 18 --lts ;\
	nvm use 18
endif

docker-compose:
	@echo "Running Docker Compose..."
	docker-compose build

docker-up:
	@echo "Running Docker Compose Up..."
	docker-compose up -d

wait-for-containers:
	@echo "Waiting for Docker containers to be up..."
	@while [ "$$(docker-compose ps | awk '/Up/ {print $$0}' | wc -l)" -ne 4 ]; do \
		sleep 5; \
	done
	@echo "--- Setup complete! ---"
	@echo "Create Admin user for Metabase: http://localhost:3000" and run ./setup_Metabase.sh afterwards to complete setup.
	@echo "Grafana Access: http://localhost:3001"

docker-destroy:
	@echo "Destroying containers..."
	docker-compose down

npm-reset-db:
	@echo "Running npm run reset-db in indexer-icsvalset container..."
	docker exec -it indexer-icsvalset npm run reset-db

config-validate:
	@echo "Validating configuration..."
	npm run config-validate

run: install-docker install-npm install-node docker-compose docker-up wait-for-containers

.PHONY: install-docker install-node install-npm docker-compose docker-up docker-destroy npm-reset-db config-validate setup run


