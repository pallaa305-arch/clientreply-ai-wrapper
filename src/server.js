import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";

const DATA_FILE = path.resolve("data/users.json");

function loadUsers() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    }
  } catch {}
  return {};
}

function saveUsers(users) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
}

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
  
  // Track usage
  const users = loadUsers();
  if (!users[userKey]) {
    users[userKey] = { createdAt: new Date().toISOString() };
  }
  if (!users[userKey].generations) users[userKey].generations = 0;
  users[userKey].generations += 1;
  users[userKey].lastGeneration = new Date().toISOString();
  saveUsers(users);
  
  return res.json({
    success: true,
    outputs: {
      whatsapp: `Thanks for reaching out! I'd be happy to help with your ${serviceType} requirement. Based on your budget of ${budget} and timeline of ${timeline}, I can deliver a quality solution. Would you like me to share a detailed proposal?`,
      email: `Subject: Re: ${leadText}\n\nHi,\n\nThank you for your interest in my ${serviceType} services.\n\nBased on your requirements:\n- Budget: ${budget}\n- Timeline: ${timeline}\n\nI'm confident I can deliver a solution that exceeds your expectations. Let me know if you'd like to discuss further.\n\nBest regards`,
      bid: `Hi,\n\nThank you for considering me for your ${serviceType} project.\n\nI understand you need:\n- ${leadText}\n- Budget: ${budget}\n- Timeline: ${timeline}\n\nMy approach ensures quality delivery within your timeline. I'm ready to start immediately.\n\nLet's connect to discuss details.`,
      followup: `Hi,\n\nJust following up on our previous conversation about ${serviceType}.\n\nI wanted to check if you had any questions about the proposal? I'm happy to clarify or make adjustments as needed.\n\nLooking forward to hearing from you.`,
      pricejustification: `The pricing of ${budget} for this ${serviceType} project is justified because:\n\n1. Quality assurance and multiple revision rounds\n2. Professional project management\n3. Post-delivery support\n4. Industry-standard tools and technologies\n5. Time-bound delivery with milestones`
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

// Manual activation endpoint (for interim manual payment)
app.post('/api/pro/manual-activate', (req, res) => {
  const { userKey, adminSecret } = req.body || {};
  const adminPass = process.env.ADMIN_ACTIVATE_SECRET;
  
  console.log('Activation attempt:', { userKey, adminPass: adminPass ? 'SET' : 'NOT SET', providedSecret: adminSecret ? 'PROVIDED' : 'NOT PROVIDED' });
  
  if (!userKey) return res.status(400).json({ error: 'userKey required' });
  if (!adminPass) return res.status(500).json({ error: 'Admin secret not configured on server' });
  if (adminPass !== adminSecret) return res.status(403).json({ error: 'Invalid admin secret' });
  
  const users = loadUsers();
  users[userKey] = { 
    ...users[userKey], 
    pro: true, 
    activatedAt: new Date().toISOString() 
  };
  saveUsers(users);
  
  console.log('User activated:', userKey);
  
  return res.json({ success: true, message: 'Pro activated successfully for ' + userKey });
});

// GET version for easy activation
app.get('/api/pro/activate', (req, res) => {
  const { userKey, secret } = req.query || {};
  const adminPass = process.env.ADMIN_ACTIVATE_SECRET;
  
  if (!userKey) return res.status(400).json({ error: 'userKey required' });
  if (!adminPass) return res.status(500).json({ error: 'Admin secret not configured' });
  if (adminPass !== secret) return res.status(403).json({ error: 'Invalid secret' });
  
  const users = loadUsers();
  users[userKey] = { 
    ...users[userKey], 
    pro: true, 
    activatedAt: new Date().toISOString() 
  };
  saveUsers(users);
  
  return res.json({ success: true, message: 'Pro activated for ' + userKey });
});

// Debug endpoint to check env
app.get('/api/debug/env', (req, res) => {
  const adminPass = process.env.ADMIN_ACTIVATE_SECRET;
  return res.json({ 
    adminSecretSet: !!adminPass,
    adminSecretValue: adminPass ? 'SET' : 'NOT SET'
  });
});

// Check pro status
app.get('/api/pro/status', (req, res) => {
  const { userKey } = req.query || {};
  if (!userKey) return res.status(400).json({ error: 'userKey required' });
  
  const users = loadUsers();
  const user = users[userKey] || {};
  return res.json({ 
    pro: !!user.pro, 
    email: user.email, 
    name: user.name,
    createdAt: user.createdAt,
    generations: user.generations || 0,
    activatedAt: user.activatedAt
  });
});

// User registration
app.post('/api/user/register', (req, res) => {
  const { userKey, email, name, password } = req.body || {};
  
  if (!userKey) return res.status(400).json({ error: 'userKey required' });
  
  const users = loadUsers();
  if (!users[userKey]) {
    users[userKey] = { createdAt: new Date().toISOString() };
  }
  users[userKey].email = email;
  users[userKey].name = name;
  if (password) users[userKey].password = password;
  saveUsers(users);
  
  return res.json({ success: true, userKey });
});

// User login
app.post('/api/user/login', (req, res) => {
  const { email, password } = req.body || {};
  
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  
  const users = loadUsers();
  for (const [userKey, user] of Object.entries(users)) {
    if (user.email === email && user.password === password) {
      return res.json({ success: true, userKey });
    }
  }
  
  return res.status(401).json({ error: 'Invalid email or password' });
});

// User update profile
app.post('/api/user/update', (req, res) => {
  const { userKey, email, name } = req.body || {};
  
  if (!userKey) return res.status(400).json({ error: 'userKey required' });
  
  const users = loadUsers();
  if (!users[userKey]) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  if (email) users[userKey].email = email;
  if (name) users[userKey].name = name;
  users[userKey].updatedAt = new Date().toISOString();
  saveUsers(users);
  
  return res.json({ success: true });
});

// List all users (admin)
app.get('/api/users/list', (req, res) => {
  const { adminSecret } = req.query || {};
  const adminPass = process.env.ADMIN_ACTIVATE_SECRET;
  
  if (!adminPass) return res.status(500).json({ error: 'Admin secret not configured' });
  if (adminPass !== adminSecret) return res.status(403).json({ error: 'Invalid admin secret' });
  
  const users = loadUsers();
  return res.json({ users });
});

app.listen(process.env.PORT || 8787, () => console.log("running"));


