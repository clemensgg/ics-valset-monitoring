// src/models/ChainInfo.js

class ChainInfo {
  constructor (chain, type = null) {
    this.chainId = chain.chainId;
    this.clientIds = [];
    this.rpcEndpoint = '';
    this.type = type; // Add the type attribute
  }
}

export class ConsumerChainInfo extends ChainInfo {
  constructor (chain) {
    super(chain,
      'consumer'); // Set type as 'consumer'
    this.clientIds = [chain.clientId];
    this.rpcEndpoint = chain.rpcEndpoint;
  }
}

export class ProviderChainInfo extends ChainInfo {
  constructor (chain) {
    super(chain,
      'provider'); // Set type as 'provider'
    this.clientIds = chain.clientIds || [];
    this.rpcEndpoint = chain.rpcEndpoint;
  }
}

export class SovereignChainInfo extends ChainInfo {
  constructor (chain) {
    super(chain,
      'sovereign'); // Set type as 'provider'
    this.clientIds = chain.clientIds || [];
    this.rpcEndpoint = chain.rpcEndpoint;
  }
}