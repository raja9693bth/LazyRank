// Frontend Checkout & Payment Contract Implementation
// Strictly maintains the front-to-back payment contracts specified in server.ts:306-389

export interface PendingCheckout {
  ownerToken: string;
  orderAccessToken: string;
  idempotencyKey: string;
  createdAt: number;
}

export const PENDING_CHECKOUT_KEY = 'lazy_checkout_pending_v1';
export const orderCheckoutKey = (orderId: string): string => `lazy_checkout_${orderId}`;

// Browser-safe storage access
function getSessionStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage;
  return null;
}

function getLocalStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  return null;
}

// Cryptographic Service Access (Strictly no Math.random fallback)
function getCrypto(): Crypto | null {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    return window.crypto;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    return globalThis.crypto;
  }
  return null;
}

export function isCryptoAvailable(): boolean {
  return getCrypto() !== null;
}

// Generate exactly 64 lowercase hexadecimal characters with the given prefix
export function makeHex64(prefix: 'lazy' | 'ord'): string {
  const c = getCrypto();
  if (!c) {
    throw new Error('Secure browser cryptography is unavailable. Cannot generate security tokens.');
  }
  const bytes = new Uint8Array(32);
  c.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
}

export function makeIdempotencyKey(): string {
  const c = getCrypto();
  if (!c) {
    throw new Error('Secure browser cryptography is unavailable. Cannot generate idempotency key.');
  }
  const bytes = new Uint8Array(8);
  c.getRandomValues(bytes);
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `idem_${Date.now()}_${hex}`;
}

export function storePendingCheckout(record: PendingCheckout, storage?: Storage): void {
  const s = getSessionStorage(storage);
  if (s) {
    s.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(record));
  }
}

export function storeOrderCheckout(orderId: string, record: PendingCheckout, storage?: Storage): void {
  const s = getSessionStorage(storage);
  if (s) {
    s.setItem(orderCheckoutKey(orderId), JSON.stringify(record));
  }
}

export function getPendingCheckout(storage?: Storage): PendingCheckout | null {
  const s = getSessionStorage(storage);
  if (!s) return null;
  try {
    return JSON.parse(s.getItem(PENDING_CHECKOUT_KEY) || 'null') as PendingCheckout | null;
  } catch {
    return null;
  }
}

export function getOrderCheckout(orderId: string, storage?: Storage): PendingCheckout | null {
  const s = getSessionStorage(storage);
  if (!s) return null;
  try {
    return JSON.parse(s.getItem(orderCheckoutKey(orderId)) || 'null') as PendingCheckout | null;
  } catch {
    return null;
  }
}

export function clearCheckoutRecords(orderId?: string, storage?: Storage): void {
  const s = getSessionStorage(storage);
  if (!s) return;
  try {
    s.removeItem(PENDING_CHECKOUT_KEY);
    if (orderId) {
      s.removeItem(orderCheckoutKey(orderId));
    }
  } catch {}
}

export function saveOwnerToken(profileId: string, token: string, storage?: Storage): void {
  const ls = getLocalStorage(storage);
  if (!ls || !profileId || !token) return;
  try {
    const tokens = JSON.parse(ls.getItem('lazy_tokens') || '{}');
    tokens[profileId] = token;
    ls.setItem('lazy_tokens', JSON.stringify(tokens));
  } catch {}
}

export function getSavedOwnerToken(profileId: string, storage?: Storage): string | null {
  const ls = getLocalStorage(storage);
  if (!ls || !profileId) return null;
  try {
    const tokens = JSON.parse(ls.getItem('lazy_tokens') || '{}');
    return tokens[profileId] || null;
  } catch {
    return null;
  }
}

export interface ClaimOrderInput {
  name: string;
  amount: number;
  customerPhone: string;
  customerEmail?: string;
  instagram?: string;
  linkedin?: string;
  website?: string;
  reason?: string;
  lazyReason?: string;
  profileId?: string;
  consentAccepted: boolean;
  consentTimestamp: string;
  consentVersion: string;
}

export interface AttemptState {
  name: string;
  amount: number;
  phone: string;
  profileId?: string;
}

export interface CheckoutTokens {
  idempotencyKey: string;
  orderAccessToken: string;
  ownerToken: string;
  isUpgrade: boolean;
}

export interface SubmitOrderOptions {
  input: ClaimOrderInput;
  lastAttempt: AttemptState | null;
  currentIdempotencyKey: string | null;
  currentOrderAccessToken: string | null;
  currentPendingOwnerToken: string | null;
  sessionStorage?: Storage;
  localStorage?: Storage;
  fetchFn?: typeof fetch;
  topAmount?: number;
  minAmountToBeatTop?: number;
}

export type SubmitOrderResult =
  | {
      status: 'SUCCESS';
      data: any;
      tokens: CheckoutTokens;
    }
  | {
      status: 'UNAVAILABLE_503';
      orderData: any;
      tokens: CheckoutTokens;
    }
  | {
      status: 'ERROR';
      error: string;
    };

export async function submitClaimPayment(options: SubmitOrderOptions): Promise<SubmitOrderResult> {
  const {
    input,
    lastAttempt,
    currentIdempotencyKey,
    currentOrderAccessToken,
    currentPendingOwnerToken,
    sessionStorage,
    localStorage,
    fetchFn = fetch,
    topAmount = 0,
    minAmountToBeatTop = 1
  } = options;

  // 1. CRYPTO AVAILABILITY CHECK: Fail closed if browser crypto is unavailable
  if (!isCryptoAvailable()) {
    return {
      status: 'ERROR',
      error: 'Secure browser cryptography is required to initiate checkout. Please use a modern browser.'
    };
  }

  // 2. DYNAMIC CONSENT ENFORCEMENT: Fail immediately if consent is not accepted
  if (input.consentAccepted !== true) {
    return {
      status: 'ERROR',
      error: 'Please read and agree to the Terms & Conditions and Privacy Policy, and acknowledge the Refund Policy.'
    };
  }

  const targetProfileId = input.profileId;
  const isUpgrade = Boolean(targetProfileId);

  // 3. EXISTING PROFILE UPGRADE: Must have authentic saved owner token
  let storedToken: string | null = null;
  if (targetProfileId) {
    storedToken = getSavedOwnerToken(targetProfileId, localStorage);
    if (!storedToken) {
      return {
        status: 'ERROR',
        error: 'Unauthorized: Valid owner token is required to upgrade this profile. Token is missing from this browser.'
      };
    }
  }

  // 4. RETRY TRACKING: Check if identical retry
  const isIdenticalRetry =
    Boolean(lastAttempt) &&
    lastAttempt!.name === input.name.trim() &&
    lastAttempt!.amount === Math.round(input.amount) &&
    lastAttempt!.phone === input.customerPhone &&
    lastAttempt!.profileId === targetProfileId;

  // 5. TOKEN ALLOCATION: Preserve tokens on identical retry; generate fresh on new or changed parameters
  let activeIdempKey = isIdenticalRetry && currentIdempotencyKey ? currentIdempotencyKey : null;
  if (!activeIdempKey) {
    try {
      activeIdempKey = makeIdempotencyKey();
    } catch (err: any) {
      return { status: 'ERROR', error: err.message };
    }
  }

  let activeOrderToken = isIdenticalRetry && currentOrderAccessToken ? currentOrderAccessToken : null;
  if (!activeOrderToken) {
    try {
      activeOrderToken = makeHex64('ord');
    } catch (err: any) {
      return { status: 'ERROR', error: err.message };
    }
  }

  let activeOwnerToken: string;
  if (isUpgrade) {
    activeOwnerToken = storedToken!;
  } else if (isIdenticalRetry && currentPendingOwnerToken) {
    activeOwnerToken = currentPendingOwnerToken;
  } else {
    try {
      activeOwnerToken = makeHex64('lazy');
    } catch (err: any) {
      return { status: 'ERROR', error: err.message };
    }
  }

  const tokens: CheckoutTokens = {
    idempotencyKey: activeIdempKey,
    orderAccessToken: activeOrderToken,
    ownerToken: activeOwnerToken,
    isUpgrade
  };

  // 6. PRE-FLIGHT BACKUP: Back up in sessionStorage BEFORE network request
  const checkoutRecord: PendingCheckout = {
    ownerToken: activeOwnerToken,
    orderAccessToken: activeOrderToken,
    idempotencyKey: activeIdempKey,
    createdAt: Date.now()
  };
  storePendingCheckout(checkoutRecord, sessionStorage);

  try {
    const res = await fetchFn('/api/payment/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': activeIdempKey,
        'x-order-access-token': activeOrderToken,
        ...(isUpgrade && storedToken ? { 'x-profile-token': storedToken } : {})
      },
      body: JSON.stringify({
        name: input.name.trim(),
        amount: Math.round(input.amount),
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail,
        instagram: input.instagram,
        linkedin: input.linkedin,
        website: input.website,
        reason: input.reason,
        lazyReason: input.lazyReason,
        profileId: targetProfileId,
        ownerToken: isUpgrade ? storedToken : undefined,
        pendingOwnerToken: isUpgrade ? undefined : activeOwnerToken,
        orderAccessToken: activeOrderToken,
        consentAccepted: input.consentAccepted,
        consentTimestamp: input.consentTimestamp,
        consentVersion: input.consentVersion
      })
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 503) {
        return {
          status: 'UNAVAILABLE_503',
          orderData: {
            orderId: 'preview-disabled-mode',
            name: input.name.trim(),
            amount: Math.round(input.amount),
            currency: 'INR',
            isTop: false,
            topAmount,
            minAmountToBeatTop,
            paymentMode: 'disabled',
            instagram: input.instagram,
            linkedin: input.linkedin,
            website: input.website,
            reason: input.reason,
            profileId: targetProfileId
          },
          tokens
        };
      }
      return {
        status: 'ERROR',
        error: data.error || 'Failed to initiate payment.'
      };
    }

    if (data.orderId) {
      storeOrderCheckout(data.orderId, checkoutRecord, sessionStorage);
    }

    return {
      status: 'SUCCESS',
      data,
      tokens
    };
  } catch (err: any) {
    return {
      status: 'ERROR',
      error: err.message || 'Payment initiation failed.'
    };
  }
}

export interface PollRedirectOptions {
  orderId: string;
  sessionStorage?: Storage;
  localStorage?: Storage;
  fetchFn?: typeof fetch;
  maxPollAttempts?: number;
  pollIntervalMs?: number;
  sleepFn?: (ms: number) => Promise<void>;
}

export type PollRedirectResult =
  | {
      status: 'PAID';
      profile: any;
      ownerToken: string;
    }
  | {
      status: 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'USER_DROPPED';
      error: string;
    }
  | {
      status: 'UNRECOVERABLE';
      error: string;
    };

export async function pollRedirectOrderStatus(options: PollRedirectOptions): Promise<PollRedirectResult> {
  const {
    orderId,
    sessionStorage,
    localStorage,
    fetchFn = fetch,
    maxPollAttempts = 10,
    pollIntervalMs = 2000,
    sleepFn = (ms: number) => new Promise(r => setTimeout(r, ms))
  } = options;

  const recovered = getOrderCheckout(orderId, sessionStorage);
  if (!recovered || !/^ord_[0-9a-f]{64}$/i.test(recovered.orderAccessToken)) {
    return {
      status: 'UNRECOVERABLE',
      error: `Cannot restore this checkout in this browser. Please contact support@lazyproof.online with your order ID: ${orderId}`
    };
  }

  for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
    try {
      const statusRes = await fetchFn(`/api/payment/status/${encodeURIComponent(orderId)}`, {
        headers: { 'x-order-access-token': recovered.orderAccessToken }
      });

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.status === 'PAID') {
          if (statusData.profile) {
            // Save browser-owned token for this profile
            if (statusData.profile.id && recovered.ownerToken) {
              saveOwnerToken(statusData.profile.id, recovered.ownerToken, localStorage);
            }
            // Remove pending and order session storage only after recovery
            clearCheckoutRecords(orderId, sessionStorage);

            return {
              status: 'PAID',
              profile: statusData.profile,
              ownerToken: recovered.ownerToken
            };
          }
        } else if (['FAILED', 'USER_DROPPED', 'CANCELLED', 'EXPIRED'].includes(statusData.status)) {
          return {
            status: statusData.status,
            error: `Payment ${statusData.status.toLowerCase().replace('_', ' ')}. Please try again.`
          };
        }
      }
    } catch {}

    if (attempt < maxPollAttempts - 1) {
      await sleepFn(pollIntervalMs);
    }
  }

  return {
    status: 'UNRECOVERABLE',
    error: `Payment status could not be verified automatically. Please contact support@lazyproof.online with your order ID: ${orderId}`
  };
}
