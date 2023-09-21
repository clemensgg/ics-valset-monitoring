// src/models/MatchedValidator.js

export class MatchedValidator {
    constructor(stakingValidator, consensusValidator) {
        this.stakingValidator = stakingValidator;
        this.consensusValidator = consensusValidator;
    }
}