# Makefile 

DOCKER := $(shell command -v docker 2> /dev/null)
NODE := $(shell command -v node 2> /dev/null)

install-docker:
ifndef DOCKER
	@echo "Installing Docker..."
	sudo apt-get update
	sudo apt-get install -y docker.io
	sudo usermod -aG docker $$USER
endif

install-node:
ifndef NODE
	@echo "Installing NVM and Node.js..."
	curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
	export NVM_DIR="$$HOME/.nvm"
	[ -s "$$NVM_DIR/nvm.sh" ] && \. "$$NVM_DIR/nvm.sh"
	nvm install 18 --lts
	nvm use 18
endif

install-npm:
	@echo "Installing NPM..."
	npm install -g npm

update-npm:
	@echo "Updating NPM..."
	npm install -g npm@latest

docker-compose:
	@echo "Running Docker Compose..."
	docker-compose build

docker-up:
	@echo "Running Docker Compose Up..."
	docker-compose up

docker-destroy:
	@echo "Destroying containers..."
	docker-compose down

npm-reset-db:
	@echo "Running npm run reset-db in indexer-icsvalset container..."
	docker exec -it indexer-icsvalset npm run reset-db

config-validate:
	@echo "Destroying containers..."
	npm run config-validate

setup: install-docker install-node install-npm update-npm docker-compose
	@echo "Setup complete."

ifeq ($(DOCKER)$(NODE),)
run: setup docker-up
	@echo "Instances Up!"
	@echo "Access Metabase --> http://localhost:3000"
	@echo "Access Grafana --> http://localhost:3001"
else
run: docker-up
	@echo "Instances Up!"
	@echo "Access Metabase --> http://localhost:3000"
	@echo "Access Grafana --> http://localhost:3001"
endif

.PHONY: install-docker install-node install-npm update-npm docker-compose docker-up docker-destroy npm-reset-db setup run
