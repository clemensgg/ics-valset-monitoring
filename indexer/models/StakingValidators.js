// src/models/StakingValidator.js

export class StakingValidators {
  constructor (validators, timestamp = new Date().toISOString()) {
    this.timestamp = timestamp;
    this.validators = validators.map(validator => new Validator(validator,
      timestamp));
    this.created_at = timestamp;
    this.updated_at = timestamp;
  }
}

class Validator {
  constructor (data, timestamp) {
    this.timestamp = timestamp;
    this.operator_address = data.operator_address;
    this.consensus_pubkey = new ConsensusPubKey(data.consensus_pubkey);
    if (typeof data.consumer_signing_keys === 'string') {
        this.consumer_signing_keys = JSON.parse(data.consumer_signing_keys);
    } else if (data.consumer_signing_keys && typeof data.consumer_signing_keys === 'object') {
        this.consumer_signing_keys = data.consumer_signing_keys;
    } else {
        this.consumer_signing_keys = {};
    }
    this.jailed = data.jailed;
    this.status = data.status;
    this.tokens = data.tokens;
    this.delegator_shares = data.delegator_shares;
    this.description = new Description(data.description);
    this.unbonding_height = data.unbonding_height;
    this.unbonding_time = data.unbonding_time;
    this.commission = new Commission(data.commission);
    this.min_self_delegation = data.min_self_delegation;
    this.unbonding_on_hold_ref_count = data.unbonding_on_hold_ref_count;
    this.unbonding_ids = data.unbonding_ids;
    this.validator_bond_shares = data.validator_bond_shares;
    this.liquid_shares = data.liquid_shares;
  }
}

class ConsensusPubKey {
  constructor (data) {
    this.type = data['@type'];
    this.key = data.key;
  }
}

class Description {
  constructor (data) {
    this.moniker = data.moniker;
    this.identity = data.identity;
    this.website = data.website;
    this.security_contact = data.security_contact;
    this.details = data.details;
  }
}

class Commission {
  constructor (data) {
    this.commission_rates = new CommissionRates(data.commission_rates);
    this.update_time = data.update_time || null;
  }
}

class CommissionRates {
  constructor (data) {
    this.rate = data.rate;
    this.max_rate = data.max_rate;
    this.max_change_rate = data.max_change_rate;
  }
}
