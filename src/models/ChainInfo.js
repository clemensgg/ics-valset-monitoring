// src/models/ChainInfo.js

class ChainInfo {
  constructor (chain) {
    this.chainId = chain.chainId
    this.clientIds = []
    this.rpcEndpoint = ''
  }
}

export class ConsumerChainInfo extends ChainInfo {
  constructor (chain) {
    super(chain)
    this.clientIds = [chain.clientId]
    this.rpcEndpoint = chain.rpcEndpoint
  }
}

export class ProviderChainInfo extends ChainInfo {
  constructor (chain) {
    super(chain)
    this.clientIds = chain.clientIds || []
    this.rpcEndpoint = chain.rpcEndpoint
  }
}
