// src/utils/utils.js

import crypto from 'crypto';

import axios from 'axios';
import bech32 from 'bech32';
import {
  interchain_security
} from 'interchain-security';

import { ConsumerChainInfo, ProviderChainInfo } from '../../src/models/ChainInfo.js';
import { ConsensusState } from '../../src/models/ConsensusState.js';
import { StakingValidators } from '../../src/models/StakingValidators.js';

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve,
    ms));
}

async function getConsensusState (rpcUrl, chainId) {
  try {
    const url = `${rpcUrl}/dump_consensus_state`;
    console.log('Making request to:',
      url);

    const response = await axios.get(url);

    console.log('Received response:',
      response.status,
      response.statusText);
    if (response.data && response.data.result) {
      console.log('Response data:',
        response.data.result);
    } else {
      console.log('Unexpected response structure:',
        response.data);
    }
    return new ConsensusState(response.data.result,
      chainId);
  } catch (error) {
    console.error(`Error fetching consensus state from ${rpcUrl}: ${error.message}`);
    return null;
  }
}

function orderByVotingPower (validators) {
  return validators.sort((a, b) => parseInt(b.voting_power) - parseInt(a.voting_power));
}

function pubKeyToValcons (pubkey, prefix) {
  const consensusPubkeyBytes = Buffer.from(pubkey,
    'base64');
  const sha256Hash = crypto.createHash('sha256').update(consensusPubkeyBytes).digest();
  const addressBytes = sha256Hash.slice(0,
    20);
  const valconsAddress = bech32.bech32.encode(prefix + 'valcons',
    bech32.bech32.toWords(addressBytes));
  return valconsAddress;
}

/*
async function getConsensusValidators (rpcUrl) {
  let validators = [];
  let fetchedCount = 0;
  let totalCount = null;
  let offset = 0;
  const limit = 30;

  try {
    do {
      const url = `${rpcUrl}/validators?limit=${limit}&offset=${offset}`;
      console.log('Fetching URL:', url);
      const response = await axios.get(url);
      const consensusValidators = new ConsensusValidators(response.data);
      validators = validators.concat(consensusValidators.result.validators);

      fetchedCount += parseInt(response.data.result.count, 10);
      totalCount = parseInt(response.data.result.total, 10);
      offset += limit;
    } while (fetchedCount < totalCount);
  } catch (error) {
    console.error(`Error fetching consensus validators from ${rpcUrl}: ${error.message}`);
  }

  return validators;
}
*/

async function getStakingValidators (restUrl) {
  let validators = [];
  let nextKey = null;
  try {
    do {
      const url = `${restUrl}/cosmos/staking/v1beta1/validators?limit=100${nextKey ? `&pagination.key=${encodeURIComponent(nextKey)}` : ''}`;
      const response = await axios.get(url);
      const stakingValidators = new StakingValidators(response.data.validators);
      validators = validators.concat(stakingValidators.validators);
      if (response.data.pagination && response.data.pagination.next_key) {
        nextKey = response.data.pagination.next_key;
      } else {
        break;
      }
    } while (nextKey);
  } catch (error) {
    console.error(`Error fetching validators from ${restUrl}: ${error.message}`);
  }
  console.log(`fetched ${validators.length} validator infos from provider chain`);
  return validators;
}

async function getProviderChainInfos (providerRpcEndpoint) {
  const chain = {
    chainId: await getChainIdFromRpc(providerRpcEndpoint),
    rpcEndpoint: providerRpcEndpoint,
    clients: []
  };
  const providerChainInfos = new ProviderChainInfo(chain);
  console.log('fetched providerChainInfos: ' + JSON.stringify(providerChainInfos));
  return providerChainInfos;
}

async function getConsumerChainInfos (providerRpcEndpoint) {
  const icsClient = await interchain_security.ClientFactory.createRPCQueryClient({ rpcEndpoint: providerRpcEndpoint });
  let consumerChains;
  try {
    consumerChains = await icsClient.interchain_security.ccv.provider.v1.queryConsumerChains();
  } catch (e) {
    console.error(e);
    return [];
  }
  return consumerChains.chains.map(chain => new ConsumerChainInfo(chain));
}

async function validateConsumerRpcs (providerRpcEndpoint, consumerRpcEndpoints) {
  const consumerChainInfos = await getConsumerChainInfos(providerRpcEndpoint);
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
    console.warn(`WARN: No RPC endpoints provided for chains: ${chainsWithoutRpc.map(info => info.chainId).join(', ')}`);
  }

  console.log('fetched consumer chains: ' + JSON.stringify(consumerChainInfos));
  return consumerChainInfos;
}

/*

async function matchValidators(stakingValidators, consensusValidators, providerRpcEndpoint, chainIds, prefix) {
    const matchedValidators = [];

    console.log(`Total stakingValidators: ${stakingValidators.length}`);
    console.log(`Total consensusValidators: ${consensusValidators.length}`);

    for (let i = 0; i < stakingValidators.length; i++) {
        const stakingValidator = stakingValidators[i];
        stakingValidator.consumerKeys = {};

        console.log(`Processing stakingValidator ${i + 1}/${stakingValidators.length} with address: ${stakingValidator.operator_address}`);

        for (const chainId of chainIds) {
            const valconsAddress = pubKeyToValcons(stakingValidator.consensus_pubkey.key, prefix);
            const consumerSigningKey = await getValconsForValidator(providerRpcEndpoint, chainId, valconsAddress);

            stakingValidator.consumerKeys[chainId] = consumerSigningKey;
        }
    }

    for (let j = 0; j < consensusValidators.length; j++) {
        const consensusValidator = consensusValidators[j];
        const valcons = pubKeyToValcons(consensusValidator.pub_key.value, prefix);

        console.log(`Processing consensusValidator ${j + 1}/${consensusValidators.length} with pubkey: ${consensusValidator.pub_key.value}`);

        const matchingStakingValidator = stakingValidators.find(sv => Object.values(sv.consumerKeys).includes(valcons));
        if (matchingStakingValidator) {
            matchedValidators.push({
                stakingValidator: matchingStakingValidator,
                consensusValidator: consensusValidator
            });

            console.log(`Matched stakingValidator with address ${matchingStakingValidator.operator_address} to consensusValidator with pubkey ${consensusValidator.pub_key.value}`);
        }
    }

    console.log(`Total matched validators: ${matchedValidators.length}`);
    return matchedValidators;
} */

async function matchConsensusValidators (stakingValidators, consensusState, chainId, type, prefix) {
  const matchedValidators = [];

  for (let j = 0; j < consensusState.round_state.validators.validators.length; j++) {
    const consensusValidator = consensusState.round_state.validators.validators[j];
    const consensusValidatorValcons = pubKeyToValcons(consensusValidator.pub_key.value,
      prefix);

    let matchingStakingValidator;
    if (type === 'consumer') {
      stakingValidators.forEach(v => {
        const consumerSigningKeysValues = v.consumer_signing_keys[chainId];
        if (consumerSigningKeysValues.includes(consensusValidatorValcons)) {
          matchingStakingValidator = v;
        }
      });
    } else {
      stakingValidators.forEach(v => {
        const pubKeyValcons = pubKeyToValcons(v.consensus_pubkey.key,
          prefix);
        if (pubKeyValcons.includes(consensusValidatorValcons)) {
          matchingStakingValidator = v;
        }
      });
    }

    if (matchingStakingValidator) {
      matchedValidators.push({
        stakingValidator: matchingStakingValidator,
        consensusValidator
      });
    }
  }

  console.log(`Total matched consensusValidators: ${matchedValidators.length}`);
  return matchedValidators;
}

async function matchConsensusLastValidators (stakingValidators, consensusState, chainId, type, prefix) {
  const matchedValidators = [];

  console.log(`Total stakingValidators: ${stakingValidators.length}`);
  console.log(`Total consensusLastValidators: ${consensusState.round_state.last_validators.validators.length}`);

  for (let j = 0; j < consensusState.round_state.last_validators.validators.length; j++) {
    const consensusValidator = consensusState.round_state.last_validators.validators[j];
    const consensusValidatorValcons = pubKeyToValcons(consensusValidator.pub_key.value,
      prefix);

    let matchingStakingValidator;
    if (type === 'consumer') {
      stakingValidators.forEach(v => {
        const consumerSigningKeysValues = v.consumer_signing_keys[chainId];
        if (consumerSigningKeysValues.includes(consensusValidatorValcons)) {
          matchingStakingValidator = v;
        }
      });
    } else {
      stakingValidators.forEach(v => {
        const pubKeyValcons = pubKeyToValcons(v.consensus_pubkey.key,
          prefix);
        if (pubKeyValcons.includes(consensusValidatorValcons)) {
          matchingStakingValidator = v;
        }
      });
    }

    if (matchingStakingValidator) {
      matchedValidators.push({
        stakingValidator: matchingStakingValidator,
        consensusValidator
      });
    }
  }

  console.log(`Total matched consensusLastValidators: ${matchedValidators.length}`);
  return matchedValidators;
}

async function getChainIdFromRpc (rpcEndpoint) {
  try {
    const response = await axios.get(`${rpcEndpoint}/status`);
    return response.data.result.node_info.network;
  } catch (error) {
    console.error(`Error fetching status from ${rpcEndpoint}: ${error.message}`);
    return null;
  }
}

async function getValconsForValidator (providerRpcEndpoint, chainId, valconsAddress) {
  try {
    const icsClient = await interchain_security.ClientFactory.createRPCQueryClient({
      rpcEndpoint: providerRpcEndpoint
    });
    const consumerSigningKey = await icsClient.interchain_security.ccv.provider.v1.queryValidatorConsumerAddr({
      chainId,
      providerAddress: valconsAddress
    });

    return consumerSigningKey.consumerAddress && consumerSigningKey.consumerAddress.trim() !== '' ? consumerSigningKey.consumerAddress : valconsAddress;
  } catch (error) {
    console.error(`Error fetching valcons for validator ${valconsAddress} on chain ${chainId}: ${error.message}`);
    return valconsAddress;
  }
}

async function fetchWithRetry (fetchFunction, maxRetries = 3, delayBetweenRetries = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchFunction();
    } catch (error) {
      if (i < maxRetries - 1) {
        await sleep(delayBetweenRetries);
      } else {
        throw error;
      }
    }
  }
}

async function fetchConsumerSigningKeys (stakingValidators, providerRpcEndpoint, chainIds, prefix, rpcDelay) {
  console.log('DELAY: ' + rpcDelay);
  let rpcCallCounter = 0;
  let completedTasks = 0;
  const totalTasks = stakingValidators.length * chainIds.length;

  const logProgress = () => {
    console.log(`[PROGRESS] Completed ${completedTasks} out of ${totalTasks} tasks.`);
  };

  const fetchKeysForValidator = async (stakingValidator, validatorIndex) => {
    stakingValidator.consumer_signing_keys = {};

    for (const chainId of chainIds) {
      const delayTime = rpcCallCounter * rpcDelay + validatorIndex * rpcDelay * chainIds.length;
      await sleep(delayTime);
      rpcCallCounter++;

      const valconsAddress = pubKeyToValcons(stakingValidator.consensus_pubkey.key,
        prefix);

      // console.log(`[DEBUG] Fetching valcons for validator: ${valconsAddress} on chain: ${chainId} at ${new Date().toISOString()}`);
      const consumerKey = await fetchWithRetry(() => getValconsForValidator(providerRpcEndpoint,
        chainId,
        valconsAddress),
      3,
      rpcDelay);
      // console.log(`[DEBUG] Completed fetching for validator: ${valconsAddress} on chain: ${chainId} at ${new Date().toISOString()}`);

      stakingValidator.consumer_signing_keys[chainId] = consumerKey;

      completedTasks++;
      logProgress();
    }
  };

  const promises = stakingValidators.map((validator, index) => fetchKeysForValidator(validator,
    index));
  await Promise.all(promises);

  return new StakingValidators(stakingValidators);
}

export {
  getConsensusState,
  getStakingValidators,
  orderByVotingPower,
  getProviderChainInfos,
  getConsumerChainInfos,
  fetchConsumerSigningKeys,
  validateConsumerRpcs,
  pubKeyToValcons,
  matchConsensusValidators,
  matchConsensusLastValidators,
  sleep
};
