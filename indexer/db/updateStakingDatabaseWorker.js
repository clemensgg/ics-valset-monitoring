import { parentPort } from 'worker_threads';
import { 
    updateStakingValidatorsDB,
    validateEndpointsAndSaveChains 
} from './update.js'

parentPort.on('message', async (message) => {
    const [providerChainInfos, consumerChainInfos] = await validateEndpointsAndSaveChains();
    try {
      if (message === 'updateStakingValidatorsDB') {
        await updateStakingValidatorsDB(providerChainInfos, consumerChainInfos);
        parentPort.postMessage('Done');
      }
    } catch (error) {
      parentPort.postMessage(`Error:${error.message}`);
    }
  });
  
