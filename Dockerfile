# Set node version
FROM node:18 

# Set workdir
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the current directory contents into the container
COPY src/ ./src/
COPY indexer/ ./indexer/

# Launch indexer
CMD npm run indexer