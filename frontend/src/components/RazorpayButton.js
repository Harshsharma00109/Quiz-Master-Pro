// PATH: quiz-platform/frontend/src/components/RazorpayButton.jsx

import React, { useState, useCallback } from 'react';
import api from '../utils/api';

const loadRazorpayScript = () =>
  new Promise(resolve => {
    if (window.Razorpay) { resolve(true); return; }
    if (document.getElementById('rzp-script')) {
      const poll = setInterval(() => {
        if (window.Razorpay) { clearInterval(poll); resolve(true); }
      }, 100);
      setTimeout(() => { clearInterval(poll); resolve(!!window.Razorpay); }, 10000);
      return;
    }
    const s   = document.createElement('script');
    s.id      = 'rzp-script';
    s.src     = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

export default function RazorpayButton({
  amount,
  plan,
  billingCycle,
  planColor,
  planEmoji,
  planName,
  onSuccess,
  onCancel,
}) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handlePay = useCallback(async () => {
    setError('');
    setLoading(true);

    try {
      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay) {
        throw new Error('Could not load Razorpay. Check your internet connection.');
      }

      let order;
      try {
        const { data } = await api.post('/razorpay/create-order', {
          amount,
          plan,
          billing_cycle: billingCycle,
        });
        order = data;
      } catch (orderErr) {
        throw new Error(
          orderErr.response?.data?.error ||
          orderErr.response?.data?.details ||
          'Failed to create payment order. Please try again.'
        );
      }

      if (!order?.order_id) throw new Error('Invalid order response from server.');

      // Get user info for prefill
      let prefillName = '', prefillEmail = '', prefillContact = '';
      try {
        const { data: me } = await api.get('/auth/me');
        prefillName    = me?.username || '';
        prefillEmail   = me?.email    || '';
        prefillContact = me?.phone    || '';
      } catch { /* optional */ }

      const isTestMode = process.env.REACT_APP_RAZORPAY_KEY_ID?.startsWith('rzp_test_');

      const options = {
        key:         process.env.REACT_APP_RAZORPAY_KEY_ID,
        amount:      order.amount,
        currency:    order.currency || 'INR',
        order_id:    order.order_id,
        name:        'QuizMaster Pro',
        description: `${planEmoji || ''} ${planName} Plan — ${billingCycle}`,
        theme:       { color: planColor || '#8b5cf6' },

        prefill: {
          name:    prefillName,
          email:   prefillEmail,
          contact: prefillContact,
          // This forces the UPI ID input field to appear
          method:  'upi',
          vpa:     isTestMode ? 'success@razorpay' : '',
        },

        // DO NOT use custom config blocks in test mode —
        // they break the UPI collect flow. Only use in live mode.
        ...(isTestMode ? {} : {
          config: {
            display: {
              blocks: {
                upi_block: {
                  name: 'Pay via UPI',
                  instruments: [
                    { method: 'upi', flows: ['collect', 'intent', 'qr'] },
                  ],
                },
                other: {
                  name: 'Other Methods',
                  instruments: [
                    { method: 'card' },
                    { method: 'netbanking' },
                    { method: 'wallet' },
                    { method: 'emi' },
                  ],
                },
              },
              sequence: ['block.upi_block', 'block.other'],
              preferences: { show_default_blocks: true },
            },
          },
        }),

        notes: { plan, billing_cycle: billingCycle },

        handler: async (response) => {
          try {
            const { data: result } = await api.post('/razorpay/verify-payment', {
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              plan,
              billing_cycle: billingCycle,
              amount,
            });

            if (!result.success) throw new Error(result.error || 'Verification failed.');

            if (result.token) {
              localStorage.setItem('qm_token', result.token);
              try {
                const mod = await import('../utils/api');
                if (mod.default?.defaults?.headers?.common) {
                  mod.default.defaults.headers.common['Authorization'] = `Bearer ${result.token}`;
                }
              } catch { /* ignore */ }
            }

            setLoading(false);
            onSuccess?.(result.payment_id, result.token);

          } catch (verifyErr) {
            setError(
              verifyErr.response?.data?.error ||
              verifyErr.message ||
              'Payment verification failed. Please contact support with your payment ID.'
            );
            setLoading(false);
          }
        },

        modal: {
          ondismiss:     () => { setLoading(false); onCancel?.(); },
          escape:        false,
          backdropclose: false,
          animation:     true,
          confirm_close: true,
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on('payment.failed', (resp) => {
        const msg =
          resp?.error?.description ||
          resp?.error?.reason ||
          'Payment failed. Please try a different payment method.';
        setError(`❌ ${msg}`);
        setLoading(false);
        onCancel?.();
      });

      rzp.open();

    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }, [amount, plan, billingCycle, planColor, planEmoji, planName, onSuccess, onCancel]);

  const color = planColor || '#8b5cf6';
  const isTest = process.env.REACT_APP_RAZORPAY_KEY_ID?.startsWith('rzp_test_');

  return (
    <div style={{ marginBottom: 6 }}>
      <style>{`
        @keyframes rzp_spin { to { transform: rotate(360deg) } }
        .rzp-btn:hover:not(:disabled) { opacity: 0.88 !important; transform: translateY(-1px); }
        .rzp-btn:active:not(:disabled) { transform: translateY(0) !important; }
      `}</style>

      <button
        className="rzp-btn"
        onClick={handlePay}
        disabled={loading}
        style={{
          width:          '100%',
          background:     loading
            ? 'rgba(255,255,255,.06)'
            : `linear-gradient(135deg, ${color}, ${color}bb)`,
          border:         `1px solid ${color}55`,
          borderRadius:   10,
          padding:        '13px 20px',
          color:          '#fff',
          fontFamily:     'Syne, sans-serif',
          fontWeight:     800,
          fontSize:       '1rem',
          cursor:         loading ? 'not-allowed' : 'pointer',
          opacity:        loading ? 0.7 : 1,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            10,
          transition:     'opacity .2s, transform .15s',
          boxShadow:      loading ? 'none' : `0 4px 20px ${color}33`,
        }}
      >
        {loading ? (
          <>
            <span style={{
              width:          16,
              height:         16,
              border:         '2px solid rgba(255,255,255,.3)',
              borderTopColor: '#fff',
              borderRadius:   '50%',
              animation:      'rzp_spin .7s linear infinite',
              display:        'inline-block',
              flexShrink:     0,
            }} />
            Opening Payment…
          </>
        ) : (
          <>💳 Pay ₹{Math.round(amount / 100)} with Razorpay</>
        )}
      </button>

      {!loading && (
        <div style={{
          textAlign:     'center',
          fontSize:      '.67rem',
          color:         'var(--text3, #888)',
          marginTop:     5,
          letterSpacing: .3,
        }}>
          UPI · Cards · Net Banking · Wallets · EMI
        </div>
      )}

      {/* Test mode credentials box — only in development */}
      {isTest && !loading && (
        <div style={{
          background:   'rgba(234,179,8,.08)',
          border:       '1px solid rgba(234,179,8,.3)',
          borderRadius: 8,
          padding:      '10px 12px',
          marginTop:    8,
          fontSize:     '.76rem',
          color:        '#eab308',
          lineHeight:   1.7,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>🧪 Test Mode — use these credentials:</div>
          <div>• UPI ID: <code style={{ background: 'rgba(234,179,8,.15)', padding: '1px 5px', borderRadius: 4 }}>success@razorpay</code></div>
          <div>• Card: <code style={{ background: 'rgba(234,179,8,.15)', padding: '1px 5px', borderRadius: 4 }}>4111 1111 1111 1111</code> CVV: <code style={{ background: 'rgba(234,179,8,.15)', padding: '1px 5px', borderRadius: 4 }}>123</code> Exp: <code style={{ background: 'rgba(234,179,8,.15)', padding: '1px 5px', borderRadius: 4 }}>12/26</code></div>
          <div style={{ marginTop: 4, fontSize: '.7rem', opacity: .8 }}>No real money will be charged in test mode.</div>
        </div>
      )}

      {error && (
        <div style={{
          background:   'rgba(239,68,68,.1)',
          border:       '1px solid rgba(239,68,68,.25)',
          borderRadius: 8,
          padding:      '8px 12px',
          marginTop:    10,
          fontSize:     '.82rem',
          color:        '#ef4444',
          lineHeight:   1.4,
        }}>
          {error}
          <div style={{ marginTop: 4, fontSize: '.72rem', color: 'rgba(239,68,68,.7)' }}>
            Try the manual UPI option below or contact support.
          </div>
        </div>
      )}
    </div>
  );
}