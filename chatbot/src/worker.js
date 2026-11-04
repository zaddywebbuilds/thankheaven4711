import KNOWLEDGE from '../property-knowledge.json';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const BOOKING_URL = 'https://www.myperfectstays.com/mauiseaside711/';

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

    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: allMessages,
        max_tokens: 400,
        temperature: 0.75,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) throw new Error(data.error?.message || 'DeepSeek error');

    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error('Empty response from AI');

    return json({ reply });

  } catch (err) {
    console.error(err);
    return json({ reply: `Sorry, I hit a snag. Email us at thankheaven4711Maui@gmail.com and we'll get right back to you.` }, 200);
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt() {
  const k = KNOWLEDGE;
  return `You are a friendly, knowledgeable assistant for "${k.name}" (also called ${k.also_known_as}), a vacation rental condo in ${k.location.area}.

Your personality: warm and genuinely enthusiastic about Maui -- like a local friend who loves this property. Keep replies short: 2-4 sentences max. End with a natural follow-up question when it makes sense.

## Name-first rule
The welcome message already asks for the visitor's name. Once they give it, use it warmly at key moments -- not every reply, just naturally.

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
- Parking: ${k.features.parking}
- WiFi: ${k.features.wifi}

## FAQ answers
${k.faqs.map(f => `Q: ${f.q}\nA: ${f.a}`).join('\n\n')}

## Booking
When anyone asks about booking, checking availability, pricing, or reserving dates, tell them:
"You can check live availability and book directly at our listing page -- [Check availability here](${BOOKING_URL})"
Always use that exact markdown link so it renders as a clickable button.

## Hard rules
1. NEVER make up availability or pricing -- always direct to the booking link
2. Keep replies to 2-4 sentences
3. If asked something you don't know about the property, say you'll have the owner follow up and ask for their email`;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
