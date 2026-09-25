import KNOWLEDGE from '../property-knowledge.json';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/chat') {
      return handleChat(request, env);
    }

    return new Response('Not found', { status: 404, headers: CORS });
  },
};

// ─── Chat handler ────────────────────────────────────────────────────────────

async function handleChat(request, env) {
  try {
    const { messages } = await request.json();
    if (!Array.isArray(messages)) throw new Error('messages required');

    const systemPrompt = buildSystemPrompt();
    const allMessages = [{ role: 'system', content: systemPrompt }, ...messages];

    const tools = [
      {
        type: 'function',
        function: {
          name: 'check_availability',
          description: 'Check if dates are available and calculate the total rate. Call this whenever the visitor asks about dates, availability, or pricing.',
          parameters: {
            type: 'object',
            properties: {
              check_in:  { type: 'string', description: 'Check-in date YYYY-MM-DD' },
              check_out: { type: 'string', description: 'Check-out date YYYY-MM-DD' },
              guests:    { type: 'integer', description: 'Number of guests (1-4)' },
            },
            required: ['check_in', 'check_out', 'guests'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'save_lead',
          description: 'Save visitor contact info and enquiry to Google Sheets. Call as soon as you have an email address.',
          parameters: {
            type: 'object',
            properties: {
              name:      { type: 'string' },
              email:     { type: 'string' },
              phone:     { type: 'string' },
              check_in:  { type: 'string' },
              check_out: { type: 'string' },
              guests:    { type: 'integer' },
              status:    { type: 'string', enum: ['new_lead', 'availability_checked', 'quote_sent', 'booking_started'] },
              notes:     { type: 'string' },
            },
            required: ['email', 'status'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'create_checkout',
          description: 'Create a Stripe Checkout link so the visitor can pay and confirm their booking.',
          parameters: {
            type: 'object',
            properties: {
              check_in:    { type: 'string' },
              check_out:   { type: 'string' },
              guests:      { type: 'integer' },
              guest_name:  { type: 'string' },
              guest_email: { type: 'string' },
              total_cents: { type: 'integer', description: 'Total amount in cents including taxes and fees' },
            },
            required: ['check_in', 'check_out', 'guests', 'guest_email', 'total_cents'],
          },
        },
      },
    ];

    // Agentic loop — OpenAI may call tools before giving a final reply
    let loopMessages = [...allMessages];

    for (let i = 0; i < 6; i++) {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: loopMessages,
          tools,
          tool_choice: 'auto',
          max_tokens: 600,
          temperature: 0.75,
        }),
      });

      const data = await resp.json();

      if (!resp.ok) throw new Error(data.error?.message || 'OpenAI error');

      const choice = data.choices[0];

      if (choice.finish_reason === 'tool_calls') {
        loopMessages.push(choice.message);

        for (const call of choice.message.tool_calls) {
          const args = JSON.parse(call.function.arguments);
          let result;

          switch (call.function.name) {
            case 'check_availability': result = await checkAvailability(args, env); break;
            case 'save_lead':          result = await saveLead(args, env);          break;
            case 'create_checkout':    result = await createCheckout(args, env);    break;
            default: result = { error: 'unknown tool' };
          }

          loopMessages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
      } else {
        // Text reply — done
        const reply = choice.message.content;
        return json({ reply });
      }
    }

    return json({ reply: 'I ran into an issue. Please try again or email us directly.' });

  } catch (err) {
    console.error(err);
    return json({ error: err.message }, 500);
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt() {
  const k = KNOWLEDGE;
  return `You are a warm, knowledgeable booking assistant for "${k.name}" (also called ${k.also_known_as}), a vacation rental condo in ${k.location.area}.

Your personality: friendly and genuinely enthusiastic about Maui — like a local friend who loves this property. Never pushy, but naturally guide every conversation toward dates, availability, and booking.

## Name-first rule (IMPORTANT)
The welcome message already asks the visitor for their name. Their very first reply will likely be their name. Once you have it, use it naturally throughout the conversation — not every single message, but warmly at key moments (when confirming availability, when generating a booking link, etc). Never forget the name once given.

## Property at a glance
- ${k.features.lanai}
- ${k.location.description}
- ${k.wildlife.turtles}
- ${k.wildlife.whales}
- ${k.wildlife.reef}
- ${k.features.kitchen}
- Max occupancy: ${k.unit.max_occupancy} guests
- Check-in ${k.policies.check_in} / Check-out ${k.policies.check_out}
- Minimum stay: ${k.policies.minimum_stay} nights

## FAQ answers
${k.faqs.map(f => `Q: ${f.q}\nA: ${f.a}`).join('\n\n')}

## Your sales flow (natural, not robotic)
property question → mention dates → call check_availability → capture email → confirm quote → create_checkout

## Hard rules
1. NEVER invent availability — always call check_availability for any date/pricing question
2. Capture the visitor's email BEFORE calling create_checkout
3. Call save_lead as soon as you have an email, even if they haven't committed to dates
4. Keep replies short: 2-4 sentences max
5. End every reply with a soft question that moves the conversation forward
6. If they ask about rate/cost before giving dates, ask for the dates first then call check_availability`;
}

// ─── Tool implementations ─────────────────────────────────────────────────────

async function checkAvailability({ check_in, check_out, guests }, env) {
  try {
    const nights = Math.round((new Date(check_out) - new Date(check_in)) / 86400000);

    if (nights < KNOWLEDGE.policies.minimum_stay) {
      return { available: false, reason: 'minimum_stay', minimum_nights: KNOWLEDGE.policies.minimum_stay };
    }
    if (guests > KNOWLEDGE.unit.max_occupancy) {
      return { available: false, reason: 'max_occupancy', max_guests: KNOWLEDGE.unit.max_occupancy };
    }
    if (nights <= 0) {
      return { available: false, reason: 'invalid_dates' };
    }

    // Skip live calendar check if Google credentials not configured (demo mode)
    const hasGoogle = env.GOOGLE_CALENDAR_ID && env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

    if (hasGoogle) {
      const token = await getGoogleToken(env);
      const fbResp = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeMin: `${check_in}T00:00:00Z`,
          timeMax: `${check_out}T23:59:59Z`,
          items: [{ id: env.GOOGLE_CALENDAR_ID }],
        }),
      });
      const fbData = await fbResp.json();
      const busy = fbData.calendars?.[env.GOOGLE_CALENDAR_ID]?.busy || [];
      if (busy.length > 0) {
        return { available: false, reason: 'booked', check_in, check_out };
      }
    }
    // In demo mode: dates always show as available

    // Pricing
    const nightlyRate = parseInt(env.NIGHTLY_RATE_CENTS || '35000') / 100;
    const cleaningFee = parseInt(env.CLEANING_FEE_CENTS || '17500') / 100;
    const taxRate     = parseFloat(env.TAX_RATE         || '0.1496');

    const subtotal   = (nightlyRate * nights) + cleaningFee;
    const tax        = Math.round(subtotal * taxRate * 100) / 100;
    const total      = Math.round((subtotal + tax) * 100) / 100;
    const totalCents = Math.round(total * 100);

    return { available: true, nights, nightly_rate: nightlyRate, cleaning_fee: cleaningFee, subtotal, tax, total, total_cents: totalCents, check_in, check_out };

  } catch (err) {
    return { available: false, reason: 'error', error: err.message };
  }
}

async function saveLead({ name, email, phone, check_in, check_out, guests, status, notes }, env) {
  // Skip Sheets write if Google credentials not configured (demo mode)
  const hasSheets = env.GOOGLE_SHEETS_ID && env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!hasSheets) {
    console.log('Demo mode: lead not saved to Sheets —', email, check_in, check_out);
    return { success: true, demo: true };
  }

  try {
    const token = await getGoogleToken(env);

    const now = new Date().toLocaleString('en-US', { timeZone: 'Pacific/Honolulu' });
    const row = [now, name || '', email, phone || '', check_in || '', check_out || '', guests || '', 'Website Chatbot', notes || '', status, '', '', 'Pending', 'Enquiry'];

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEETS_ID}/values/Leads!A:N:append?valueInputOption=USER_ENTERED`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Sheets ${resp.status}: ${err}`);
    }

    return { success: true };
  } catch (err) {
    console.error('saveLead error:', err);
    return { success: false, error: err.message };
  }
}

async function createCheckout({ check_in, check_out, guests, guest_name, guest_email, total_cents }, env) {
  const nights    = Math.round((new Date(check_out) - new Date(check_in)) / 86400000);
  const siteUrl   = env.SITE_URL || 'https://www.mauisandsseaside.com';
  const nightRate = parseInt(env.NIGHTLY_RATE_CENTS || '35000') / 100;
  const cleaning  = parseInt(env.CLEANING_FEE_CENTS || '17500') / 100;
  const taxRate   = parseFloat(env.TAX_RATE || '0.1496');
  const subtotal  = (nightRate * nights) + cleaning;
  const tax       = Math.round(subtotal * taxRate * 100) / 100;

  // Use real Stripe when key is configured, otherwise mock checkout page
  if (env.STRIPE_SECRET_KEY) {
    try {
      const body = new URLSearchParams({
        mode: 'payment',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][product_data][name]': `O thank Heaven 4 711 — ${nights} nights`,
        'line_items[0][price_data][product_data][description]': `${check_in} to ${check_out}, ${guests} guest${guests > 1 ? 's' : ''}`,
        'line_items[0][price_data][unit_amount]': String(total_cents),
        'line_items[0][quantity]': '1',
        customer_email: guest_email,
        success_url: `${siteUrl}?booking=confirmed`,
        cancel_url:  `${siteUrl}?booking=cancelled`,
        'metadata[check_in]':   check_in,
        'metadata[check_out]':  check_out,
        'metadata[guests]':     String(guests),
        'metadata[guest_name]': guest_name || '',
      });

      const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(env.STRIPE_SECRET_KEY + ':')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const session = await resp.json();
      if (session.error) throw new Error(session.error.message);
      return { success: true, checkout_url: session.url };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Demo mode: link to the on-site mock checkout page
  const params = new URLSearchParams({
    checkin:  check_in,
    checkout: check_out,
    guests:   String(guests),
    nights:   String(nights),
    nightly:  String(nightRate),
    cleaning: String(cleaning),
    tax:      String(tax),
    total:    String(Math.round((subtotal + tax) * 100) / 100),
    email:    guest_email || '',
  });

  return { success: true, checkout_url: `${siteUrl}/checkout.html?${params.toString()}` };
}

// ─── Google auth (service account JWT) ───────────────────────────────────────

async function getGoogleToken(env) {
  const now = Math.floor(Date.now() / 1000);

  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss:   env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/spreadsheets',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now,
  }));

  const sigInput = `${header}.${payload}`;

  const pem     = env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  const pemBody = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, '');
  const keyBytes = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    'pkcs8', keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(sigInput));
  const jwt = `${sigInput}.${b64url(sig)}`;

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResp.json();
  if (!tokenData.access_token) throw new Error(`Google auth failed: ${JSON.stringify(tokenData)}`);
  return tokenData.access_token;
}

function b64url(data) {
  const str = typeof data === 'string' ? data : String.fromCharCode(...new Uint8Array(data));
  return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
