import {
  saveProviderChainInfos,
  saveConsumerChainInfos,
  saveStakingValidators,
  getStakingValidatorsFromDB,
  saveMatchedValidators,
  getMatchedValidatorsFromDB,
  getConsumerChainInfosFromDB,
  getProviderChainInfosFromDB
} from './db/update.js'
import {
  fetchConsumerSigningKeys,
  getProviderChainInfos,
  getConsensusState,
  getConsensusValidators,
  getStakingValidators,
  matchValidators,
  validateConsumerRpcs,
  sleep
} from './utils/utils.js'

import app from './server.js'

// Mainnet Endpoints
//
const PROVIDER_RPC = 'http://5.9.72.212:2001'
const PROVIDER_REST = 'http://162.55.92.114:2011'
const CONSUMER_RPCS = ['http://148.251.183.254:2102', 'http://148.251.183.254:2202']

// RS Testnet Endpoints
//
// const PROVIDER_RPC = "http://65.108.127.249:2001";
// const PROVIDER_REST = "http://65.108.127.249:2004"
// const CONSUMER_RPCS = ["https://rpc-palvus.pion-1.ntrn.tech:443"];

const RPC_DELAY = 45
const UPDATE_DATABASE_FREQUENCY = 600000

async function updateDatabaseData () {
  console.log('Updating database data...')

  const consumerChainInfos = await validateConsumerRpcs(PROVIDER_RPC, CONSUMER_RPCS)
  const providerChainInfos = await getProviderChainInfos(PROVIDER_RPC)

  await saveConsumerChainInfos(consumerChainInfos)
  await saveProviderChainInfos(providerChainInfos)

  const stakingValidators = await getStakingValidators(PROVIDER_REST)

  const allChainIds = consumerChainInfos.map(chain => chain.chainId)
  const stakingValidatorsWithSigningKeys = await fetchConsumerSigningKeys(stakingValidators, PROVIDER_RPC, allChainIds, 'cosmos', RPC_DELAY)

  await saveStakingValidators(stakingValidatorsWithSigningKeys)

  console.log('Database data updated.')
}

async function main () {
  console.log('starting ics-valset-monitoring')

  // Load the necessary data from the database
  const consumerChainInfos = await getConsumerChainInfosFromDB()
  const providerChainInfos = await getProviderChainInfosFromDB()
  const stakingValidators = await getStakingValidatorsFromDB()

  if (!consumerChainInfos || !providerChainInfos || !stakingValidators || consumerChainInfos.length === 0 || providerChainInfos.length === 0 || stakingValidators.length === 0) {
    console.log('running STARTUP...')
    await updateDatabaseData()
    setInterval(updateDatabaseData, UPDATE_DATABASE_FREQUENCY)
  } else {
    sleep(UPDATE_DATABASE_FREQUENCY)
    setInterval(updateDatabaseData, UPDATE_DATABASE_FREQUENCY)
  }

  for (const chain of consumerChainInfos) {
    console.log(`Processing consumer chain with ID: ${chain.chainId}`)
    const consensusState = await getConsensusState(chain.rpcEndpoint)
    const matchedValidators = await matchValidators(stakingValidators, consensusState, 'cosmos')

    await saveMatchedValidators(matchedValidators)

    console.log(`Matched ${matchedValidators.length} validators for chain ${chain.chainId}`)
    console.log(JSON.stringify(matchedValidators))
    console.log(JSON.stringify('-------------------------------------------------'))
  }
}

main().then(
  console.log('done')
)

process.on('exit', (code) => {
  db.close((err) => {
    if (err) {
      console.error(err.message)
    }
    console.log('Closed the database connection.')
  })
})
