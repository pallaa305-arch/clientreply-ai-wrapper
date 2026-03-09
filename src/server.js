import express from "express";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.static(path.resolve("public")));

app.get("/", (_, res) => {
  res.sendFile(path.resolve("public/index.html"));
});

app.get("/health", (_, res) => res.json({ ok: true }));

app.post("/api/generate", (req, res) => {
  const { userKey, leadText, budget, timeline, serviceType } = req.body || {};
  if (!userKey || !leadText || !budget || !timeline || !serviceType) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  return res.json({
    success: true,
    outputs: {
      whatsapp_reply: `I can handle this ${serviceType}. Timeline: ${timeline}. Budget around ${budget}.`,
      email_proposal: `Thanks for sharing: ${leadText}. I can deliver in ${timeline} within ${budget}.`,
      bid_pitch: `Experienced in ${serviceType}. Can deliver in ${timeline}.`,
      follow_up: "Following up—want a milestone-wise execution plan?",
      price_justification: `Pricing ${budget} includes planning, execution, QA, and revisions.`
    }
  });
});

app.post('/api/payments/razorpay/create-link', async (req, res) => {
  try {
    const { userKey, email } = req.body || {};
    const key = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const base = process.env.APP_BASE_URL || `https://clientreply-ai-wrapper.onrender.com`;

    if (!userKey) return res.status(400).json({ error: 'userKey required' });
    if (!key || !secret) return res.status(500).json({ error: 'Razorpay keys not configured' });

    const payload = {
      amount: 49900,
      currency: 'INR',
      accept_partial: false,
      description: 'ClientReply AI Pro - Monthly',
      customer: email ? { email } : undefined,
      notes: { userKey: String(userKey), plan: 'pro_monthly' },
      callback_url: `${base}/success.html?userKey=${encodeURIComponent(String(userKey))}`,
      callback_method: 'get'
    };

    const auth = Buffer.from(`${key}:${secret}`).toString('base64');
    const rr = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify(payload)
    });
    const data = await rr.json();
    if (!rr.ok) return res.status(400).json({ error: 'Razorpay create-link failed', details: data });
    return res.json({ success: true, short_url: data.short_url, id: data.id });
  } catch {
    return res.status(500).json({ error: 'create-link failed' });
  }
});

app.listen(process.env.PORT || 8787, () => console.log("running"));
