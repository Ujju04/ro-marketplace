import { Router } from "express";
import { db, productsTable, partsTable, bookingsTable, amcPlansTable, amcSubscriptionsTable, bookingPartsTable, tdsReadingsTable, roHealthTable, reviewsTable, techniciansTable } from "../lib/db.js";
import { eq, desc, and, asc } from "drizzle-orm";

const router = Router();
const sessions = new Map<string, Record<string, any>>();
const history = new Map<string, any[]>();

function getSession(id: string) {
  if (!sessions.has(id)) sessions.set(id, { step: "idle", context: {} });
  return sessions.get(id)!;
}
function setSession(id: string, data: Record<string, any>) {
  sessions.set(id, { ...getSession(id), ...data });
}

// ── Seasonal alert ────────────────────────────────────────────────────────────
function getSeasonalAlert(): string | null {
  const m = new Date().getMonth() + 1;
  if (m >= 4 && m <= 6) return "☀️ **Summer Alert:** Peak season — membranes clog 30% faster. Book a checkup!";
  if (m >= 7 && m <= 9) return "🌧️ **Monsoon Alert:** Higher turbidity — check spun/sediment filters frequently.";
  if (m >= 11 || m <= 2) return "❄️ **Winter Notice:** Cold water reduces RO output 10–15% — normal, not a defect.";
  return null;
}

// ── RO Health Score engine ────────────────────────────────────────────────────
function calcHealth(d: { roAge: number; lastService: number; tds: number; taste: string; flow: string; city: string }) {
  let score = 100;
  const details: string[] = [];
  if (d.roAge > 60) { score -= 25; details.push("🔴 Age >5 years: Major components may need replacement"); }
  else if (d.roAge > 36) { score -= 15; details.push("🟡 Age 3–5 years: Comprehensive service recommended"); }
  else if (d.roAge > 24) { score -= 8; details.push("🟡 Age 2–3 years: Membrane check advised"); }
  else details.push("🟢 RO age looks good");

  if (d.lastService > 12) { score -= 25; details.push("🔴 Not serviced in 12+ months: Filters overdue"); }
  else if (d.lastService > 6) { score -= 15; details.push("🟡 Not serviced in 6+ months: Filter change due"); }
  else details.push("🟢 Recently serviced — on schedule");

  if (d.tds > 500) { score -= 20; details.push("🔴 TDS >500 ppm: Membrane critically degraded"); }
  else if (d.tds > 300) { score -= 15; details.push("🔴 TDS >300 ppm: Membrane replacement needed"); }
  else if (d.tds > 150) { score -= 10; details.push("🟡 TDS >150 ppm: Membrane performance declining"); }
  else if (d.tds >= 50) details.push("🟢 TDS in ideal range (50–150 ppm)");
  else { score -= 5; details.push("🟡 TDS <50 ppm: May lack essential minerals"); }

  if (d.taste === "bad") { score -= 10; details.push("🔴 Bad taste: Carbon filter exhausted"); }
  else if (d.taste === "slight") { score -= 5; details.push("🟡 Slight off-taste: Carbon filter nearing end"); }
  if (d.flow === "very_slow") { score -= 10; details.push("🔴 Very slow flow: Membrane or pump issue"); }
  else if (d.flow === "slow") { score -= 5; details.push("🟡 Slow flow: Filters may be clogged"); }

  if (["delhi", "meerut", "noida", "gurgaon", "rohtak"].includes(d.city.toLowerCase())) {
    score -= 5; details.push("⚠️ High-TDS city: Components degrade faster than average");
  }

  score = Math.max(0, Math.min(100, score));
  let status = "Excellent ✅"; let recommendation = "Great condition! Schedule routine service in 6 months.";
  if (score < 40) { status = "Critical 🔴"; recommendation = "Immediate service required. Book now!"; }
  else if (score < 60) { status = "Poor 🟠"; recommendation = "Service urgently needed — book this week."; }
  else if (score < 75) { status = "Fair 🟡"; recommendation = "Service recommended within 2–4 weeks."; }
  else if (score < 90) { status = "Good 🟢"; recommendation = "Schedule preventive maintenance in 1–2 months."; }
  return { score, status, recommendation, details };
}

// ── Symptom knowledge base ────────────────────────────────────────────────────
const SYMPTOMS: Record<string, { diagnosis: string; parts: string[]; serviceType: string; severity: "high"|"medium"|"low"; tips: string[]; diy: string }> = {
  "no water":       { diagnosis: "RO pump failure or blocked solenoid valve", parts: ["RO Pump", "Solenoid Valve"], serviceType: "repair", severity: "high", tips: ["Check power LED is on", "Listen for pump hum — silence = pump failure", "Check inlet valve is open"], diy: "Unplug 30 sec then replug. Check inlet valve is fully open. If still no water, professional service needed." },
  "not working":    { diagnosis: "Pump, solenoid valve or power supply issue", parts: ["RO Pump", "Solenoid Valve", "Adapter"], serviceType: "repair", severity: "high", tips: ["Try unplugging and replugging", "Check power LED on unit"], diy: "Unplug 1 min, replug. Check inlet valve is fully open." },
  "slow":           { diagnosis: "Clogged membrane or filters reducing flow", parts: ["Membrane", "Sediment Filter", "Flow Resistor"], serviceType: "repair", severity: "medium", tips: ["Normal output: 8–10 litres/hour", "Low inlet pressure also causes slow output"], diy: "Check house water pressure first. If house pressure is low, RO output will be low — not a defect." },
  "low pressure":   { diagnosis: "Clogged sediment or carbon filter", parts: ["Sediment Filter", "Carbon Filter"], serviceType: "repair", severity: "medium", tips: ["Filters need replacing every 6 months"], diy: "If filter older than 6 months, replacement is due — normal wear." },
  "bad taste":      { diagnosis: "Exhausted carbon filter or degraded membrane", parts: ["Carbon Filter", "Membrane"], serviceType: "repair", severity: "medium", tips: ["Carbon filter removes chlorine — replace every 6 months"], diy: "Drain and refill tank 2–3 times. If taste persists, carbon filter replacement needed." },
  "bad smell":      { diagnosis: "Exhausted carbon filter", parts: ["Carbon Filter"], serviceType: "repair", severity: "medium", tips: ["Drain tank if smell persists after filter change"], diy: "Drain full tank, refill twice. If smell persists, carbon filter needs replacement." },
  "leaking":        { diagnosis: "Loose fittings, cracked adapter or worn tape", parts: ["Adapter", "Tape"], serviceType: "repair", severity: "high", tips: ["Turn off water inlet immediately", "Check all push-fit connections"], diy: "Turn off inlet valve immediately to prevent water damage. Do not use until fixed by technician." },
  "noisy":          { diagnosis: "Faulty RO pump vibrating abnormally", parts: ["RO Pump"], serviceType: "repair", severity: "medium", tips: ["Slight hum is normal", "Loud rattling = pump issue"], diy: "Place RO on a flat stable surface. Vibration from unstable placement can cause noise." },
  "yellow water":   { diagnosis: "Old spun filter letting through sediment", parts: ["Spun Filter", "Sediment Filter"], serviceType: "repair", severity: "high", tips: ["Stop drinking immediately", "Yellow = sediment bypassing filters"], diy: "Stop drinking immediately. This needs urgent professional service." },
  "high tds":       { diagnosis: "Membrane performance degraded", parts: ["Membrane", "Flow Resistor"], serviceType: "repair", severity: "high", tips: ["Ideal TDS: 50–150 ppm", "Membrane life: 2–3 years"], diy: "Compare input vs output TDS with a meter. If rejection rate <70%, membrane replacement is due." },
  "uv not working": { diagnosis: "UV lamp burned out or UV adapter fault", parts: ["UV Lamp", "UV Adapter"], serviceType: "repair", severity: "medium", tips: ["UV lamp life: ~1 year"], diy: "If blue light inside unit is not visible, lamp has failed. Replacement is needed." },
  "filter change":  { diagnosis: "Routine filter replacement due", parts: ["Carbon Filter", "Sediment Filter", "Spun Filter"], serviceType: "repair", severity: "low", tips: ["Replace every 6 months or 3000 litres"], diy: "AMC plan handles this automatically. Otherwise book annual service." },
  "installation":   { diagnosis: "New RO system installation needed", parts: [], serviceType: "installation", severity: "low", tips: ["Installation takes 1–2 hours"], diy: "Professional installation recommended for warranty validity." },
};

const CITY_TDS: Record<string, { tds: string; quality: string; hardness: string; recommendation: string; changeFreq: string; membraneLife: string }> = {
  "delhi":     { tds: "400–500 ppm", quality: "Very High 🔴", hardness: "Very Hard", recommendation: "RO essential. Membrane every 12 months.", changeFreq: "Filters every 4–5 months", membraneLife: "12–15 months" },
  "meerut":    { tds: "450–600 ppm", quality: "Very High 🔴", hardness: "Very Hard", recommendation: "RO essential. High mineral content.", changeFreq: "Filters every 4 months", membraneLife: "10–12 months" },
  "rohtak":    { tds: "400–550 ppm", quality: "Very High 🔴", hardness: "Very Hard", recommendation: "RO essential. Regular filter changes.", changeFreq: "Filters every 4 months", membraneLife: "10–14 months" },
  "mumbai":    { tds: "100–200 ppm", quality: "Moderate 🟡", hardness: "Soft", recommendation: "RO recommended.", changeFreq: "Filters every 8 months", membraneLife: "24–30 months" },
  "bangalore": { tds: "250–300 ppm", quality: "High 🟠", hardness: "Moderate", recommendation: "RO recommended.", changeFreq: "Filters every 6 months", membraneLife: "18–24 months" },
  "chennai":   { tds: "300–400 ppm", quality: "High 🟠", hardness: "Hard", recommendation: "RO essential.", changeFreq: "Filters every 5–6 months", membraneLife: "14–18 months" },
  "hyderabad": { tds: "280–350 ppm", quality: "High 🟠", hardness: "Moderate-Hard", recommendation: "RO recommended.", changeFreq: "Filters every 6 months", membraneLife: "16–20 months" },
  "pune":      { tds: "200–280 ppm", quality: "Moderate 🟡", hardness: "Moderate", recommendation: "RO recommended.", changeFreq: "Filters every 7–8 months", membraneLife: "20–24 months" },
  "noida":     { tds: "380–480 ppm", quality: "Very High 🔴", hardness: "Very Hard", recommendation: "RO essential.", changeFreq: "Filters every 4–5 months", membraneLife: "12–14 months" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function matchSymptom(msg: string) {
  const m = msg.toLowerCase();
  for (const [key, info] of Object.entries(SYMPTOMS)) { if (m.includes(key)) return { key, info }; }
  return null;
}
function extractNum(msg: string) { const m = msg.match(/\d+/); return m ? parseInt(m[0]) : null; }
function extractBookingId(msg: string) { const m = msg.match(/#?(\d+)/); return m ? parseInt(m[1]) : null; }
const PLACEHOLDERS = [/^(delhi|mumbai|meerut|bangalore|chennai|pune|hyderabad|noida|gurgaon|rohtak),?\s*(my address|my area|address|area)$/i, /^my address$/i, /^address$/i, /^test$/i, /^sample$/i];
function isPlaceholder(t: string) { return PLACEHOLDERS.some(p => p.test(t.trim())); }
function isRealAddress(t: string) {
  if (isPlaceholder(t)) return false;
  const hasCity = /\b(delhi|mumbai|meerut|bangalore|chennai|pune|hyderabad|noida|gurgaon|lucknow|agra|kolkata|jaipur|rohtak|karnal|panipat|faridabad|surat)\b/i.test(t);
  return hasCity && t.replace(/,/g, " ").trim().split(/\s+/).length >= 4;
}
function isHindi(msg: string) {
  return /\b(nahi|kya|hai|mera|meri|paani|pani|kharab|band|haan|kitna|kab|kaise|theek|bilkul|bahut|thoda|bhaiya|aata|nahi aata)\b/i.test(msg);
}

// ── Intent detection ──────────────────────────────────────────────────────────
function detectIntent(msg: string, session: any): string {
  const m = msg.toLowerCase().trim();
  const step = session.step;

  if (step === "awaiting_address") return "provide_address";
  if (step === "awaiting_cancel_confirm") return "cancel_confirm";
  if (step === "awaiting_health_age") return "health_q1";
  if (step === "awaiting_health_service") return "health_q2";
  if (step === "awaiting_health_tds") return "health_q3";
  if (step === "awaiting_health_taste") return "health_q4";
  if (step === "awaiting_health_flow") return "health_q5";
  if (step === "awaiting_tds_value") return "tds_input";
  if (step === "awaiting_rating") return "rating_input";
  if (step === "awaiting_booking_confirm") {
    // Use includes() instead of \b for Hindi/Devanagari Unicode compatibility
    const confirmWords = ["yes", "book", "ok", "sure", "confirm", "haan", "ha", "bilkul", "theek", "हाँ", "हां", "ठीक", "बुक", "करो"];
    const cancelWords = ["no", "nahi", "nope", "later", "baad", "नही", "नहीं"];
    if (confirmWords.some(w => m.includes(w))) return "book_from_diagnosis";
    if (cancelWords.some(w => m.includes(w))) return "cancel_intent";
    if (/diy|myself|khud|what can|home|ghar|खुद/.test(m)) return "diy";
    if (/expensive|costly|zyada|mehnga|cheap|discount|महंगा|ज्यादा/.test(m)) return "too_expensive";
  }

  if (/\b(show|detail|status).*(booking|order|service).*#?(\d+)|#?(\d+).*(booking|service|detail)/i.test(msg)) return "booking_detail";
  if (/cancel.*(booking|order|service)\s*#?(\d+)/i.test(msg)) return "cancel_by_id";
  if (/cancel.*(booking|my|order)/i.test(m)) return "cancel_prompt";
  if (/\b(where|track|location|live|kahan).*(technician|tech|worker|bhaiya)/i.test(m)) return "track_tech";
  if (/\b(health|score|check my ro|ro health|kitna theek|diagnose my ro)\b/.test(m)) return "health_start";
  if (/\b(tds trend|tds history|tds graph|track tds)\b/.test(m)) return "tds_trend";
  if (/\b(tds|add tds|my tds|log tds)\b/.test(m) && /\d{2,4}/.test(m)) return "tds_direct";
  if (/\b(tds|add tds|log tds|enter tds|check tds)\b/.test(m)) return "tds_start";
  if (/\b(rate|rating|review|feedback|service kaisa)\b/.test(m)) return "rate";
  if (/\b(remind|reminder|schedule|yaad dila)\b/.test(m)) return "reminder";
  if (/\b(diy|myself|khud|what can i do|home remedy)\b/.test(m)) return "diy";
  if (/\b(expensive|costly|zyada|mehnga|discount|cheap)\b/.test(m)) return "too_expensive";
  if (/\b(voice|mic|speak|bol ke|microphone)\b/.test(m)) return "voice_info";
  if (/\b(book|schedule|appointment|technician bhejo)\b/.test(m)) return "book_service";
  if (/\b(price|cost|kitna|estimate|rate|charges|how much|paisa)\b/.test(m)) return "get_price";
  if (/\b(buy|product|recommend|which ro|new ro|purifier|kaunsa ro)\b/.test(m)) return "products";
  if (/\b(amc|annual|maintenance contract|subscribe)\b/.test(m)) return "amc_info";
  if (/\b(my amc|my plan|mera plan|my subscription)\b/.test(m)) return "my_amc";
  if (/\b(my booking|my service|meri booking|recent booking|my order)\b/.test(m)) return "my_bookings";
  if (/\b(tds|water quality|water in|ppm|paani quality)\b/.test(m)) return "water_quality";
  if (/\b(how often|filter life|guarantee|payment|what is amc|how long)\b/.test(m)) return "faq";
  if (matchSymptom(msg)) return "diagnose";
  if (/\b(problem|issue|broken|kharab|help|fault|repair|fix|kaam nahi)\b/.test(m)) return "diagnose_prompt";
  if (isHindi(msg)) return "hindi";
  return "general";
}

// ── Main response generator ───────────────────────────────────────────────────
async function respond(msg: string, sid: string, userId?: number, lat?: number, lng?: number, addr?: string, city?: string): Promise<any> {
  const session = getSession(sid);
  const intent = detectIntent(msg, session);
  const m = msg.toLowerCase().trim();

  // ── Hindi support ─────────────────────────────────────────────────────────
  if (intent === "hindi") {
    if (/nahi aata|paani nahi|pani nahi|pani band/.test(m))
      return { message: "🔍 **निदान: पानी नहीं आ रहा**\n\n🔴 गंभीर — RO pump खराब हो सकता है\n\n💡 बिजली जांचें\n💡 Inlet valve खुला है?\n💡 Pump की आवाज सुनें\n\nक्या technician बुक करूं?", intent, quickReplies: ["हाँ, technician बुक करो", "कीमत बताओ", "खुद check करना है"] };
    if (/kharab|taste|swad|boo|gandh/.test(m))
      return { message: "🔍 **निदान: पानी खराब**\n\nCarbon filter खत्म हो गया।\n💰 अनुमानित खर्च: ₹649–₹849\n\nBook करें?", intent, quickReplies: ["हाँ book करो", "कितना लगेगा?", "खुद ठीक करना है"] };
    if (/mehnga|costly|zyada|bahut paisa/.test(m))
      return { message: "💡 **सस्ते विकल्प:**\n\n📋 AMC Plan ₹1,499/साल — सब included\n🔧 सिर्फ जरूरी parts replace\n\nAMC में service charge माफ!\n\nAMC देखें?", intent, quickReplies: ["AMC plan दिखाओ", "फिर भी book करो"] };
    if (/ruk|band|leaking|tapak/.test(m))
      return { message: "⚠️ **Leaking — तुरंत inlet valve बंद करें!**\n\nपानी का नुकसान रोकें। Technician को बुलाएं।", intent, quickReplies: ["Technician बुक करो"] };
    return { message: "नमस्ते! 👋 मैं AquaBot हूँ।\n\nआपके RO में क्या समस्या है?\n\n🔍 समस्या पहचानना\n📅 Technician बुक करना\n💰 कीमत जानना\n🏥 RO Health Score\n📊 TDS tracking", intent, quickReplies: ["पानी नहीं आ रहा", "पानी का स्वाद खराब है", "Technician book करो", "AMC क्या है?"] };
  }

  // ── Provide address ───────────────────────────────────────────────────────
  if (intent === "provide_address") {
    if (lat && lng) {
      if (!userId) { setSession(sid, { step: "idle" }); return { message: "🔐 Please **sign in** to book!", intent, action: "open_auth" }; }
      const [b] = await db.insert(bookingsTable).values({ userId, technicianId: null, serviceType: session.suggestedServiceType || "repair", status: "pending", bookingType: "instant", address: addr || `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, city: city || "detected", symptoms: session.diagnosedSymptom || "", serviceCharge: "199", lat: lat.toString(), lng: lng.toString(), estimatedCost: session.estimatedMin ? `${session.estimatedMin}-${session.estimatedMax}` : null }).returning();
      setSession(sid, { step: "idle" });
      const seasonal = getSeasonalAlert();
      return { message: `✅ **Booking #${b.id} Confirmed!**\n\n📍 GPS location captured\n🔧 Service: ${session.suggestedServiceType || "Repair"}\n💰 Est: ₹${session.estimatedMin || 199}–₹${session.estimatedMax || 1500}\n\n**Before technician arrives:**\n✅ Keep RO plugged in\n✅ Inlet water valve open\n✅ Have model number handy\n✅ Be available at address\n\n${seasonal || "⏱️ Technician will accept shortly!"}`, intent, bookingCreated: { id: b.id }, quickReplies: ["Track my booking", "Rate a past service", "View AMC Plans"] };
    }
    if (isPlaceholder(msg)) return { message: "❌ **That's not a real address.**\n\nPlease type your actual address:\n*Example: Meerut, 47 Shastri Nagar, Near SBI Bank*\n\nOr share your GPS 📍", intent, action: "request_location", quickReplies: ["📍 Share my GPS location"] };
    if (!isRealAddress(msg)) return { message: "📍 **Need more detail.**\n\nFormat: **City, Street/Area** (at least 4 words)\n*Example: Delhi, 23 Rohini Sector 7, Near Metro Station*\n\nOr share GPS 👇", intent, action: "request_location", quickReplies: ["📍 Share my GPS location"] };
    if (!userId) { setSession(sid, { step: "idle" }); return { message: "🔐 Please **sign in** to book!", intent, action: "open_auth" }; }
    const bc = msg.split(",")[0].trim().toLowerCase();
    const [b] = await db.insert(bookingsTable).values({ userId, technicianId: null, serviceType: session.suggestedServiceType || "repair", status: "pending", bookingType: "instant", address: msg.trim(), city: bc, symptoms: session.diagnosedSymptom || "", serviceCharge: "199", estimatedCost: session.estimatedMin ? `${session.estimatedMin}-${session.estimatedMax}` : null }).returning();
    setSession(sid, { step: "idle" });
    const seasonal = getSeasonalAlert();
    return { message: `✅ **Booking #${b.id} Confirmed!**\n\n📍 ${msg.trim()}\n🔧 ${session.suggestedServiceType || "Repair"}\n💰 Est: ₹${session.estimatedMin || 199}–₹${session.estimatedMax || 1500}\n\n**Checklist:**\n✅ Keep RO plugged in\n✅ Inlet valve open\n✅ Be available at address\n\n${seasonal || "⏱️ Track live location on My Bookings!"}`, intent, bookingCreated: { id: b.id }, quickReplies: ["Track my booking", "Rate a past service", "View AMC Plans"] };
  }

  // ── RO Health Score (5 questions) ─────────────────────────────────────────
  if (intent === "health_start") {
    setSession(sid, { step: "awaiting_health_age", hd: {} });
    return { message: "🏥 **RO Health Score Assessment**\n\n5 quick questions → AI scores your RO (0–100)\n\n**Q1/5:** How old is your RO purifier?\n*(Enter months, e.g. 24 for 2 years)*", intent, quickReplies: ["6 months", "12 months", "24 months", "36 months", "60+ months"] };
  }
  if (intent === "health_q1") {
    const age = /never|new/.test(m) ? 3 : extractNum(msg) || 12;
    setSession(sid, { step: "awaiting_health_service", hd: { ...session.hd, roAge: age } });
    return { message: `Got it — **${age} months old**.\n\n**Q2/5:** When was it last professionally serviced?`, intent, quickReplies: ["1 month ago", "3 months ago", "6 months ago", "12 months ago", "Never serviced"] };
  }
  if (intent === "health_q2") {
    const sv = /never/.test(m) ? 99 : extractNum(msg) || 6;
    setSession(sid, { step: "awaiting_health_tds", hd: { ...session.hd, lastService: sv } });
    return { message: `**Q3/5:** What is your current output water TDS?\n*(TDS meter: ₹150 on Amazon. Safe range: 50–150 ppm)*\n\nSay 'don't know' if unsure.`, intent, quickReplies: ["50", "100", "150", "200", "300", "Don't know"] };
  }
  if (intent === "health_q3") {
    const tds = /don.t know|pata nahi/.test(m) ? 150 : extractNum(msg) || 150;
    setSession(sid, { step: "awaiting_health_taste", hd: { ...session.hd, tds } });
    return { message: `**Q4/5:** How does the water taste?`, intent, quickReplies: ["Normal / Good", "Slight off-taste", "Bad taste", "Very bad taste"] };
  }
  if (intent === "health_q4") {
    const taste = /very bad|bahut bura/.test(m) ? "bad" : /bad|kharab/.test(m) ? "bad" : /slight|thoda/.test(m) ? "slight" : "good";
    setSession(sid, { step: "awaiting_health_flow", hd: { ...session.hd, taste } });
    return { message: `**Q5/5 (Last one!):** How is the water flow speed?`, intent, quickReplies: ["Normal / Good", "Slightly slow", "Very slow", "Almost none"] };
  }
  if (intent === "health_q5") {
    const flow = /very slow|almost none/.test(m) ? "very_slow" : /slow|thoda/.test(m) ? "slow" : "normal";
    const hd = session.hd || {};
    const result = calcHealth({ roAge: hd.roAge || 12, lastService: hd.lastService || 6, tds: hd.tds || 150, taste: hd.taste || "good", flow, city: session.context?.city || "delhi" });
    setSession(sid, { step: "idle" });
    if (userId) {
      await db.insert(roHealthTable).values({ userId, score: result.score, roAge: hd.roAge, lastServiceMonths: hd.lastService, currentTds: hd.tds, waterTaste: hd.taste, flowSpeed: flow, recommendation: result.recommendation, status: result.status }).catch(() => {});
    }
    const bar = "█".repeat(Math.floor(result.score / 10)) + "░".repeat(10 - Math.floor(result.score / 10));
    return {
      message: `🏥 **RO Health Score: ${result.score}/100**\n\n[${bar}] ${result.status}\n\n**Detailed Assessment:**\n${result.details.join("\n")}\n\n**Recommendation:** ${result.recommendation}`,
      intent,
      healthScore: { score: result.score, status: result.status, details: result.details },
      quickReplies: result.score < 75 ? ["Book a service now", "Get AMC plan", "See pricing"] : ["Check again in 3 months", "Get AMC plan", "Log my TDS"],
    };
  }

  // ── TDS Tracking ──────────────────────────────────────────────────────────
  if (intent === "tds_direct") {
    if (!userId) return { message: "🔐 Please sign in to log TDS readings.", intent, action: "open_auth" };
    const tds = extractNum(msg)!;
    await db.insert(tdsReadingsTable).values({ userId, tdsValue: tds, city: session.context?.city || null }).catch(() => {});
    let status = "🟢 Ideal (50–150 ppm)"; let advice = "Your water is safe to drink.";
    if (tds < 50) { status = "🟡 Too Low"; advice = "May lack essential minerals. Consider mineralizer."; }
    else if (tds > 500) { status = "🔴 Critical!"; advice = "Membrane likely failed. Book service immediately!"; }
    else if (tds > 300) { status = "🔴 Very High"; advice = "Membrane needs replacement soon."; }
    else if (tds > 150) { status = "🟡 Above Safe Limit"; advice = "Membrane performance declining. Monitor closely."; }
    return { message: `💧 **TDS ${tds} ppm logged!**\n\nStatus: ${status}\n${advice}\n\n*I'll track this over time to detect trends!*`, intent, quickReplies: tds > 150 ? ["Book a service", "View TDS trend", "Check health score"] : ["View TDS trend", "Check health score"] };
  }
  if (intent === "tds_start") {
    setSession(sid, { step: "awaiting_tds_value" });
    return { message: "💧 **Log TDS Reading**\n\nEnter your output water TDS value:\n*(TDS meter available for ₹150 on Amazon)*\n\n**Safe range: 50–150 ppm**", intent, quickReplies: ["50", "100", "150", "200", "300"] };
  }
  if (intent === "tds_input") {
    const tds = extractNum(msg);
    if (!tds) return { message: "Please enter a number like *150*", intent };
    if (userId) await db.insert(tdsReadingsTable).values({ userId, tdsValue: tds }).catch(() => {});
    setSession(sid, { step: "idle" });
    const status = tds < 50 ? "🟡 Too Low" : tds > 300 ? "🔴 Very High" : tds > 150 ? "🟡 Above Safe Limit" : "🟢 Ideal";
    return { message: `✅ **TDS ${tds} ppm saved!**\n\nStatus: ${status}`, intent, quickReplies: ["View TDS trend", "Book a service", "Check health score"] };
  }
  if (intent === "tds_trend") {
    if (!userId) return { message: "🔐 Please sign in to view TDS history.", intent };
    const readings = await db.select().from(tdsReadingsTable).where(eq(tdsReadingsTable.userId, userId)).orderBy(asc(tdsReadingsTable.createdAt)).limit(10);
    if (readings.length < 2) return { message: "📊 Need at least 2 readings for trend analysis.\n\nLog your TDS reading now!", intent, quickReplies: ["Log my TDS"] };
    const first = readings[0].tdsValue; const last = readings[readings.length - 1].tdsValue;
    const trend = last > first + 30 ? `📈 Rising significantly (+${last - first} ppm) ⚠️` : last > first ? `📈 Slightly rising (+${last - first} ppm)` : last < first ? `📉 Falling (${last - first} ppm) ✅` : "➡️ Stable";
    const alert = last > first + 50 ? "\n\n⚠️ **Significant TDS rise** — membrane may be degrading. Book a service." : last > 150 ? "\n\n🟡 TDS above safe limit — monitor closely." : "";
    return {
      message: `📊 **TDS Trend (${readings.length} readings)**\n\n${readings.map(r => `• ${new Date(r.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}: **${r.tdsValue} ppm**`).join("\n")}\n\nTrend: ${trend}${alert}`,
      intent,
      tdsReadings: readings.map(r => ({ date: r.createdAt, value: r.tdsValue })),
      quickReplies: last > 150 ? ["Book a service", "Log new reading"] : ["Log new reading", "Check health score"],
    };
  }

  // ── Post-service rating ────────────────────────────────────────────────────
  if (intent === "rate") {
    if (!userId) return { message: "🔐 Please sign in to rate a service.", intent };
    const [b] = await db.select().from(bookingsTable).where(and(eq(bookingsTable.userId, userId), eq(bookingsTable.status, "completed"))).orderBy(desc(bookingsTable.createdAt)).limit(1);
    if (!b) return { message: "No completed services to rate yet.", intent, quickReplies: ["Book a service"] };
    setSession(sid, { step: "awaiting_rating", ratingBookingId: b.id });
    return { message: `⭐ **Rate Booking #${b.id}**\n\n${b.serviceType} at ${b.city}\n\nHow was your experience?`, intent, quickReplies: ["⭐ 1 - Very Bad", "⭐⭐ 2 - Bad", "⭐⭐⭐ 3 - OK", "⭐⭐⭐⭐ 4 - Good", "⭐⭐⭐⭐⭐ 5 - Excellent"] };
  }
  if (intent === "rating_input") {
    const rating = extractNum(msg) || (m.includes("excellent") ? 5 : m.includes("good") ? 4 : m.includes("ok") ? 3 : m.includes("very bad") ? 1 : m.includes("bad") ? 2 : 4);
    const bookingId = session.ratingBookingId;
    setSession(sid, { step: "idle" });
    if (userId && bookingId) {
      const [bk] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
      if (bk?.technicianId) await db.insert(reviewsTable).values({ userId, technicianId: bk.technicianId, bookingId, rating, comment: msg }).catch(() => {});
    }
    const responses = ["Sorry to hear that! We'll improve. 🙏", "Sorry about the experience. We'll do better!", "Thank you for the feedback!", "Great! Glad you had a good experience! 😊", "Excellent! ⭐⭐⭐⭐⭐ Thank you so much! We'll share this with your technician!"];
    return { message: responses[Math.min(rating - 1, 4)], intent, quickReplies: ["Book another service", "Get AMC plan"] };
  }

  // ── Track technician ──────────────────────────────────────────────────────
  if (intent === "track_tech") {
    if (!userId) return { message: "🔐 Please sign in.", intent };
    const active = await db.select({ id: bookingsTable.id, status: bookingsTable.status, city: bookingsTable.city, techName: techniciansTable.name, techPhone: techniciansTable.phone, techLat: techniciansTable.lat, techLng: techniciansTable.lng }).from(bookingsTable).leftJoin(techniciansTable, eq(bookingsTable.technicianId, techniciansTable.id)).where(and(eq(bookingsTable.userId, userId), eq(bookingsTable.status, "in_progress"))).limit(1);
    if (!active.length) {
      const acc = await db.select().from(bookingsTable).where(and(eq(bookingsTable.userId, userId), eq(bookingsTable.status, "accepted"))).limit(1);
      if (acc.length) return { message: `✅ Technician assigned to Booking #${acc[0].id}!\n\nThey'll update to 'On the Way' shortly. Live map on **My Bookings** page.`, intent, quickReplies: ["View my bookings"] };
      return { message: "No active booking with a technician right now.\n\nBook a service first!", intent, quickReplies: ["Book a service"] };
    }
    const t = active[0];
    const mapsLink = t.techLat && t.techLng ? `\n\n📍 [Open in Google Maps](https://maps.google.com/?q=${t.techLat},${t.techLng})` : "";
    return { message: `🚗 **${t.techName} is on the way!**\n\nBooking #${t.id} · ${t.city}\n📞 ${t.techPhone}${mapsLink}\n\nLive map on **My Bookings** page — updates every 20 sec.`, intent, quickReplies: ["View my bookings"] };
  }

  // ── Too expensive / DIY / Reminder / Voice ────────────────────────────────
  if (intent === "too_expensive") {
    return { message: "💡 **Best options for you:**\n\n**Option 1: AMC Plan** — ₹1,499/year\n• All filter changes included\n• Service charge waived\n• Saves ₹2,000–₹3,000/year\n\n**Option 2: Essential parts only**\n• Technician diagnoses → you approve each part\n• Pay only for what's needed\n\n**Option 3: DIY checks first**\n• I'll guide you through basic checks\n• May avoid a service call entirely", intent, quickReplies: ["Show AMC plans", "DIY checks first", "Book anyway"] };
  }
  if (intent === "diy") {
    const match = matchSymptom(session.diagnosedSymptom || msg);
    if (match?.info.diy) return { message: `🔧 **DIY Check — ${match.key}**\n\n${match.info.diy}\n\n⚠️ If this doesn't resolve it, professional service needed.`, intent, quickReplies: ["Book a technician", "Show pricing"] };
    return { message: "🔧 **Quick DIY Checks:**\n\n1. **No water** → Check inlet valve + power LED + listen for pump hum\n2. **Bad taste** → Drain and refill tank 2–3 times\n3. **Slow flow** → Check house water pressure first\n4. **Leaking** → Turn off inlet valve immediately\n5. **Noisy** → Place RO on flat stable surface\n6. **High TDS** → Drain tank once, recheck TDS\n\nStill not resolved? Technician fixes it in 30–60 min.", intent, quickReplies: ["Book a technician", "Show pricing", "What will it cost?"] };
  }
  if (intent === "reminder") {
    return { message: "⏰ **Service Reminder Guide**\n\n• **TDS check:** Monthly (₹150 TDS meter)\n• **Filter change:** Every 4–6 months\n• **Full service:** Every 6–12 months\n• **Membrane:** Every 1–3 years\n• **UV lamp:** Every 12 months\n\n💡 Photo your filter change date + set a phone calendar reminder!\n\n📋 **AMC plan** handles all of this automatically!", intent, quickReplies: ["Get AMC plan", "Log my TDS", "Book a service now"] };
  }
  if (intent === "voice_info") {
    return { message: "🎤 **Voice Input is active!**\n\nClick the **microphone icon** in the chat input bar.\n\nWorks in: Chrome, Edge, Safari (mobile)\n\nJust say:\n• *'My RO has no water'*\n• *'Book a service'*\n• *'What is my TDS?'*\n• *'Check my RO health score'*", intent, quickReplies: ["My RO has no water", "Check RO health score", "Book a service"] };
  }

  // ── Cancel flows ──────────────────────────────────────────────────────────
  if (intent === "cancel_by_id") {
    if (!userId) return { message: "🔐 Please sign in.", intent };
    const id = extractBookingId(msg);
    if (!id) return { message: "Mention booking number: *'Cancel booking #3'*", intent };
    const [b] = await db.select().from(bookingsTable).where(and(eq(bookingsTable.id, id), eq(bookingsTable.userId, userId))).limit(1);
    if (!b) return { message: `❌ Booking #${id} not found.`, intent };
    if (["completed", "cancelled"].includes(b.status)) return { message: `❌ Booking #${id} is already **${b.status}**.`, intent };
    setSession(sid, { ...session, step: "awaiting_cancel_confirm", cancelBookingId: id });
    return { message: `⚠️ **Cancel Booking #${id}?**\n\n📍 ${b.address}, ${b.city}\n🔧 ${b.serviceType}\n\nAre you sure?`, intent, quickReplies: ["Yes, cancel it", "No, keep it"] };
  }
  if (intent === "cancel_prompt") {
    if (!userId) return { message: "🔐 Please sign in.", intent };
    const bks = await db.select().from(bookingsTable).where(eq(bookingsTable.userId, userId)).orderBy(desc(bookingsTable.createdAt)).limit(5);
    const cancellable = bks.filter(b => ["pending", "accepted"].includes(b.status));
    if (!cancellable.length) return { message: "No active bookings to cancel.", intent, quickReplies: ["Book a service"] };
    return { message: `📋 **Which booking to cancel?**\n\n${cancellable.map(b => `🟡 **#${b.id}** — ${b.serviceType} · ${b.city}`).join("\n")}\n\nSay *'Cancel booking #${cancellable[0].id}'*`, intent, quickReplies: cancellable.map(b => `Cancel booking #${b.id}`) };
  }
  if (intent === "cancel_confirm") {
    const bookingId = session.cancelBookingId;
    if (/yes|confirm|cancel it|haan|ha/i.test(m)) {
      if (bookingId && userId) await db.update(bookingsTable).set({ status: "cancelled", updatedAt: new Date() }).where(and(eq(bookingsTable.id, bookingId), eq(bookingsTable.userId, userId))).catch(() => {});
      setSession(sid, { step: "idle" });
      return { message: `✅ **Booking #${bookingId} cancelled.**\n\nBook again whenever you need us!`, intent, quickReplies: ["Book a new service"] };
    }
    setSession(sid, { step: "idle" });
    return { message: `✅ **Booking #${bookingId} kept!** Still active.`, intent, quickReplies: ["Show my bookings"] };
  }

  // ── Book from diagnosis ───────────────────────────────────────────────────
  if (intent === "book_from_diagnosis") {
    setSession(sid, { ...session, step: "awaiting_address" });
    return { message: "📍 **Where should we send the technician?**\n\nType **City + Full address:**\n*Example: Meerut, 47 Shastri Nagar, Near SBI Bank*\n\nOr share GPS 👇", intent, action: "request_location", quickReplies: ["📍 Share my GPS location"] };
  }
  if (intent === "cancel_intent") { setSession(sid, { step: "idle" }); return { message: "No problem! Let me know if I can help.", intent, quickReplies: ["Show pricing", "DIY checks"] }; }
  if (intent === "book_service") {
    setSession(sid, { ...session, step: "awaiting_address" });
    return { message: "📍 **Where should we send the technician?**\n\nType **City + Full address:**\n*Example: Meerut, 47 Shastri Nagar, Near SBI Bank*\n\nOr share GPS 👇", intent, action: "request_location", quickReplies: ["📍 Share my GPS location"] };
  }

  // ── Diagnose ──────────────────────────────────────────────────────────────
  if (intent === "diagnose_prompt") {
    return { message: "🔧 **What's wrong with your RO?**\n\nDescribe the issue or pick one:", intent, quickReplies: ["No water output", "Water tastes bad", "RO is leaking", "Making noise", "High TDS", "Yellow water", "Slow water flow"] };
  }
  if (intent === "diagnose") {
    const match = matchSymptom(msg);
    if (!match) return { message: "🤔 Could not identify that. Try describing it differently.", intent, quickReplies: ["No water output", "Water tastes bad", "RO is leaking", "High TDS"] };
    const allParts = await db.select().from(partsTable).where(eq(partsTable.isActive, true));
    const matched = allParts.filter(p => match.info.parts.some(n => p.name.toLowerCase().includes(n.toLowerCase())));
    const minCost = matched.reduce((s, p) => s + parseFloat(p.minPrice?.toString() || "0"), 199);
    const maxCost = matched.reduce((s, p) => s + parseFloat(p.maxPrice?.toString() || "0"), 199);
    setSession(sid, { step: "awaiting_booking_confirm", diagnosedSymptom: match.key, estimatedMin: minCost, estimatedMax: maxCost, suggestedServiceType: match.info.serviceType });
    const sevEmoji = match.info.severity === "high" ? "🔴" : match.info.severity === "medium" ? "🟡" : "🟢";
    const seasonal = getSeasonalAlert();
    return {
      message: `🔍 **Diagnosis: "${match.key}"**\n\n${sevEmoji} Severity: ${match.info.severity.toUpperCase()}\n**Cause:** ${match.info.diagnosis}\n\n${match.info.tips.map(t => `💡 ${t}`).join("\n")}${seasonal ? `\n\n${seasonal}` : ""}`,
      intent,
      estimate: { parts: matched.map(p => ({ name: p.name, minPrice: parseFloat(p.minPrice?.toString() || "0"), maxPrice: parseFloat(p.maxPrice?.toString() || "0") })), serviceCharge: 199, totalMin: minCost, totalMax: maxCost },
      quickReplies: ["Yes, book a technician", "DIY check first", "Too expensive", "Show pricing"],
    };
  }

  // ── Booking detail ────────────────────────────────────────────────────────
  if (intent === "booking_detail") {
    if (!userId) return { message: "🔐 Please sign in.", intent };
    const id = extractBookingId(msg);
    if (!id) return { message: "Say *'Show booking #3'* for details.", intent };
    const [b] = await db.select().from(bookingsTable).where(and(eq(bookingsTable.id, id), eq(bookingsTable.userId, userId))).limit(1);
    if (!b) return { message: `❌ Booking #${id} not found.`, intent };
    const parts = await db.select().from(bookingPartsTable).where(eq(bookingPartsTable.bookingId, id));
    const emoji: Record<string, string> = { pending: "🟡", accepted: "🔵", in_progress: "🔵", completed: "🟢", cancelled: "⚫" };
    let txt = `📋 **Booking #${b.id}**\n\n${emoji[b.status] || "⚪"} **${b.status.replace("_", " ").toUpperCase()}**\n🔧 ${b.serviceType} · 📍 ${b.address}, ${b.city}\n📅 ${new Date(b.createdAt).toLocaleDateString("en-IN")}`;
    if (b.symptoms) txt += `\n🔍 Symptoms: ${b.symptoms}`;
    if (b.finalAmount) txt += `\n💰 Final bill: ₹${b.finalAmount}`;
    if (parts.length) txt += `\n\n**Parts replaced:**\n${parts.map(p => `• ${p.partName} ×${p.quantity} — ₹${p.totalPrice}`).join("\n")}`;
    if (b.notes) txt += `\n\n💬 Tech notes: ${b.notes}`;
    return { message: txt, intent, quickReplies: ["pending", "accepted"].includes(b.status) ? [`Cancel booking #${id}`, "Track technician"] : ["Rate this service", "Book another service"] };
  }

  // ── Standard intents ──────────────────────────────────────────────────────
  if (intent === "get_price") {
    const parts = await db.select().from(partsTable).where(eq(partsTable.isActive, true));
    return { message: `💰 **Transparent Pricing**\n\n${parts.map(p => `• **${p.name}**: ₹${p.minPrice}${p.minPrice !== p.maxPrice ? `–₹${p.maxPrice}` : ""}`).join("\n")}\n\n🔧 **Service Visit:** ₹199\n✅ You approve before work starts.`, intent, quickReplies: ["Book a technician", "Get AMC plan"] };
  }
  if (intent === "products") {
    const prods = await db.select().from(productsTable).where(eq(productsTable.inStock, true)).limit(4);
    return { message: "🛒 **Top RO Recommendations:**\n\nAll include free installation support and 1-year warranty:", intent, products: prods.map(p => ({ id: p.id, name: p.name, description: p.description, rating: parseFloat(p.rating?.toString() || "4"), brand: p.brand })), quickReplies: ["Book installation", "Which is best for my city?", "View all products"] };
  }
  if (intent === "amc_info") {
    const plans = await db.select().from(amcPlansTable).where(eq(amcPlansTable.isActive, true));
    return { message: "📋 **AMC Plans — Annual Maintenance Contract**\n\n✅ Fixed yearly cost — no surprise bills\n✅ All filter replacements included\n✅ Priority technician dispatch\n✅ Service charge waived", intent, amcPlans: plans.map(p => ({ id: p.id, name: p.name, price: parseFloat(p.price?.toString() || "0"), description: p.description, visits: p.servicesIncluded, features: p.features })), quickReplies: ["Subscribe Basic", "Subscribe Standard", "Subscribe Premium"] };
  }
  if (intent === "my_amc") {
    if (!userId) return { message: "🔐 Please sign in.", intent };
    const subs = await db.select({ endDate: amcSubscriptionsTable.endDate, planName: amcPlansTable.name, price: amcPlansTable.price }).from(amcSubscriptionsTable).leftJoin(amcPlansTable, eq(amcSubscriptionsTable.planId, amcPlansTable.id)).where(and(eq(amcSubscriptionsTable.userId, userId), eq(amcSubscriptionsTable.status, "active"))).limit(1);
    if (!subs.length) return { message: "No active AMC plan.\n\nAMC saves ₹1,500–₹3,000/year!", intent, quickReplies: ["Show AMC plans"] };
    const s = subs[0]; const days = Math.max(0, Math.ceil((new Date(s.endDate!).getTime() - Date.now()) / 86400000));
    return { message: `✅ **Active AMC: ${s.planName}**\n💰 ₹${s.price}/year\n📅 Expires: ${new Date(s.endDate!).toLocaleDateString("en-IN")}\n⏳ ${days} days remaining`, intent, quickReplies: ["Book a service", "Renew plan"] };
  }
  if (intent === "my_bookings") {
    if (!userId) return { message: "🔐 Please sign in.", intent };
    const bks = await db.select().from(bookingsTable).where(eq(bookingsTable.userId, userId)).orderBy(desc(bookingsTable.createdAt)).limit(5);
    if (!bks.length) return { message: "No bookings yet!", intent, quickReplies: ["Book a service"] };
    const emoji: Record<string, string> = { pending: "🟡", accepted: "🔵", in_progress: "🔵", completed: "🟢", cancelled: "⚫" };
    return { message: `📋 **Your Recent Bookings:**\n\n${bks.map(b => `${emoji[b.status] || "⚪"} **#${b.id}** — ${b.serviceType} (${b.status.replace("_", " ")})\n   📍 ${b.city} · ₹${b.serviceCharge}`).join("\n\n")}\n\nSay *'Show booking #3'* for details or *'Cancel booking #5'* to cancel.`, intent, quickReplies: bks.filter(b => ["pending", "accepted"].includes(b.status)).map(b => `Show booking #${b.id}`).slice(0, 2).concat(["Book another service"]) };
  }
  if (intent === "water_quality") {
    for (const [c, i] of Object.entries(CITY_TDS)) {
      if (m.includes(c)) return { message: `💧 **${c.charAt(0).toUpperCase() + c.slice(1)} Water Quality**\n\n• TDS: **${i.tds}**\n• Quality: ${i.quality}\n• Hardness: ${i.hardness}\n• ${i.recommendation}\n• ${i.changeFreq}\n• Membrane life: ${i.membraneLife}`, intent, quickReplies: ["Book a service", "Get AMC plan", "Log my TDS"] };
    }
    return { message: `💧 **Water Quality by City:**\n\n${Object.entries(CITY_TDS).map(([c, d]) => `• **${c.charAt(0).toUpperCase() + c.slice(1)}**: ${d.tds} — ${d.quality}`).join("\n")}`, intent, quickReplies: ["Delhi water", "Meerut water", "Mumbai water"] };
  }
  if (intent === "faq") {
    const FAQS: Record<string, string> = {
      "how often": "🔄 **Replacement Guide:**\n• Sediment/Spun: 4–6 months\n• Carbon: 6 months\n• Membrane: 2–3 years\n• UV lamp: 12 months\n\n📋 AMC handles all of this automatically!",
      "guarantee": "🛡️ 30-day warranty on all replaced parts. Free revisit if issue recurs within 30 days.",
      "payment": "💳 Cash / UPI (PhonePe, GPay, Paytm) / Card. Pay only after approving the bill!",
      "what is amc": "📋 AMC = Annual Maintenance Contract. Fixed yearly cost covering all filter replacements + service visits. Saves ₹1,500–₹3,000 vs per-visit pricing.",
      "how long": "⏱️ Filter replacement: 30–45 min\nPump replacement: 45–60 min\nFull service: 1–2 hours\nNew installation: 1.5–2.5 hours",
    };
    for (const [k, a] of Object.entries(FAQS)) { if (m.includes(k)) return { message: a, intent, quickReplies: ["Book a service", "Get AMC plan"] }; }
  }

  // ── Default ───────────────────────────────────────────────────────────────
  setSession(sid, { step: "idle" });
  const seasonal = getSeasonalAlert();
  const greeting = userId ? "Welcome back! " : "";
  return {
    message: `👋 **${greeting}Hi! I'm AquaBot** — AI-powered RO assistant\n\n${seasonal ? seasonal + "\n\n" : ""}What I can do:\n🔍 **Diagnose** RO problems (AI-powered)\n🏥 **RO Health Score** — 5-question assessment\n📊 **TDS Trend Analysis** — track water quality\n📅 **Book a technician** — instant or scheduled\n❌ **Cancel bookings** via chat\n⭐ **Rate services** via chat\n💰 **Transparent pricing** — no surprises\n📋 **AMC plans** — save ₹2,000+/year\n💧 **Water quality** by city\n🇮🇳 **Hindi support**\n🎤 **Voice input** (click mic button)\n\n**Just describe your problem!**`,
    intent,
    quickReplies: ["My RO has no water", "Check RO health score", "Log my TDS", "Book a service", "What is AMC?"],
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { message, sessionId, userId, userLat, userLng, detectedAddress, detectedCity } = req.body;
    if (!message || !sessionId) { res.status(400).json({ error: "Missing fields" }); return; }
    if (!history.has(sessionId)) history.set(sessionId, []);
    if (userLat && userLng) {
      const s = getSession(sessionId);
      if (s.step === "awaiting_address") setSession(sessionId, { ...s, detectedAddress, detectedCity });
    }
    history.get(sessionId)!.push({ role: "user", content: message, timestamp: new Date().toISOString() });
    const response = await respond(message, sessionId, userId ? Number(userId) : undefined, userLat, userLng, detectedAddress, detectedCity);
    history.get(sessionId)!.push({ role: "assistant", content: response.message, timestamp: new Date().toISOString() });
    res.json({ ...response, sessionId });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/history", async (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) { res.status(400).json({ error: "Missing sessionId" }); return; }
  res.json(history.get(sessionId as string) || []);
});

export default router;
