// src/utils/utils.js

import axios from 'axios';
import bech32 from 'bech32';
import crypto from 'crypto';

import { interchain_security } from 'interchain-security';

import { ConsensusState } from '../models/ConsensusState.js';
import { ConsensusValidators } from '../models/ConsensusValidators.js';
import { ConsumerChainInfo } from '../models/ConsumerChainInfo.js';

async function getConsensusState(rpcUrl) {
    const response = await axios.get(`${rpcUrl}/dump_consensus_state`);
    return response.data;
}

async function getConsensusValidators(rpcUrl) {
    const response = await axios.get(`${rpcUrl}/validators`);
    return response.data;
}

function orderByVotingPower(consensusValidatorsData) {
    const consensusValidators = new ConsensusValidators(consensusValidatorsData);
    return consensusValidators.validators.sort((a, b) => parseInt(b.voting_power) - parseInt(a.voting_power));
}

async function getConsumerChainInfos(providerRpcUrl) {
    const icsClient = await interchain_security.ClientFactory.createRPCQueryClient({ rpcEndpoint: providerRpcUrl });
    let consumerChainIds;
    try {
        consumerChainIds = await icsClient.interchain_security.ccv.provider.v1.queryConsumerChains();
    } catch (e) {
        console.error(e);
        return [];
    }
    console.log('registered consumer chains: ' + JSON.stringify(consumerChainIds));

    return consumerChainIds.map(id => new ConsumerChainInfo(id));
}

async function validateConsumerRpcs(providerRpcUrl, consumerRpcEndpoints) {
    const consumerChainInfos = await getConsumerChainInfos(providerRpcUrl);
    const chainIdsFromRpcs = await Promise.all(consumerRpcEndpoints.map(getChainIdFromRpc));

    for (let i = 0; i < consumerRpcEndpoints.length; i++) {
        const chainId = chainIdsFromRpcs[i];
        const matchingChainInfo = consumerChainInfos.find(info => info.chainId === chainId);
        if (matchingChainInfo) {
            matchingChainInfo.rpcEndpoint = consumerRpcEndpoints[i];
        } else {
            console.warn(`No matching chain found for RPC endpoint ${consumerRpcEndpoints[i]}`);
        }
    }

    // Check if there are any consumer chains without RPC endpoints
    const chainsWithoutRpc = consumerChainInfos.filter(info => !info.rpcEndpoint);
    if (chainsWithoutRpc.length > 0) {
        console.warn(`No RPC endpoints provided for chains: ${chainsWithoutRpc.map(info => info.chainId).join(', ')}`);
    }

    return consumerChainInfos;
}

function mergeValidatorData(consensusStateData, consensusValidatorsData) {
    const consensusState = new ConsensusState(consensusStateData);
    const consensusValidators = new ConsensusValidators(consensusValidatorsData);

    return consensusValidators.validators.map(validator => {
        const matchingValidator = consensusState.validators.find(v => v.address === validator.address);
        return {
            ...validator,
            ...matchingValidator
        };
    });
}

function pubKeyToValcons(pubkey, prefix) {
    const consensusPubkeyBytes = Buffer.from(pubkey, 'base64');
    const sha256Hash = crypto.createHash('sha256').update(consensusPubkeyBytes).digest();
    const addressBytes = sha256Hash.slice(0, 20);
    const valconsAddress = bech32.bech32.encode(prefix + 'valcons', bech32.bech32.toWords(addressBytes));
    return valconsAddress;
}

async function matchValidators(stakingValidators, consensusValidators, providerRpcUrl, chainId, prefix) {
    const matchedValidators = [];

    for (const stakingValidator of stakingValidators) {
        const valconsAddress = pubKeyToValcons(stakingValidator.consensus_pubkey.key, prefix);
        const consumerValcons = await getValconsForValidator(providerRpcUrl, chainId, valconsAddress);

        const matchingConsensusValidator = consensusValidators.find(v => v.pub_key.value === consumerValcons);
        if (matchingConsensusValidator) {
            matchedValidators.push({
                stakingValidator,
                consensusValidator: matchingConsensusValidator
            });
        }
    }

    return matchedValidators;
}

async function getChainIdFromRpc(rpcEndpoint) {
    try {
        const response = await axios.get(`${rpcEndpoint}/status`);
        return response.data.result.node_info.network;
    } catch (error) {
        console.error(`Error fetching status from ${rpcEndpoint}: ${error.message}`);
        return null;
    }
}

async function getValconsForValidator(providerRpcUrl, chainId, valconsAddress) {
    try {
        const icsClient = await interchain_security.ClientFactory.createRPCQueryClient({
            rpcEndpoint: providerRpcUrl
        });
        const consumerSigningKey = await icsClient.interchain_security.ccv.provider.v1.queryValidatorConsumerAddr({
            chainId: chainId,
            providerAddress: valconsAddress
        });
        return consumerSigningKey.consumerAddress || valconsAddress;
    } catch (error) {
        console.error(`Error fetching valcons for validator ${valconsAddress} on chain ${chainId}: ${error.message}`);
        return valconsAddress; // Default to the provider's valcons if there's an error
    }
}

export {
    getConsensusState,
    getConsensusValidators,
    orderByVotingPower,
    getConsumerChainInfos,
    validateConsumerRpcs,
    mergeValidatorData,
    pubKeyToValcons,
    matchValidators
};
