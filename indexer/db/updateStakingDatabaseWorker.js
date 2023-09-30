import { parentPort } from 'worker_threads';
import { 
    validateConsumerRpcs, 
    getStakingValidators 
} from '../utils/utils.js'
import { saveStakingValidators } from './update.js'
import { CONFIG } from '../config.js'

// Update Database Data
async function updateStakingValidatorsDB() {
    console.time('updateDatabaseData Execution Time');
    const [providerChainInfos, consumerChainInfos] = await validateConsumerRpcs();
    const stakingValidators = await getStakingValidators(CONFIG.PROVIDER_REST);
    let sovereignStakingValidators;

    const hasSovereign = consumerChainInfos.some(obj => obj.type === 'sovereign');
    if (hasSovereign) {
        sovereignStakingValidators = new StakingValidators(await getStakingValidators(CONFIG.SOVEREIGN_REST));
        if (!sovereignStakingValidators) {
            console.error(`ERROR fetching sovereign staking validators from ${CONFIG.SOVEREIGN_REST}! Check your config!`);
            process.exit(1);
        }
    }

    if (providerChainInfos && providerChainInfos.chainId != '' && consumerChainInfos && consumerChainInfos.length > 0 && stakingValidators && stakingValidators.length > 0) {
        const allChainIds = consumerChainInfos.map(chain => chain.chainId);
        const stakingValidatorsWithSigningKeys = await fetchConsumerSigningKeys(stakingValidators, CONFIG.PROVIDER_RPC, allChainIds, CONFIG.PREFIX, CONFIG.RPC_DELAY_MS);

        await saveStakingValidators(stakingValidatorsWithSigningKeys, providerChainInfos.chainId);
        console.log('Updated stakingValidators.');

        if (hasSovereign) {
            sovereignStakingValidators.validators.forEach(validator => {
                validator.consumer_signing_keys = [];
            });
            await saveStakingValidators(sovereignStakingValidators);
        }
    } else {
        console.warn('Error updating stakingValidators!');
    }

    console.timeEnd('Finished updateDatabaseData after execution time: ');
    console.log('---------------------------------------------------------------------------');
}

parentPort.on('message', async (message) => {
    try {
      if (message === 'updateStakingValidatorsDB') {
        await updateStakingValidatorsDB();
        parentPort.postMessage('Done');
      }
    } catch (error) {
      parentPort.postMessage(`Error:${error.message}`);
    }
  });
  
