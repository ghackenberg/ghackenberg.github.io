/**
 * Privacy-First Newsletter Subscription & ALTCHA Proof-of-Work Client
 * Connects static Astro pages to the self-hosted Listmonk instance (https://news.hackenberg.tech)
 * with zero cookies, zero tracking, and client-side SHA-256 Proof-of-Work spam protection.
 */

const LISTMONK_PROD_ORIGIN = 'https://news.hackenberg.tech';
const LISTMONK_LIST_UUID = 'b38e9b53-59e6-4ab3-8a67-d047041a9e0e';
const ALTCHA_TOKEN_TTL_MS = 4 * 60 * 1000; // Re-solve if older than 4 minutes

export interface AltchaChallenge {
  algorithm: string;
  challenge: string;
  maxNumber?: number;
  maxnumber?: number;
  salt: string;
  signature: string;
}

export interface AltchaSolutionPayload {
  payload: string;
  took: number;
  createdAt: number;
}

function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

function getAltchaEndpoint(): string {
  return isLocalhost()
    ? '/__dev/listmonk/altcha'
    : `${LISTMONK_PROD_ORIGIN}/api/public/captcha/altcha`;
}

function getSubscriptionEndpoint(): string {
  return isLocalhost()
    ? '/__dev/listmonk/subscription'
    : `${LISTMONK_PROD_ORIGIN}/subscription/form`;
}

/**
 * Self-contained Web Worker script that solves SHA-256 Proof-of-Work
 * (`hex(sha256(salt + n)) === challenge`) using integer word comparison
 * with zero per-iteration hex string allocation.
 */
const WORKER_SCRIPT = `
const K = new Int32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

function solvePoW(salt, challengeHex, maxNumber) {
  const t0 = parseInt(challengeHex.slice(0, 8), 16) | 0;
  const t1 = parseInt(challengeHex.slice(8, 16), 16) | 0;
  const t2 = parseInt(challengeHex.slice(16, 24), 16) | 0;
  const t3 = parseInt(challengeHex.slice(24, 32), 16) | 0;
  const t4 = parseInt(challengeHex.slice(32, 40), 16) | 0;
  const t5 = parseInt(challengeHex.slice(40, 48), 16) | 0;
  const t6 = parseInt(challengeHex.slice(48, 56), 16) | 0;
  const t7 = parseInt(challengeHex.slice(56, 64), 16) | 0;

  const encoder = new TextEncoder();
  const W = new Int32Array(64);
  const block = new Uint8Array(128);
  const view = new DataView(block.buffer);

  for (let n = 0; n <= maxNumber; n++) {
    const bytes = encoder.encode(salt + n);
    const len = bytes.length;
    const bitLen = len * 8;
    const totalBlocks = ((len + 9 + 63) >> 6);
    const totalBytes = totalBlocks << 6;

    block.fill(0, 0, totalBytes);
    block.set(bytes, 0);
    block[len] = 0x80;
    view.setUint32(totalBytes - 4, bitLen, false);

    let h0 = 0x6a09e667 | 0;
    let h1 = 0xbb67ae85 | 0;
    let h2 = 0x3c6ef372 | 0;
    let h3 = 0xa54ff53a | 0;
    let h4 = 0x510e527f | 0;
    let h5 = 0x9b05688c | 0;
    let h6 = 0x1f83d9ab | 0;
    let h7 = 0x5be0cd19 | 0;

    for (let offset = 0; offset < totalBytes; offset += 64) {
      for (let i = 0; i < 16; i++) {
        W[i] = view.getInt32(offset + (i << 2), false);
      }
      for (let i = 16; i < 64; i++) {
        const v1 = W[i - 15];
        const s0 = ((v1 >>> 7) | (v1 << 25)) ^ ((v1 >>> 18) | (v1 << 14)) ^ (v1 >>> 3);
        const v2 = W[i - 2];
        const s1 = ((v2 >>> 17) | (v2 << 15)) ^ ((v2 >>> 19) | (v2 << 13)) ^ (v2 >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }

      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + K[i] + W[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) | 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) | 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) | 0;
      }

      h0 = (h0 + a) | 0;
      h1 = (h1 + b) | 0;
      h2 = (h2 + c) | 0;
      h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0;
      h5 = (h5 + f) | 0;
      h6 = (h6 + g) | 0;
      h7 = (h7 + h) | 0;
    }

    if (
      h0 === t0 && h1 === t1 && h2 === t2 && h3 === t3 &&
      h4 === t4 && h5 === t5 && h6 === t6 && h7 === t7
    ) {
      return n;
    }
  }
  return -1;
}

self.onmessage = function(e) {
  const { salt, challenge, maxNumber } = e.data;
  const start = performance.now();
  const number = solvePoW(salt, challenge, maxNumber);
  const took = Math.max(1, Math.round(performance.now() - start));
  self.postMessage({ number, took });
};
`;

async function solveChallengeInWorker(
  salt: string,
  challenge: string,
  maxNumber: number
): Promise<{ number: number; took: number }> {
  if (typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
    try {
      return await new Promise<{ number: number; took: number }>((resolve, reject) => {
        const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const worker = new Worker(url);

        const cleanup = () => {
          worker.terminate();
          URL.revokeObjectURL(url);
        };

        worker.onmessage = (e: MessageEvent<{ number: number; took: number }>) => {
          cleanup();
          if (e.data && typeof e.data.number === 'number' && e.data.number >= 0) {
            resolve(e.data);
          } else {
            reject(new Error('ALTCHA Proof-of-Work solution not found within maxNumber'));
          }
        };

        worker.onerror = (err) => {
          cleanup();
          reject(err);
        };

        worker.postMessage({ salt, challenge, maxNumber });
      });
    } catch {
      // Fallback to SubtleCrypto below if inline Blob Worker is blocked by CSP
    }
  }

  // Fallback: chunked WebCrypto SHA-256 on main thread
  const start = performance.now();
  const encoder = new TextEncoder();
  const targetHex = challenge.toLowerCase();

  for (let n = 0; n <= maxNumber; n++) {
    const data = encoder.encode(salt + String(n));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    let hex = '';
    for (let i = 0; i < hashArray.length; i++) {
      hex += hashArray[i].toString(16).padStart(2, '0');
    }
    if (hex === targetHex) {
      const took = Math.max(1, Math.round(performance.now() - start));
      return { number: n, took };
    }
  }

  throw new Error('ALTCHA Proof-of-Work solution not found');
}

async function fetchAndSolveAltcha(): Promise<AltchaSolutionPayload> {
  const res = await fetch(getAltchaEndpoint(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'omit',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ALTCHA challenge (HTTP ${res.status})`);
  }

  const data = (await res.json()) as AltchaChallenge;
  const maxNumber = data.maxNumber ?? data.maxnumber ?? 300000;
  const { number, took } = await solveChallengeInWorker(data.salt, data.challenge, maxNumber);

  const encoded = btoa(
    JSON.stringify({
      algorithm: data.algorithm || 'SHA-256',
      challenge: data.challenge,
      number,
      salt: data.salt,
      signature: data.signature,
      took,
    })
  );

  return {
    payload: encoded,
    took,
    createdAt: Date.now(),
  };
}

function wireNewsletterForm(form: HTMLFormElement): void {
  if (form.getAttribute('data-initialized') === 'true') return;
  form.setAttribute('data-initialized', 'true');

  const emailInput = form.querySelector<HTMLInputElement>('input[name="email"]');
  const nonceInput = form.querySelector<HTMLInputElement>('input[name="nonce"]');
  const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const submitLabel = form.querySelector<HTMLElement>('[data-submit-label]');
  const submitSpinner = form.querySelector<HTMLElement>('[data-submit-spinner]');
  const altchaTrigger = form.querySelector<HTMLElement>('[data-altcha-trigger]');
  const altchaStatus = form.querySelector<HTMLElement>('[data-altcha-status]');
  const altchaIconIdle = form.querySelector<HTMLElement>('[data-altcha-icon="idle"]');
  const altchaIconVerifying = form.querySelector<HTMLElement>('[data-altcha-icon="verifying"]');
  const altchaIconVerified = form.querySelector<HTMLElement>('[data-altcha-icon="verified"]');
  const feedbackEl = form.querySelector<HTMLElement>('[data-newsletter-feedback]');

  let cachedSolution: AltchaSolutionPayload | null = null;
  let activeSolvePromise: Promise<AltchaSolutionPayload> | null = null;
  let isSubmitting = false;

  function setAltchaState(state: 'idle' | 'verifying' | 'verified' | 'error', labelText?: string) {
    if (altchaTrigger) {
      altchaTrigger.setAttribute('data-state', state);
    }
    if (altchaStatus && labelText) {
      altchaStatus.textContent = labelText;
    }
    altchaIconIdle?.classList.toggle('hidden', state !== 'idle' && state !== 'error');
    altchaIconVerifying?.classList.toggle('hidden', state !== 'verifying');
    altchaIconVerified?.classList.toggle('hidden', state !== 'verified');
  }

  function showFeedback(type: 'success' | 'error' | 'none', message = '') {
    if (!feedbackEl) return;
    if (type === 'none' || !message) {
      feedbackEl.classList.add('hidden');
      feedbackEl.textContent = '';
      return;
    }
    feedbackEl.classList.remove('hidden', 'text-brand-green', 'bg-brand-green/10', 'border-brand-green/30', 'text-callout-caution', 'bg-callout-caution/10', 'border-callout-caution/30');
    if (type === 'success') {
      feedbackEl.classList.add('text-brand-green', 'bg-brand-green/10', 'border-brand-green/30');
    } else {
      feedbackEl.classList.add('text-callout-caution', 'bg-callout-caution/10', 'border-callout-caution/30');
    }
    feedbackEl.textContent = message;
  }

  function ensureAltchaSolution(forceFresh = false): Promise<AltchaSolutionPayload> {
    if (
      !forceFresh &&
      cachedSolution &&
      Date.now() - cachedSolution.createdAt < ALTCHA_TOKEN_TTL_MS
    ) {
      return Promise.resolve(cachedSolution);
    }

    if (!forceFresh && activeSolvePromise) {
      return activeSolvePromise;
    }

    cachedSolution = null;
    setAltchaState('verifying', 'Verifying...');

    activeSolvePromise = fetchAndSolveAltcha()
      .then((solution) => {
        cachedSolution = solution;
        activeSolvePromise = null;
        setAltchaState('verified', 'Verified');
        return solution;
      })
      .catch((err) => {
        activeSolvePromise = null;
        setAltchaState('error', 'Protected by ALTCHA');
        throw err;
      });

    return activeSolvePromise;
  }

  // Pre-warm ALTCHA when focusing the email input
  emailInput?.addEventListener('focus', () => {
    showFeedback('none');
    if (!cachedSolution || Date.now() - cachedSolution.createdAt >= ALTCHA_TOKEN_TTL_MS) {
      ensureAltchaSolution().catch(() => {
        // Silent pre-warm failure; will retry on submit
      });
    }
  });

  // Allow manual trigger via the ALTCHA badge
  altchaTrigger?.addEventListener('click', (e) => {
    e.preventDefault();
    ensureAltchaSolution(false).catch(() => {
      // Handled by state update
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const email = (emailInput?.value || '').trim();
    const honeypotValue = nonceInput?.value || '';

    if (!email || !email.includes('@')) {
      showFeedback('error', 'Please enter a valid email address.');
      emailInput?.focus();
      return;
    }

    isSubmitting = true;
    showFeedback('none');
    if (submitBtn) submitBtn.disabled = true;
    if (submitLabel) submitLabel.textContent = 'Subscribing...';
    submitSpinner?.classList.remove('hidden');

    try {
      const solution = await ensureAltchaSolution(false);

      const body = new URLSearchParams({
        email,
        l: LISTMONK_LIST_UUID,
        nonce: honeypotValue,
        altcha: solution.payload,
      });

      const res = await fetch(getSubscriptionEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        credentials: 'omit',
      });

      if (res.ok) {
        showFeedback(
          'success',
          'Almost done! Please check your inbox and click the confirmation link to complete your subscription.'
        );
        if (emailInput) emailInput.value = '';
        cachedSolution = null;
        setAltchaState('idle', 'Protected by ALTCHA');
      } else {
        const text = await res.text().catch(() => '');
        cachedSolution = null;
        setAltchaState('idle', 'Protected by ALTCHA');

        if (text.includes('Ungültige E-Mail') || text.toLowerCase().includes('invalid email')) {
          showFeedback('error', 'Please enter a valid email address.');
        } else if (text.includes('Ungültiges CAPTCHA') || text.toLowerCase().includes('captcha')) {
          showFeedback('error', 'Anti-spam verification expired. Please try again.');
          ensureAltchaSolution(true).catch(() => {});
        } else {
          showFeedback('error', 'Subscription failed. Please try again in a moment.');
        }
      }
    } catch {
      cachedSolution = null;
      setAltchaState('idle', 'Protected by ALTCHA');
      showFeedback('error', 'Subscription failed. Please check your connection and try again.');
    } finally {
      isSubmitting = false;
      if (submitBtn) submitBtn.disabled = false;
      if (submitLabel) submitLabel.textContent = 'Subscribe';
      submitSpinner?.classList.add('hidden');
    }
  });
}

export function initNewsletterForms(): void {
  if (typeof document === 'undefined') return;
  const forms = document.querySelectorAll<HTMLFormElement>('form[data-newsletter-form]');
  forms.forEach(wireNewsletterForm);
}
