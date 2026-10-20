import React, { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, ShieldAlert, Loader2, ArrowRight, CheckCircle2, Printer, ExternalLink, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile } from '../types.ts';
import { LEGAL_CONFIG } from '../config/legal.ts';
import { saveOwnerToken, getSavedOwnerToken, getOrderCheckout } from '../utils/checkoutContract.ts';

function isValidCheckoutUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const allowedHosts = [
      'test.dodopayments.com',
      'checkout.dodopayments.com',
      'api.dodopayments.com',
      'localhost',
      '127.0.0.1'
    ];
    return allowedHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}

let razorpayScriptPromise: Promise<void> | null = null;
function loadRazorpayScript(): Promise<void> {
  if (razorpayScriptPromise !== null) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();
    if ((window as any).Razorpay) return resolve();
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      razorpayScriptPromise = null;
      reject(new Error('Failed to load Razorpay checkout script.'));
    };
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
}

interface PaymentModalProps {
  orderData: {
    orderId: string;
    paymentSessionId?: string;
    checkoutUrl?: string;
    providerOrderId?: string;
    name: string;
    amount: number;
    currency: string;
    isTop: boolean;
    topAmount: number;
    minAmountToBeatTop: number;
    profileId?: string;
    customerPhone?: string;
    customerEmail?: string;
    instagram?: string;
    linkedin?: string;
    website?: string;
    twitter?: string;
    reason?: string;
    provider?: string;
    paymentMode?: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (profile: UserProfile, previousTop?: UserProfile, ownerToken?: string) => void;
  pendingOwnerToken?: string | null;
  orderAccessToken?: string | null;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  orderData,
  isOpen,
  onClose,
  onPaymentSuccess,
  pendingOwnerToken,
  orderAccessToken
}) => {
  const [step, setStep] = useState<'disabled' | 'checkout' | 'polling' | 'success' | 'error'>('disabled');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedProfile, setCompletedProfile] = useState<UserProfile | null>(null);
  const [_receiptData, setReceiptData] = useState<any | null>(null);
  const [persistedToken, setPersistedToken] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const pollAbortControllerRef = useRef<AbortController | null>(null);
  const pollTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen && orderData) {
      const hasCheckoutSession = Boolean(orderData.paymentSessionId || orderData.checkoutUrl || orderData.providerOrderId);
      if (orderData.paymentMode === 'disabled' || !hasCheckoutSession) {
        setStep('disabled');
      } else {
        setStep('checkout');
      }
      setErrorMessage(null);
      setCompletedProfile(null);
      setReceiptData(null);
      setPersistedToken(null);
      setStorageWarning(null);
    }
    return () => {
      if (pollAbortControllerRef.current) pollAbortControllerRef.current.abort();
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [isOpen, orderData]);

  // Escape key handler for accessible modal dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'polling') {
        handleModalClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, step, completedProfile, persistedToken, pendingOwnerToken]);

  const handleModalClose = () => {
    if (step === 'success' && completedProfile) {
      onPaymentSuccess(completedProfile, undefined, pendingOwnerToken ?? undefined);
    } else {
      onClose();
    }
  };

  if (!isOpen || !orderData) return null;

  const isSandbox = orderData.paymentMode === 'sandbox' || (import.meta as any).env?.VITE_PAYMENT_MODE === 'sandbox';

  // Start bounded polling status when user enters checkout or returns
  const startStatusPolling = (orderId: string) => {
    setStep('polling');
    if (pollAbortControllerRef.current) {
      pollAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    pollAbortControllerRef.current = abortController;

    const startTime = Date.now();
    const maxDurationMs = 150000; // 2.5 minutes deadline
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 10;

    const poll = async () => {
      if (abortController.signal.aborted) return;
      if (Date.now() - startTime >= maxDurationMs) {
        setStep('error');
        setErrorMessage('Payment confirmation is taking longer than expected. If your account was debited, your placement will be activated automatically once the provider webhook arrives.');
        return;
      }

      try {
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), 8000);

        const headers: Record<string, string> = {};
        if (orderAccessToken) headers['x-order-access-token'] = orderAccessToken;

        const res = await fetch(`/api/payment/status/${encodeURIComponent(orderId)}`, {
          headers,
          signal: timeoutController.signal
        });
        clearTimeout(timeoutId);

        if (abortController.signal.aborted) return;

        consecutiveErrors = 0;
        const data = await res.json();

        if (data.status === 'PAID' && data.profile) {
          await handleSuccess(data.profile, data.ownerToken, orderId);
          return;
        } else if (data.status === 'FAILED' || data.status === 'CANCELLED') {
          setStep('error');
          setErrorMessage('Payment was not completed by the gateway. You may try again.');
          return;
        }
      } catch {
        consecutiveErrors++;
        if (consecutiveErrors >= maxConsecutiveErrors) {
          if (!abortController.signal.aborted) {
            setStep('error');
            setErrorMessage('Network error checking payment status. Please check your connection and retry.');
          }
          return;
        }
      }

      if (!abortController.signal.aborted) {
        pollTimeoutRef.current = setTimeout(poll, 2500);
      }
    };

    void poll();
  };

  const handleSuccess = async (profile: UserProfile, _ownerToken: string | undefined, orderId: string) => {
    setCompletedProfile(profile);

    // CRITICAL: Immediately persist authentic client-generated token
    // Never take an owner token from status response.
    // Recover from pendingOwnerToken, getOrderCheckout(orderId), or existing saved token for profile upgrades.
    const clientToken = (pendingOwnerToken && pendingOwnerToken.trim().length > 0)
      ? pendingOwnerToken
      : (orderId ? getOrderCheckout(orderId)?.ownerToken : null)
      || (orderData?.profileId ? getSavedOwnerToken(orderData.profileId) : null);

    if (profile.id && clientToken) {
      setPersistedToken(clientToken);
      const saved = saveOwnerToken(profile.id, clientToken);
      if (!saved) {
        setStorageWarning(
          `Browser local storage is unavailable or full. To edit or manage your profile later, please securely copy and save your private owner token: ${clientToken}`
        );
      } else {
        setStorageWarning(null);
      }
    }

    try {
      const headers: Record<string, string> = {};
      if (orderAccessToken) headers['x-order-access-token'] = orderAccessToken;
      const receiptRes = await fetch(`/api/payment/receipt/${encodeURIComponent(orderId)}`, { headers });
      if (receiptRes.ok) {
        const rData = await receiptRes.json();
        setReceiptData(rData);
      }
    } catch {}

    try {
      confetti({
        particleCount: 85,
        spread: 80,
        origin: { y: 0.55 },
        colors: ['#f59e0b', '#d97706', '#10b981', '#6366f1', '#ec4899', '#fbbf24'],
        disableForReducedMotion: true
      });
    } catch {}

    setStep('success');
  };

  const handleLaunchCheckout = async () => {
    setErrorMessage(null);

    // Razorpay Standard Checkout path
    if (orderData.provider === 'razorpay' && orderData.providerOrderId) {
      try {
        await loadRazorpayScript();
        const w = typeof window !== 'undefined' ? (window as any) : undefined;
        if (w && typeof w.Razorpay === 'function') {
          // Fetch public key from config if needed
          let rzpKey = (window as any).RAZORPAY_KEY_ID;
          if (!rzpKey) {
            try {
              const cfgRes = await fetch('/api/payment/config');
              const cfg = await cfgRes.json();
              rzpKey = cfg.razorpayKeyId;
            } catch {}
          }

          const options = {
            key: rzpKey || 'rzp_test_placeholder',
            amount: orderData.amount * 100,
            currency: 'INR',
            name: 'LazyProof',
            description: 'Digital sponsored profile placement',
            order_id: orderData.providerOrderId,
            handler: async function (response: any) {
              setStep('polling');
              try {
                const completeRes = await fetch('/api/payment/razorpay/complete', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(orderAccessToken ? { 'x-order-access-token': orderAccessToken } : {})
                  },
                  body: JSON.stringify({
                    orderId: orderData.orderId,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature,
                    orderAccessToken
                  })
                });
                const completeData = await completeRes.json();
                if (completeRes.ok && completeData.profile) {
                  await handleSuccess(completeData.profile, undefined, orderData.orderId);
                } else {
                  startStatusPolling(orderData.orderId);
                }
              } catch {
                startStatusPolling(orderData.orderId);
              }
            },
            prefill: {
              name: orderData.name,
              contact: orderData.customerPhone
            },
            modal: {
              ondismiss: function () {
                startStatusPolling(orderData.orderId);
              }
            }
          };

          const rzp = new w.Razorpay(options);
          rzp.open();
          return;
        }
      } catch (err: any) {
        console.warn('[Razorpay SDK] Initialization error:', err);
      }
    }

    // Hosted URL checkout path (Dodo payments)
    if (orderData.checkoutUrl) {
      if (!isValidCheckoutUrl(orderData.checkoutUrl)) {
        setStep('checkout');
        setErrorMessage('Security verification failed: invalid checkout redirect host.');
        return;
      }
      setStep('polling');
      window.location.href = orderData.checkoutUrl;
      startStatusPolling(orderData.orderId);
      return;
    }

    setStep('checkout');
    setErrorMessage('Payment checkout could not load. Please retry.');
  };

  const handleSandboxSimulate = async () => {
    setStep('polling');
    setErrorMessage(null);

    try {
      let storedOwnerToken: string | undefined;
      if (orderData.profileId) {
        try {
          const tokens = JSON.parse(localStorage.getItem('lazy_tokens') || '{}');
          storedOwnerToken = tokens[orderData.profileId];
        } catch {}
      }

      const res = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(storedOwnerToken ? { 'x-profile-token': storedOwnerToken } : {})
        },
        body: JSON.stringify({
          orderId: orderData.orderId,
          paymentReference: `SANDBOX_${orderData.orderId}`,
          name: orderData.name,
          amount: orderData.amount,
          instagram: orderData.instagram,
          linkedin: orderData.linkedin,
          website: orderData.website,
          twitter: orderData.twitter,
          reason: orderData.reason,
          profileId: orderData.profileId,
          ownerToken: storedOwnerToken
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.profile) {
        throw new Error(data.error || 'Payment verification failed.');
      }

      await handleSuccess(data.profile, data.ownerToken, orderData.orderId);
    } catch (err: any) {
      setStep('error');
      setErrorMessage(err?.message || 'Sandbox verification failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-xs p-4 overflow-y-auto" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
        className="relative w-full max-w-lg rounded-2xl bg-white border border-zinc-200 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 bg-zinc-50/50">
          <div className="flex items-center gap-2">
            {step === 'success' ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-amber-600" />
            )}
            <h3 id="payment-modal-title" className="text-sm font-extrabold text-zinc-900 uppercase tracking-wider">
              {step === 'success' ? 'Payment Verified & Receipt' : 'Checkout & Payment Status'}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            aria-label="Close payment modal"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5">
          {/* STEP 1: Truthful Onboarding Mode */}
          {step === 'disabled' && (
            <div className="space-y-4">
              {/* Order Summary Box */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-center">
                <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                  Payment Consideration
                </div>
                <div className="text-3xl font-mono-numbers font-black text-zinc-950 mt-1">
                  ₹{orderData.amount.toLocaleString('en-IN')} INR
                </div>
                <div className="text-xs text-zinc-600 mt-1">
                  Participant: <strong className="text-zinc-900">{orderData.name}</strong>
                  {orderData.isTop && (
                    <span className="ml-1 text-amber-700 font-bold">(Target: #1 Rank)</span>
                  )}
                </div>
              </div>

              {/* Service & Entity Disclosure */}
              <div className="p-3.5 rounded-xl border border-zinc-200 bg-white text-xs space-y-2">
                <div className="flex items-center justify-between text-zinc-600 border-b border-zinc-100 pb-1.5">
                  <span className="font-semibold">Operating Entity:</span>
                  <span className="font-bold text-zinc-900">{LEGAL_CONFIG.LEGAL_BUSINESS_NAME}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-600 border-b border-zinc-100 pb-1.5">
                  <span className="font-semibold">Business Structure:</span>
                  <span className="text-zinc-700">{LEGAL_CONFIG.ORGANISATION_TYPE}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-600 border-b border-zinc-100 pb-1.5">
                  <span className="font-semibold">Product / Brand:</span>
                  <span className="font-bold text-zinc-900">{LEGAL_CONFIG.BRAND_NAME}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span className="font-semibold">Intended Payment Provider / Gateway Under Review:</span>
                  <span className="font-bold text-amber-700">
                    {orderData?.provider === 'razorpay' ? 'Razorpay' : 'Dodo Payments'}
                  </span>
                </div>
              </div>

              {/* Truthful Onboarding Notice */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Payment Gateway Onboarding in Progress</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  LazyProof is currently completing commercial merchant onboarding and verification with {orderData?.provider === 'razorpay' ? 'Razorpay' : 'Dodo Payments'}.
                </p>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Live payment collection can be enabled after merchant approval, valid live credentials, tax readiness and controlled production validation. No charges have been debited, and no fake QR codes or simulated transactions are permitted on this production domain.
                </p>
              </div>

              {/* Sandbox verification button (only in sandbox dev mode) */}
              {isSandbox && (
                <div className="pt-2 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={handleSandboxSimulate}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                  >
                    <span>Test Sandbox Settlement (Dev Only)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Dismiss Action */}
              <div className="pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 px-4 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-sm shadow-xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
                >
                  Understood
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Checkout Mode */}
          {step === 'checkout' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-center">
                <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                  Payable Total
                </div>
                <div className="text-3xl font-mono-numbers font-black text-zinc-950 mt-1">
                  ₹{orderData.amount.toLocaleString('en-IN')} INR
                </div>
                <div className="text-xs text-zinc-600 mt-1">
                  Order ID: <code className="font-mono font-bold text-zinc-900">{orderData.orderId}</code>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-zinc-200 bg-white text-xs space-y-2">
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Merchant:</span>
                  <span className="font-bold text-zinc-900">{LEGAL_CONFIG.LEGAL_BUSINESS_NAME}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Service:</span>
                  <span className="text-zinc-800 font-medium">Digital Sponsored Profile Placement</span>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Payment Gateway:</span>
                  <span className="font-bold text-emerald-700">
                    {orderData.provider === 'razorpay' ? 'Razorpay (Secured)' : 'Dodo Payments (Secured)'}
                  </span>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLaunchCheckout}
                    className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs cursor-pointer"
                  >
                    Retry Checkout
                  </button>
                </div>
              )}

              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={handleLaunchCheckout}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-[#e86638] hover:bg-[#d8582b] text-white font-black text-sm shadow-xs transition-all cursor-pointer"
                >
                  <span>{orderData.provider === 'razorpay' ? 'PROCEED TO RAZORPAY CHECKOUT' : 'PROCEED TO DODO PAYMENTS CHECKOUT'}</span>
                  <ExternalLink className="w-4 h-4 text-white" />
                </button>

                <button
                  type="button"
                  onClick={() => startStatusPolling(orderData.orderId)}
                  className="w-full py-2.5 px-4 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-semibold text-xs transition-colors cursor-pointer"
                >
                  I have completed payment — Verify status
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Polling / Awaiting Settlement */}
          {step === 'polling' && (
            <div className="py-10 text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-[#e86638] mx-auto" />
              <div className="space-y-1">
                <h4 className="text-base font-extrabold text-zinc-900">
                  Awaiting Payment Confirmation
                </h4>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Verifying transaction settlement with payment gateway. Your profile rank will update automatically once verified.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-600 max-w-xs mx-auto">
                Order ID: <code className="font-mono font-bold text-zinc-900">{orderData.orderId}</code>
              </div>
            </div>
          )}

          {/* STEP 4: Success & Digital Receipt */}
          {step === 'success' && completedProfile && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <h4 className="text-base font-black text-emerald-950">
                  Payment Confirmed & Rank Awarded!
                </h4>
                <p className="text-xs text-emerald-800">
                  Your sponsored profile is now active at <strong>Rank #{completedProfile.rank}</strong> on the public leaderboard.
                </p>
              </div>

              {/* Digital Receipt Card */}
              <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50 text-xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                  <div>
                    <div className="font-extrabold text-zinc-950 text-sm">{LEGAL_CONFIG.LEGAL_BUSINESS_NAME}</div>
                    <div className="text-[10px] text-zinc-500">{LEGAL_CONFIG.ORGANISATION_TYPE} • {LEGAL_CONFIG.APP_URL}</div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      PAID
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-zinc-600 text-[11px]">
                  <div>
                    <span className="block text-zinc-400">Receipt / Order ID:</span>
                    <strong className="text-zinc-900 font-mono">{orderData.orderId}</strong>
                  </div>
                  <div>
                    <span className="block text-zinc-400">Amount Paid:</span>
                    <strong className="text-zinc-900 font-mono">₹{orderData.amount.toLocaleString('en-IN')} INR</strong>
                  </div>
                  <div>
                    <span className="block text-zinc-400">Participant Name:</span>
                    <strong className="text-zinc-900">{orderData.name}</strong>
                  </div>
                  <div>
                    <span className="block text-zinc-400">Awarded Rank:</span>
                    <strong className="text-zinc-900">Rank #{completedProfile.rank}</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-200 text-[10px] text-zinc-500 leading-relaxed">
                  <strong>Service:</strong> Digital Sponsored Profile Placement on LazyProof leaderboard. Not a tax invoice. Delivery verified and fulfilled electronically.
                </div>
              </div>

              {/* Ownership persistence confirmation or recovery instruction */}
              {storageWarning ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-left space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Browser Storage Notice</span>
                  </div>
                  <p className="text-[11px] text-amber-950 leading-relaxed break-all">
                    {storageWarning}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50/90 border border-emerald-200/80 p-2.5 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Profile ownership token securely saved in this browser.</span>
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onPaymentSuccess(completedProfile, undefined, pendingOwnerToken ?? undefined);
                  }}
                  className="flex-1 py-3 px-4 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  View Profile on Leaderboard
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-800 font-bold text-xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Error State */}
          {step === 'error' && (
            <div className="py-8 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
              <h4 className="text-sm font-extrabold text-zinc-900">
                Payment Verification Notice
              </h4>
              <p className="text-xs text-rose-700 max-w-sm mx-auto leading-relaxed">
                {errorMessage}
              </p>
              <div className="pt-3 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep('disabled')}
                  className="px-4 py-2 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-zinc-200 text-zinc-700 text-xs font-bold hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
