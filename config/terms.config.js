/**
 * Platform Terms & Conditions Configuration
 * These values are used across the platform for validation and business logic
 */

module.exports = {
    // Deposit Configuration
    MINIMUM_DEPOSIT: 20, // Minimum deposit amount in USD

    // Withdrawal Configuration
    MINIMUM_WITHDRAWAL: 10, // Minimum withdrawal amount in USD
    WITHDRAWAL_DEDUCTION_PERCENTAGE: 10, // Withdrawal deduction charge (10%)

    // Rank Reward Bonus Caps (Maximum allowed)
    WORKING_BONUS_MULTIPLIER: 3, // Maximum 3X bonus for active/verified users
    NON_WORKING_BONUS_MULTIPLIER: 2, // Maximum 2X bonus for inactive/non-verified users

    // Payment Network
    PAYMENT_NETWORK: 'USDT BEP-20', // Deposit & Withdrawal available in USDT Bep 20 Network

    /**
     * Calculate withdrawal deduction
     * @param {Number} amount - Withdrawal amount
     * @returns {Object} - { netAmount, deduction, grossAmount }
     */
    calculateWithdrawalDeduction: function (amount) {
        const deduction = (amount * this.WITHDRAWAL_DEDUCTION_PERCENTAGE) / 100;
        const netAmount = amount - deduction;
        return {
            grossAmount: amount,
            deduction: deduction,
            netAmount: netAmount
        };
    },

    /**
     * Validate deposit amount
     * @param {Number} amount - Deposit amount
     * @returns {Object} - { valid, message }
     */
    validateDeposit: function (amount) {
        if (amount < this.MINIMUM_DEPOSIT) {
            return {
                valid: false,
                message: `Minimum deposit amount is $${this.MINIMUM_DEPOSIT}`
            };
        }
        return {
            valid: true,
            message: 'Valid deposit amount'
        };
    },

    /**
     * Validate withdrawal amount
     * @param {Number} amount - Withdrawal amount
     * @returns {Object} - { valid, message }
     */
    validateWithdrawal: function (amount) {
        if (amount < this.MINIMUM_WITHDRAWAL) {
            return {
                valid: false,
                message: `Minimum withdrawal amount is $${this.MINIMUM_WITHDRAWAL}`
            };
        }
        return {
            valid: true,
            message: 'Valid withdrawal amount'
        };
    },

    /**
     * Get bonus multiplier based on user status
     * @param {Boolean} isVerified - User verification status
     * @param {Boolean} isBlocked - User blocked status
     * @returns {Number} - Bonus multiplier (2X or 3X)
     */
    getBonusMultiplier: function (isVerified, isBlocked) {
        const isWorking = isVerified && !isBlocked;
        return isWorking ? this.WORKING_BONUS_MULTIPLIER : this.NON_WORKING_BONUS_MULTIPLIER;
    }
};
