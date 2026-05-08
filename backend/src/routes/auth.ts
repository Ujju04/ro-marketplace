import { Router } from "express";
import { db, usersTable, techniciansTable } from "../lib/db.js";
import { hashPassword, verifyPassword, signJwt } from "../lib/auth.js";
import { eq } from "drizzle-orm";
import { requireUser, requireTechnician, AuthRequest } from "../middlewares/auth.js";

const router = Router();

// ── In-memory OTP store (swap for Redis in production) ──────────────────────
const otpStore = new Map<string, { otp: string; expiresAt: number; purpose: string }>();

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── SMS Provider ──────────────────────────────────────────────────────────────
// Set SMS_PROVIDER in .env to: "fast2sms" | "twilio" | "msg91" | "console"
// Default is "console" (prints OTP to terminal — good for development)

async function sendOtp(phone: string, otp: string): Promise<void> {
  const provider = process.env.SMS_PROVIDER || "console";
  const message = `Your AquaCare OTP is ${otp}. Valid for 5 minutes. Do not share with anyone.`;

  if (provider === "fast2sms") {
    // Fast2SMS — Indian SMS, free tier available
    // Sign up: https://www.fast2sms.com → API → DLT Route
    // Add to .env: FAST2SMS_API_KEY=your_key
    const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: { authorization: process.env.FAST2SMS_API_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ route: "otp", variables_values: otp, numbers: phone }),
    });
    const data = await res.json() as any;
    if (!data.return) throw new Error(`Fast2SMS error: ${JSON.stringify(data)}`);
    return;
  }

  if (provider === "twilio") {
    // Twilio — global, paid
    // Add to .env: TWILIO_SID, TWILIO_TOKEN, TWILIO_PHONE
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { Twilio } = await (eval('import("twilio")') as Promise<any>);
    const client = new Twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    await client.messages.create({ body: message, from: process.env.TWILIO_PHONE, to: `+91${phone}` });
    return;
  }

  if (provider === "msg91") {
    // MSG91 — Indian SMS provider
    // Add to .env: MSG91_AUTHKEY, MSG91_TEMPLATE_ID, MSG91_SENDER_ID
    const res = await fetch("https://api.msg91.com/api/v5/otp", {
      method: "POST",
      headers: { authkey: process.env.MSG91_AUTHKEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ template_id: process.env.MSG91_TEMPLATE_ID, mobile: `91${phone}`, otp }),
    });
    const data = await res.json() as any;
    if (data.type !== "success") throw new Error(`MSG91 error: ${JSON.stringify(data)}`);
    return;
  }

  // Default: console (development mode)
  console.log(`\n${"=".repeat(40)}`);
  console.log(`📱 OTP for ${phone}: [ ${otp} ]`);
  console.log(`   Valid for 5 minutes`);
  console.log(`   Set SMS_PROVIDER in .env to send real SMS`);
  console.log(`${"=".repeat(40)}\n`);
}

// POST /api/auth/send-otp
router.post("/send-otp", async (req, res) => {
  try {
    const { phone, purpose } = req.body;
    if (!phone || !purpose) { res.status(400).json({ error: "Phone and purpose required" }); return; }
    const otp = generateOtp();
    otpStore.set(phone, { otp, expiresAt: Date.now() + 5 * 60 * 1000, purpose });
    sendOtp(phone, otp);
    res.json({ success: true, message: `OTP sent to ${phone}` });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/auth/verify-otp
router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) { res.status(400).json({ error: "Phone and OTP required" }); return; }
    const record = otpStore.get(phone);
    if (!record) { res.status(400).json({ error: "No OTP sent to this number" }); return; }
    if (Date.now() > record.expiresAt) { otpStore.delete(phone); res.status(400).json({ error: "OTP expired. Request a new one." }); return; }
    if (record.otp !== otp) { res.status(400).json({ error: "Incorrect OTP. Try again." }); return; }
    otpStore.delete(phone);
    const verifiedToken = signJwt({ phone, purpose: record.purpose, verified: true });
    res.json({ success: true, verifiedToken, purpose: record.purpose });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/auth/register  (no address field)
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password, city, address } = req.body;
    if (!name || !email || !phone || !password) { res.status(400).json({ error: "Missing fields" }); return; }
    const exists = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (exists.length) { res.status(400).json({ error: "Email already registered" }); return; }
    // @ts-ignore drizzle 0.36 insert type
    const [user] = await db.insert(usersTable).values({
      name, email, phone, passwordHash: hashPassword(password),
      city: city || null,
      address: address || null,
    }).returning();
    res.status(201).json({ token: signJwt({ id: user.id, email: user.email, role: "user" }), role: "user", user: { id: user.id, name: user.name, email: user.email, phone: user.phone, city: user.city, address: user.address } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user || !verifyPassword(password, user.passwordHash)) { res.status(401).json({ error: "Invalid credentials" }); return; }
    res.json({ token: signJwt({ id: user.id, email: user.email, role: "user" }), role: "user", user: { id: user.id, name: user.name, email: user.email, phone: user.phone, city: user.city } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/auth/technician/register  (no address field)
router.post("/technician/register", async (req, res) => {
  try {
    const { name, email, phone, password, experience, city, address } = req.body;
    if (!name || !email || !phone || !password || !city) { res.status(400).json({ error: "Missing fields" }); return; }
    const exists = await db.select().from(techniciansTable).where(eq(techniciansTable.email, email)).limit(1);
    if (exists.length) { res.status(400).json({ error: "Email already registered" }); return; }
    // @ts-ignore drizzle 0.36 insert type
    const [tech] = await db.insert(techniciansTable).values({
      name, email, phone, passwordHash: hashPassword(password),
      experience: parseInt(experience) || 0,
      city,
      address: address || null,
    }).returning();
    res.status(201).json({ token: signJwt({ id: tech.id, email: tech.email, role: "technician" }), role: "technician", technician: { id: tech.id, name: tech.name, email: tech.email, phone: tech.phone, city: tech.city, address: tech.address, isAvailable: tech.isAvailable } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/auth/technician/login
router.post("/technician/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const [tech] = await db.select().from(techniciansTable).where(eq(techniciansTable.email, email)).limit(1);
    if (!tech || !verifyPassword(password, tech.passwordHash)) { res.status(401).json({ error: "Invalid credentials" }); return; }
    res.json({ token: signJwt({ id: tech.id, email: tech.email, role: "technician" }), role: "technician", technician: { id: tech.id, name: tech.name, email: tech.email, phone: tech.phone, city: tech.city, isAvailable: tech.isAvailable, rating: tech.rating, totalJobs: tech.totalJobs } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/auth/users/me
router.get("/users/me", requireUser as any, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ id: user.id, name: user.name, email: user.email, phone: user.phone, city: user.city, createdAt: user.createdAt });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/technicians/me/profile
router.get("/technicians/me/profile", requireTechnician as any, async (req: AuthRequest, res) => {
  try {
    const [tech] = await db.select().from(techniciansTable).where(eq(techniciansTable.id, req.technicianId!)).limit(1);
    if (!tech) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ id: tech.id, name: tech.name, email: tech.email, phone: tech.phone, city: tech.city, isAvailable: tech.isAvailable, rating: tech.rating, totalJobs: tech.totalJobs, experience: tech.experience });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
