/**
 * Authoritative Server Pricing Policy for LazyProof (operated by ADABHRA GROUP).
 * Implements approved business minimums and exact integer arithmetic.
 *
 * Approved Founder Decision (20 October 2026 IST):
 * - Minimum NEW INR sponsorship / additional upgrade payment: INR 99 (9,900 paise).
 * - Minimum NEW actual USD sponsorship / additional upgrade payment: USD 5.00 (500 cents).
 * - Preserve INR 1 rank step (100 paise) to exceed current leader.
 * - Target vs Transaction Floor:
 *   New profile target: max(M, ceilINRStep(T + 100 paise))
 *   Upgrade target:     max(M, ceilINRStep(T - O + 100 paise))
 */

export const MIN_INR_PAISE = 9900; // ₹99.00
export const MIN_USD_CENTS = 500;  // $5.00
export const INR_STEP_PAISE = 100; // ₹1.00

export const DEFAULT_QUOTE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const CURRENT_PRICING_VERSION = '2026-10-20-rev1';

export type SupportedChargeCurrency = 'INR' | 'USD';

export interface CurrencyPricingCapability {
  currency: SupportedChargeCurrency;
  enabled: boolean;
  minMinorUnit: number;
  stepMinorUnit: number;
  displaySymbol: string;
  helperText: string;
  errorMessage: string;
}

export interface PricingCapabilitiesResponse {
  pricingVersion: string;
  currentPricingVersion?: string;
  baseCurrency: 'INR';
  chargeCurrencies: CurrencyPricingCapability[];
  businessMinimums: {
    INR_PAISE: number;
    USD_CENTS: number;
  };
  rankStepPaise: number;
  INR: CurrencyPricingCapability;
  USD: CurrencyPricingCapability;
}

export interface AmountValidationResult {
  isValid: boolean;
  valid: boolean;
  errorCode?: string;
  code?: string;
  errorMessage?: string;
  error?: string;
  currency: SupportedChargeCurrency;
  amountMinor: number;
  minimumMinor: number;
}

export interface RankTargetCalculation {
  topPaise: number;
  ownerPaise: number;
  suggestedChargePaise: number;
  suggestedChargeINR: number;
  projectedTotalPaise: number;
  projectedTotalINR: number;
  minAmountToBeatTopINR: number;
  isUpgrade: boolean;
}

/**
 * Rounds an amount in paise UPWARD to the nearest whole INR step (100 paise).
 * Never rounds down.
 */
export function ceilINRStep(paise: number): number {
  if (!Number.isFinite(paise) || paise <= 0) return 0;
  return Math.ceil(paise / INR_STEP_PAISE) * INR_STEP_PAISE;
}

/**
 * Computes the suggested charge and projected total for a new or upgrading claimant.
 * @param topInput Leader amount (in Rupees by default, or paise if unit = 'PAISE')
 * @param ownerInput Owner cumulative amount (in Rupees by default, or paise if unit = 'PAISE')
 * @param unit 'INR' or 'PAISE' (default 'INR')
 * @param effectiveMinPaise Business floor in paise (default MIN_INR_PAISE = 9900)
 */
export function calculateRankTarget(
  topInput: number,
  ownerInput: number = 0,
  unit: 'INR' | 'PAISE' = 'INR',
  effectiveMinPaise: number = MIN_INR_PAISE
): RankTargetCalculation {
  const safeTopPaise = unit === 'INR' ? Math.max(0, Math.floor(Number(topInput || 0) * 100)) : Math.max(0, Math.floor(Number(topInput || 0)));
  const safeOwnerPaise = unit === 'INR' ? Math.max(0, Math.floor(Number(ownerInput || 0) * 100)) : Math.max(0, Math.floor(Number(ownerInput || 0)));
  const M = Math.max(MIN_INR_PAISE, Math.floor(Number(effectiveMinPaise) || MIN_INR_PAISE));
  const G = INR_STEP_PAISE; // 100 paise (₹1 step)

  const isUpgrade = safeOwnerPaise > 0;

  let suggestedChargePaise: number;
  if (!isUpgrade) {
    // New profile: max(M, ceilINRStep(T + G))
    suggestedChargePaise = Math.max(M, ceilINRStep(safeTopPaise + G));
  } else {
    // Upgrade: max(M, ceilINRStep(T - O + G))
    suggestedChargePaise = Math.max(M, ceilINRStep(safeTopPaise - safeOwnerPaise + G));
  }

  const projectedTotalPaise = safeOwnerPaise + suggestedChargePaise;
  const suggestedChargeINR = Math.round(suggestedChargePaise / 100);

  return {
    topPaise: safeTopPaise,
    ownerPaise: safeOwnerPaise,
    suggestedChargePaise,
    suggestedChargeINR,
    projectedTotalPaise,
    projectedTotalINR: Math.round(projectedTotalPaise / 100),
    minAmountToBeatTopINR: suggestedChargeINR,
    isUpgrade
  };
}

/**
 * Validates a payment amount strictly on the server before creating remote orders.
 * Handles inputs in standard unit representation (whole rupees for INR, dollars and cents for USD).
 */
export function validatePaymentAmount(
  amountInput: number | string,
  currency: string = 'INR',
  effectiveFloorMinor?: number
): AmountValidationResult {
  const cleanCurrency = (currency || 'INR').toUpperCase().trim() as SupportedChargeCurrency;

  if (cleanCurrency !== 'INR' && cleanCurrency !== 'USD') {
    return {
      isValid: false,
      valid: false,
      errorCode: 'UNSUPPORTED_CURRENCY',
      code: 'UNSUPPORTED_CURRENCY',
      errorMessage: `Currency ${currency} is not supported for checkout. Supported currencies are INR and USD.`,
      error: `Currency ${currency} is not supported for checkout. Supported currencies are INR and USD.`,
      currency: 'INR',
      amountMinor: 0,
      minimumMinor: MIN_INR_PAISE
    };
  }

  const strVal = String(amountInput ?? '').trim();
  const numVal = Number(strVal);

  if (!strVal || Number.isNaN(numVal) || !Number.isFinite(numVal) || numVal <= 0) {
    const minMinor = cleanCurrency === 'INR' ? (effectiveFloorMinor ?? MIN_INR_PAISE) : (effectiveFloorMinor ?? MIN_USD_CENTS);
    const msg = cleanCurrency === 'INR'
      ? 'Minimum sponsorship is ₹99. Enter ₹99 or more to continue.'
      : 'Minimum sponsorship is $5.00. Enter $5.00 or more to continue.';
    return {
      isValid: false,
      valid: false,
      errorCode: 'INVALID_AMOUNT',
      code: 'INVALID_AMOUNT',
      errorMessage: msg,
      error: msg,
      currency: cleanCurrency,
      amountMinor: 0,
      minimumMinor: minMinor
    };
  }

  if (cleanCurrency === 'INR') {
    // Rejects fractional paise in rupee amounts (e.g. 99.50, 98.99)
    if (strVal.includes('.')) {
      return {
        isValid: false,
        valid: false,
        errorCode: 'FRACTIONAL_AMOUNT_REJECTED',
        code: 'FRACTIONAL_AMOUNT_REJECTED',
        errorMessage: 'INR sponsorship amounts must be whole rupees with no fractional paise.',
        error: 'INR sponsorship amounts must be whole rupees with no fractional paise.',
        currency: 'INR',
        amountMinor: Math.round(numVal * 100),
        minimumMinor: effectiveFloorMinor ?? MIN_INR_PAISE
      };
    }

    const minPaise = Math.max(MIN_INR_PAISE, effectiveFloorMinor ?? MIN_INR_PAISE);
    const amountPaise = Math.round(numVal * 100);

    if (amountPaise < minPaise) {
      const minINR = Math.round(minPaise / 100);
      const msg = `Minimum sponsorship is ₹${minINR}. Enter ₹${minINR} or more to continue.`;
      return {
        isValid: false,
        valid: false,
        errorCode: 'AMOUNT_BELOW_MINIMUM',
        code: 'AMOUNT_BELOW_MINIMUM',
        errorMessage: msg,
        error: msg,
        currency: 'INR',
        amountMinor: amountPaise,
        minimumMinor: minPaise
      };
    }

    if (amountPaise > 100000000) {
      return {
        isValid: false,
        valid: false,
        errorCode: 'AMOUNT_ABOVE_MAXIMUM',
        code: 'AMOUNT_ABOVE_MAXIMUM',
        errorMessage: 'Payment amount exceeds maximum limit of ₹10,00,000.',
        error: 'Payment amount exceeds maximum limit of ₹10,00,000.',
        currency: 'INR',
        amountMinor: amountPaise,
        minimumMinor: minPaise
      };
    }

    return {
      isValid: true,
      valid: true,
      currency: 'INR',
      amountMinor: amountPaise,
      minimumMinor: minPaise
    };
  } else {
    // USD: maximum 2 decimal places allowed
    if (strVal.includes('.')) {
      const decimals = strVal.split('.')[1] || '';
      if (decimals.length > 2) {
        return {
          isValid: false,
          valid: false,
          errorCode: 'INVALID_PRECISION',
          code: 'INVALID_PRECISION',
          errorMessage: 'USD amount cannot have more than 2 decimal places.',
          error: 'USD amount cannot have more than 2 decimal places.',
          currency: 'USD',
          amountMinor: Math.round(numVal * 100),
          minimumMinor: effectiveFloorMinor ?? MIN_USD_CENTS
        };
      }
    }

    const minCents = Math.max(MIN_USD_CENTS, effectiveFloorMinor ?? MIN_USD_CENTS);
    const amountCents = Math.round(numVal * 100);

    if (amountCents < minCents) {
      const minUSD = (minCents / 100).toFixed(2);
      const msg = `Minimum sponsorship is $${minUSD}. Enter $${minUSD} or more to continue.`;
      return {
        isValid: false,
        valid: false,
        errorCode: 'AMOUNT_BELOW_MINIMUM',
        code: 'AMOUNT_BELOW_MINIMUM',
        errorMessage: msg,
        error: msg,
        currency: 'USD',
        amountMinor: amountCents,
        minimumMinor: minCents
      };
    }

    if (amountCents > 100000000) {
      return {
        isValid: false,
        valid: false,
        errorCode: 'AMOUNT_ABOVE_MAXIMUM',
        code: 'AMOUNT_ABOVE_MAXIMUM',
        errorMessage: 'Payment amount exceeds maximum limit of $1,000,000.',
        error: 'Payment amount exceeds maximum limit of $1,000,000.',
        currency: 'USD',
        amountMinor: amountCents,
        minimumMinor: minCents
      };
    }

    return {
      isValid: true,
      valid: true,
      currency: 'USD',
      amountMinor: amountCents,
      minimumMinor: minCents
    };
  }
}

/**
 * Rank Credit Calculation for USD charges:
 * Exact integer arithmetic using numerator/denominator representing INR PAISE per USD CENT.
 * R = Math.floor((C * numerator) / denominator)
 *
 * Example: 1 USD = 90 INR -> 100 cents = 9000 paise -> 90 paise per cent.
 * numerator = 90, denominator = 1.
 * 500 cents * 90 / 1 = 45000 paise (₹450.00).
 */
export function calculateRankCreditFromUSD(
  chargeCents: number,
  rateNumerator: number,
  rateDenominator: number = 1
): {
  rankCreditPaise: number;
  rankCreditINR: number;
  numerator: number;
  denominator: number;
} {
  const safeCents = Number.isSafeInteger(chargeCents) && chargeCents > 0 ? chargeCents : 0;
  const safeNum = Number.isSafeInteger(rateNumerator) && rateNumerator > 0 ? rateNumerator : 90;
  const safeDen = Number.isSafeInteger(rateDenominator) && rateDenominator > 0 ? rateDenominator : 1;

  const creditPaise = Math.floor((safeCents * safeNum) / safeDen);
  return {
    rankCreditPaise: creditPaise,
    rankCreditINR: Math.round(creditPaise / 100),
    numerator: safeNum,
    denominator: safeDen
  };
}

/**
 * Returns public pricing capabilities for /api/payment/config.
 */
export function getPricingCapabilities(isUsdEnabled: boolean = false): PricingCapabilitiesResponse {
  const inrCap: CurrencyPricingCapability = {
    currency: 'INR',
    enabled: true,
    minMinorUnit: MIN_INR_PAISE,
    stepMinorUnit: INR_STEP_PAISE,
    displaySymbol: '₹',
    helperText: 'Minimum sponsorship: ₹99.',
    errorMessage: 'Minimum sponsorship is ₹99. Enter ₹99 or more to continue.'
  };

  const usdCap: CurrencyPricingCapability = {
    currency: 'USD',
    enabled: isUsdEnabled,
    minMinorUnit: MIN_USD_CENTS,
    stepMinorUnit: 1, // 1 cent
    displaySymbol: '$',
    helperText: 'Minimum sponsorship: $5.00.',
    errorMessage: 'Minimum sponsorship is $5.00. Enter $5.00 or more to continue.'
  };

  return {
    pricingVersion: CURRENT_PRICING_VERSION,
    currentPricingVersion: CURRENT_PRICING_VERSION,
    baseCurrency: 'INR',
    businessMinimums: {
      INR_PAISE: MIN_INR_PAISE,
      USD_CENTS: MIN_USD_CENTS
    },
    rankStepPaise: INR_STEP_PAISE,
    chargeCurrencies: [inrCap, usdCap],
    INR: inrCap,
    USD: usdCap
  };
}
