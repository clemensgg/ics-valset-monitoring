export class CCVParams {
    constructor({
        enabled,
        blocksPerDistributionTransmission,
        distributionTransmissionChannel,
        providerFeePoolAddrStr,
        ccvTimeoutPeriod,
        transferTimeoutPeriod,
        consumerRedistributionFraction,
        historicalEntries,
        unbondingPeriod,
        softOptOutThreshold,
        rewardDenoms,
        providerRewardDenoms
    }) {
        this.enabled = enabled;
        this.blocksPerDistributionTransmission = blocksPerDistributionTransmission;
        this.distributionTransmissionChannel = distributionTransmissionChannel;
        this.providerFeePoolAddrStr = providerFeePoolAddrStr;
        this.ccvTimeoutPeriod = ccvTimeoutPeriod;
        this.transferTimeoutPeriod = transferTimeoutPeriod;
        this.consumerRedistributionFraction = consumerRedistributionFraction;
        this.historicalEntries = historicalEntries;
        this.unbondingPeriod = unbondingPeriod;
        this.softOptOutThreshold = softOptOutThreshold;
        this.rewardDenoms = rewardDenoms;
        this.providerRewardDenoms = providerRewardDenoms;
    }
}

// Example usage
// const params = new CCVParams({
//     enabled: true,
//     blocksPerDistributionTransmission: BigInt(100),
//     distributionTransmissionChannel: 'channel-123',
//     providerFeePoolAddrStr: 'cosmos1...',
//     ccvTimeoutPeriod: { seconds: 100, nanos: 0 }, // Assuming Duration has seconds and nanos
//     transferTimeoutPeriod: { seconds: 50, nanos: 0 },
//     consumerRedistributionFraction: '0.75',
//     historicalEntries: BigInt(10),
//     unbondingPeriod: { days: 7 },
//     softOptOutThreshold: '0.05',
//     rewardDenoms: ['uatom'],
//     providerRewardDenoms: ['uosmo']
// });
