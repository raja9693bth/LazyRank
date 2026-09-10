import React, { useState } from 'react';
import { LegalPageLayout } from '../components/LegalPageLayout';
import { Mail, ShieldCheck, AlertCircle, CheckCircle, Send, Clock, HelpCircle, Lock } from 'lucide-react';

interface ContactPageProps {
  onNavigate: (path: string) => void;
}

export const ContactPage: React.FC<ContactPageProps> = ({ onNavigate }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Payment Query');
  const [orderId, setOrderId] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !email.trim() || !message.trim()) {
      setErrorMessage('Please fill in your name, email address, and message.');
      return;
    }

    // Basic email format check
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject,
          orderId: orderId.trim() || undefined,
          message: message.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit inquiry. Please try again or email us directly.');
      }

      setSubmitted(true);
      setName('');
      setEmail('');
      setOrderId('');
      setMessage('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong. Please email raja@xaivon.com directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LegalPageLayout
      title="Contact Us"
      subtitle="Have a question about your rank, payment verification, duplicate charges, or content moderation? We're here to help."
      lastUpdated="September 10, 2026"
      currentPath="/contact"
      onNavigate={onNavigate}
    >
      {/* Official Business Identity Information */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-2">
        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200">
          <div className="flex items-center gap-2 mb-2 text-zinc-950 font-bold text-sm">
            <Mail className="w-4 h-4 text-amber-600" />
            <span>Direct Email Support</span>
          </div>
          <p className="text-xs text-zinc-600 mb-2">
            Write to us for any urgent issues or inquiries:
          </p>
          <a
            href="mailto:raja@xaivon.com"
            className="inline-block text-sm font-black text-amber-900 bg-amber-100/80 px-3 py-1.5 rounded-lg border border-amber-300 hover:bg-amber-200 transition-colors"
          >
            raja@xaivon.com
          </a>
          <p className="text-[11px] text-zinc-400 mt-2">
            Average response time: within 24 to 48 hours on business days.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200">
          <div className="flex items-center gap-2 mb-2 text-zinc-950 font-bold text-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Business Association</span>
          </div>
          <p className="text-xs text-zinc-700 font-medium">
            <strong>Platform:</strong> LAZY (Public Pay-to-Rank Experience)
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            <strong>Operating Entity:</strong> Associated with XAIVON / [INSERT VERIFIED LEGAL BUSINESS NAME]
          </p>
          <p className="text-[11px] text-zinc-500 mt-2">
            Jurisdiction: Republic of India
          </p>
        </div>
      </div>

      {/* When to Contact Support */}
      <section className="space-y-2 mt-6">
        <h2 className="text-base font-bold text-zinc-950">
          What We Can Help You With:
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-700">
          <li className="p-2.5 rounded-lg bg-white border border-zinc-200">
            <strong>1. Payment Status:</strong> Checking unconfirmed or debited transactions.
          </li>
          <li className="p-2.5 rounded-lg bg-white border border-zinc-200">
            <strong>2. Rank Verification:</strong> Resolving rank sync or server verification delays.
          </li>
          <li className="p-2.5 rounded-lg bg-white border border-zinc-200">
            <strong>3. Duplicate Debits:</strong> Initiating refunds for unintentional double payments.
          </li>
          <li className="p-2.5 rounded-lg bg-white border border-zinc-200">
            <strong>4. Content Moderation:</strong> Reporting abusive, defamatory, or infringing profiles.
          </li>
        </ul>
      </section>

      {/* Interactive Contact Form */}
      <section className="mt-8 pt-6 border-t border-zinc-200">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-zinc-950">
            Send an On-Site Message
          </h2>
          <p className="text-xs text-zinc-600">
            Fill out the form below and our team will receive your message immediately.
          </p>
        </div>

        {submitted ? (
          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs sm:text-sm space-y-2">
            <div className="flex items-center gap-2 font-black text-emerald-900 text-base">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span>Inquiry Received Successfully!</span>
            </div>
            <p className="leading-relaxed">
              Thank you for reaching out. We have received your message. Our support desk (<a href="mailto:raja@xaivon.com" className="font-bold underline">raja@xaivon.com</a>) will review your query and respond via email within 24–48 hours.
            </p>
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer"
            >
              Send Another Message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs">
            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="contact-name" className="block text-xs font-bold text-zinc-800 mb-1">
                  Your Full Name *
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950"
                />
              </div>

              <div>
                <label htmlFor="contact-email" className="block text-xs font-bold text-zinc-800 mb-1">
                  Your Email Address *
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. rahul@example.com"
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="contact-subject" className="block text-xs font-bold text-zinc-800 mb-1">
                  Topic / Category *
                </label>
                <select
                  id="contact-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 bg-white"
                >
                  <option value="Payment Query">Payment Query / Unconfirmed Debit</option>
                  <option value="Rank Verification">Rank Verification / Update</option>
                  <option value="Duplicate Refund">Duplicate Charge / Refund Request</option>
                  <option value="Report Content">Report Inappropriate Content / Profile</option>
                  <option value="Technical Bug">Technical Issue / Bug Report</option>
                  <option value="General Inquiry">General Inquiry</option>
                </select>
              </div>

              <div>
                <label htmlFor="contact-order" className="block text-xs font-bold text-zinc-800 mb-1">
                  Order ID or Profile Name <span className="text-zinc-400 font-normal">(Optional)</span>
                </label>
                <input
                  id="contact-order"
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="e.g. ord_abc123 or Rank #4"
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950"
                />
              </div>
            </div>

            <div>
              <label htmlFor="contact-message" className="block text-xs font-bold text-zinc-800 mb-1">
                Detailed Message *
              </label>
              <textarea
                id="contact-message"
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your issue with transaction dates, amounts, or profile details..."
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <span>
                  Protected under our{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate('/privacy')}
                    className="underline text-zinc-700 hover:text-zinc-950 cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                  .
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-black tracking-wide shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Sending...' : 'Send Message'}</span>
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Security Warning Notice */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs mt-6 flex items-start gap-2.5">
        <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <strong className="block text-amber-900 font-bold mb-0.5">Security Notice</strong>
          <span>
            LAZY and XAIVON representatives will <strong>NEVER</strong> ask for your UPI PIN, ATM PIN, net banking password, or card CVV. Never share sensitive banking credentials with anyone.
          </span>
        </div>
      </div>
    </LegalPageLayout>
  );
};
