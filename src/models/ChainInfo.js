// src/models/ChainInfo.js

export class ConsumerChainInfo {
    constructor(chain) {
        this.chainId = chain.chainId;
        this.clientId = chain.clientId;
        this.rpcEndpoint = "";
    }
}

export class ProviderChainInfo {
    constructor(chain) {
        this.chainId = chain.chainId;
        this.clientIds = [];
        this.rpcEndpoint = chain.rpcEndpoint;
    }
}