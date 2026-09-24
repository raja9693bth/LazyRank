import React, { useState, useEffect } from 'react';
import { X, AlertCircle, ShieldAlert, Loader2, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile } from '../types.ts';

interface PaymentModalProps {
  orderData: {
    orderId: string;
    name: string;
    amount: number;
    currency: string;
    isTop: boolean;
    topAmount: number;
    minAmountToBeatTop: number;
    profileId?: string;
    instagram?: string;
    linkedin?: string;
    website?: string;
    reason?: string;
    paymentMode?: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (profile: UserProfile, previousTop?: UserProfile, ownerToken?: string) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  orderData,
  isOpen,
  onClose,
  onPaymentSuccess
}) => {
  const [step, setStep] = useState<'disabled' | 'verifying' | 'success' | 'error'>('disabled');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep('disabled');
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Escape key handler for accessible modal dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'verifying') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, step]);

  if (!isOpen || !orderData) return null;

  // Sandbox-only verification attempt (strictly rejected by production backend)
  const handleSandboxVerify = async () => {
    setStep('verifying');
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
          reason: orderData.reason,
          profileId: orderData.profileId,
          ownerToken: storedOwnerToken
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success || !data.profile) {
        throw new Error(data.error || 'Payment verification is unavailable.');
      }

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
      setTimeout(() => {
        onPaymentSuccess(data.profile, data.previousTop, data.ownerToken);
      }, 950);
    } catch (err: any) {
      setStep('error');
      setErrorMessage(err?.message || 'Payment processing is currently unavailable.');
    }
  };

  const isSandbox = orderData.paymentMode === 'sandbox' || (import.meta as any).env?.VITE_PAYMENT_MODE === 'sandbox';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-xs p-4 overflow-y-auto" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
        className="relative w-full max-w-md rounded-2xl bg-white border border-zinc-200 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 bg-zinc-50/50">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <h3 id="payment-modal-title" className="text-sm font-extrabold text-zinc-900 uppercase tracking-wider">
              Payment Status
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment modal"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5">
          {step === 'disabled' && (
            <div className="space-y-4">
              {/* Order Summary Box */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-center">
                <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                  Target Amount
                </div>
                <div className="text-3xl font-mono-numbers font-black text-zinc-950 mt-1">
                  ₹{orderData.amount.toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-zinc-600 mt-1">
                  Participant: <strong className="text-zinc-900">{orderData.name}</strong>
                  {orderData.isTop && (
                    <span className="ml-1 text-amber-700 font-bold">(Target: #1 Rank)</span>
                  )}
                </div>
              </div>

              {/* Truthful Payment Disabled State */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Payments Currently Unavailable</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Payments are currently unavailable until payment processing is enabled. Payment gateway onboarding and compliance approvals are in progress.
                </p>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  No charges have been made and no fake transactions will be processed. You can participate as an unverified participant in the meantime.
                </p>
              </div>

              {isSandbox && (
                <div className="pt-2 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={handleSandboxVerify}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                  >
                    <span>Test Sandbox Verification (Dev Only)</span>
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

          {step === 'verifying' && (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-950 mx-auto" />
              <h4 className="text-sm font-extrabold text-zinc-900">
                Testing Sandbox Verification...
              </h4>
            </div>
          )}

          {step === 'error' && (
            <div className="py-8 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
              <h4 className="text-sm font-extrabold text-zinc-900">
                Payment Unavailable
              </h4>
              <p className="text-xs text-rose-600 max-w-xs mx-auto">
                {errorMessage}
              </p>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => setStep('disabled')}
                  className="px-4 py-2 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
