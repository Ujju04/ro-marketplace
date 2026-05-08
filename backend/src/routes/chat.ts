import { Router } from "express";
import { db, productsTable, partsTable, bookingsTable, amcPlansTable, amcSubscriptionsTable, bookingPartsTable, tdsReadingsTable, reviewsTable, techniciansTable } from "../lib/db.js";
import { eq, desc, and, asc } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getChatModel, geminiAvailable, resolveBestModel } from "../lib/gemini.js";
import { retrieveRelevantChunks, isIndexed } from "../lib/vectorStore.js";
import "dotenv/config";

const router = Router();

// ── Session store ─────────────────────────────────────────────────────────────
const sessions = new Map<string, { history: { role: string; parts: { text: string }[] }[]; context: Record<string, any> }>();
const msgHistory = new Map<string, any[]>();

function getSession(id: string) {
  if (!sessions.has(id)) sessions.set(id, { history: [], context: {} });
  return sessions.get(id)!;
}

// ── Gemini Tool Definitions ───────────────────────────────────────────────────
const TOOLS = [{
  functionDeclarations: [
    {
      name: "diagnose_ro_issue",
      description: "Diagnose an RO water purifier problem from symptoms. Returns diagnosis, parts needed, cost estimate.",
      parameters: {
        type: "OBJECT",
        properties: { symptoms: { type: "STRING", description: "Symptoms described by user e.g. no water, bad taste, leaking" } },
        required: ["symptoms"],
      },
    },
    {
      name: "get_price_estimate",
      description: "Get transparent pricing for RO repair parts and service charges.",
      parameters: {
        type: "OBJECT",
        properties: { issue_type: { type: "STRING", description: "Type of issue e.g. membrane, filters, pump, full service" } },
        required: ["issue_type"],
      },
    },
    {
      name: "book_service",
      description: "Create a service booking. Only call when customer provides a real specific address (not placeholder like 'my address').",
      parameters: {
        type: "OBJECT",
        properties: {
          address: { type: "STRING", description: "Full address including street, area, city" },
          city: { type: "STRING", description: "City name" },
          service_type: { type: "STRING", description: "repair, installation, amc, or inspection" },
          symptoms: { type: "STRING", description: "Described symptoms or reason for visit" },
        },
        required: ["address", "city", "service_type"],
      },
    },
    {
      name: "cancel_booking",
      description: "Cancel a customer booking by ID.",
      parameters: {
        type: "OBJECT",
        properties: { booking_id: { type: "NUMBER", description: "Booking ID to cancel" } },
        required: ["booking_id"],
      },
    },
    {
      name: "get_my_bookings",
      description: "Retrieve the customer's recent bookings and their status.",
      parameters: {
        type: "OBJECT",
        properties: { limit: { type: "NUMBER", description: "Number of bookings to retrieve, default 5" } },
      },
    },
    {
      name: "get_booking_details",
      description: "Get full details of a specific booking including parts replaced and bill.",
      parameters: {
        type: "OBJECT",
        properties: { booking_id: { type: "NUMBER", description: "The booking ID" } },
        required: ["booking_id"],
      },
    },
    {
      name: "get_water_quality",
      description: "Get water quality TDS and hardness data for an Indian city.",
      parameters: {
        type: "OBJECT",
        properties: { city: { type: "STRING", description: "City name e.g. Delhi, Mumbai, Meerut" } },
        required: ["city"],
      },
    },
    {
      name: "log_tds_reading",
      description: "Log a TDS reading for customer water quality tracking.",
      parameters: {
        type: "OBJECT",
        properties: {
          tds_value: { type: "NUMBER", description: "TDS reading in ppm" },
          city: { type: "STRING", description: "City where reading was taken" },
        },
        required: ["tds_value"],
      },
    },
    {
      name: "get_tds_trend",
      description: "Get the customer historical TDS readings to show water quality trend over time.",
      parameters: { type: "OBJECT", properties: {} },
    },
    {
      name: "get_amc_plans",
      description: "Get available Annual Maintenance Contract plans and pricing.",
      parameters: { type: "OBJECT", properties: {} },
    },
    {
      name: "get_product_recommendations",
      description: "Get recommended RO water purifier products for purchase.",
      parameters: {
        type: "OBJECT",
        properties: { budget: { type: "STRING", description: "Budget range if mentioned e.g. under 10000, premium" } },
      },
    },
    {
      name: "rate_service",
      description: "Submit a rating and review for a completed service booking.",
      parameters: {
        type: "OBJECT",
        properties: {
          booking_id: { type: "NUMBER", description: "Booking ID to rate" },
          rating: { type: "NUMBER", description: "Rating 1-5 stars" },
          comment: { type: "STRING", description: "Optional review comment" },
        },
        required: ["booking_id", "rating"],
      },
    },
  ],
}];

// ── Tool executor ─────────────────────────────────────────────────────────────
async function executeTool(name: string, args: Record<string, any>, userId?: number): Promise<{ result: string; data?: any }> {

  if (name === "diagnose_ro_issue") {
    const symptoms = args.symptoms?.toLowerCase() || "";
    const parts = await db.select().from(partsTable).where(eq(partsTable.isActive, true));
    const symptomPartMap: Record<string, string[]> = {
      "no water":   ["RO Pump", "Solenoid Valve", "Adapter"],
      "slow":       ["Membrane", "Sediment Filter", "Flow Resistor"],
      "low pressure": ["Sediment Filter", "Carbon Filter"],
      "taste":      ["Carbon Filter", "Membrane"],
      "smell":      ["Carbon Filter"],
      "leak":       ["Adapter", "Tape"],
      "noise":      ["RO Pump"],
      "yellow":     ["Spun Filter", "Sediment Filter"],
      "tds":        ["Membrane", "Flow Resistor"],
      "uv":         ["UV Lamp", "UV Adapter"],
      "filter":     ["Carbon Filter", "Sediment Filter", "Spun Filter"],
      "installation": [],
    };
    let matchedPartNames: string[] = [];
    for (const [keyword, partNames] of Object.entries(symptomPartMap)) {
      if (symptoms.includes(keyword)) { matchedPartNames = partNames; break; }
    }
    if (!matchedPartNames.length) matchedPartNames = ["Carbon Filter", "Sediment Filter"];
    const matchedParts = parts.filter(p => matchedPartNames.some(n => p.name.includes(n)));
    const minCost = matchedParts.reduce((s, p) => s + parseFloat(p.minPrice?.toString() || "0"), 199);
    const maxCost = matchedParts.reduce((s, p) => s + parseFloat(p.maxPrice?.toString() || "0"), 199);
    return {
      result: JSON.stringify({
        symptoms: args.symptoms,
        likely_parts: matchedParts.map(p => ({ name: p.name, price_range: `₹${p.minPrice}–₹${p.maxPrice}` })),
        service_charge: 199,
        estimated_total: `₹${minCost}–₹${maxCost}`,
        severity: symptoms.includes("no water") || symptoms.includes("leak") || symptoms.includes("yellow") ? "HIGH" : "MEDIUM",
      }),
      data: {
        estimate: {
          parts: matchedParts.map(p => ({ name: p.name, minPrice: parseFloat(p.minPrice?.toString() || "0"), maxPrice: parseFloat(p.maxPrice?.toString() || "0") })),
          serviceCharge: 199, totalMin: minCost, totalMax: maxCost,
        },
      },
    };
  }

  if (name === "get_price_estimate") {
    const parts = await db.select().from(partsTable).where(eq(partsTable.isActive, true));
    const priceList = parts.map(p => `${p.name}: ₹${p.minPrice}${p.minPrice !== p.maxPrice ? `–₹${p.maxPrice}` : ""}`).join(", ");
    return { result: `Parts pricing: ${priceList}. Service visit: ₹199. 30-day warranty. Customer approves before any replacement.` };
  }

  if (name === "book_service") {
    if (!userId) return { result: "Customer must be signed in to book. Ask them to sign in first." };
    const addr = args.address || "";
    if (addr.toLowerCase().includes("my address") || addr.split(" ").length < 3) {
      return { result: "Address is not specific enough. Ask the customer for full address: house/flat number, street, area/colony, city." };
    }
    try {
      const [booking] = await db.insert(bookingsTable).values({
        userId, technicianId: null,
        serviceType: args.service_type || "repair",
        status: "pending", bookingType: "instant",
        address: addr,
        city: args.city?.toLowerCase() || addr.split(",")[0].trim().toLowerCase(),
        symptoms: args.symptoms || "",
        serviceCharge: "199",
      }).returning();
      return {
        result: `Booking #${booking.id} confirmed. Service: ${args.service_type}. Address: ${addr}. Technician will accept within 60 minutes.`,
        data: { bookingCreated: { id: booking.id, status: "pending" } },
      };
    } catch (e: any) { return { result: `Booking failed: ${e.message}` }; }
  }

  if (name === "cancel_booking") {
    if (!userId) return { result: "Customer must be signed in." };
    const [b] = await db.select().from(bookingsTable).where(and(eq(bookingsTable.id, args.booking_id), eq(bookingsTable.userId, userId))).limit(1);
    if (!b) return { result: `Booking #${args.booking_id} not found for this customer.` };
    if (["completed", "cancelled"].includes(b.status)) return { result: `Booking #${args.booking_id} is already ${b.status}.` };
    await db.update(bookingsTable).set({ status: "cancelled", updatedAt: new Date() }).where(eq(bookingsTable.id, args.booking_id));
    return { result: `Booking #${args.booking_id} cancelled successfully.` };
  }

  if (name === "get_my_bookings") {
    if (!userId) return { result: "Customer must be signed in." };
    const bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.userId, userId)).orderBy(desc(bookingsTable.createdAt)).limit(args.limit || 5);
    if (!bookings.length) return { result: "No bookings found for this customer." };
    return {
      result: JSON.stringify(bookings.map(b => ({
        id: b.id, status: b.status, service_type: b.serviceType,
        city: b.city, date: b.createdAt, final_amount: b.finalAmount, service_charge: b.serviceCharge,
      }))),
    };
  }

  if (name === "get_booking_details") {
    if (!userId) return { result: "Customer must be signed in." };
    const [b] = await db.select().from(bookingsTable).where(and(eq(bookingsTable.id, args.booking_id), eq(bookingsTable.userId, userId))).limit(1);
    if (!b) return { result: `Booking #${args.booking_id} not found.` };
    const parts = await db.select().from(bookingPartsTable).where(eq(bookingPartsTable.bookingId, args.booking_id));
    return {
      result: JSON.stringify({
        id: b.id, status: b.status, service_type: b.serviceType,
        address: b.address, city: b.city, symptoms: b.symptoms,
        service_charge: b.serviceCharge, final_amount: b.finalAmount,
        tds_before: b.tdsBefore, tds_after: b.tdsAfter, notes: b.notes,
        parts_replaced: parts.map(p => ({ name: p.partName, qty: p.quantity, price: p.totalPrice })),
      }),
    };
  }

  if (name === "get_water_quality") {
    const cityData: Record<string, any> = {
      delhi:     { tds: "400–500 ppm", quality: "Very High", hardness: "Very Hard", membrane_life: "12 months", filter_freq: "every 4 months" },
      meerut:    { tds: "450–600 ppm", quality: "Very High", hardness: "Very Hard", membrane_life: "10–12 months", filter_freq: "every 4 months" },
      rohtak:    { tds: "400–550 ppm", quality: "Very High", hardness: "Very Hard", membrane_life: "10–14 months", filter_freq: "every 4 months" },
      mumbai:    { tds: "100–200 ppm", quality: "Moderate",  hardness: "Soft",      membrane_life: "24–30 months", filter_freq: "every 8 months" },
      bangalore: { tds: "250–300 ppm", quality: "High",      hardness: "Moderate",  membrane_life: "18–24 months", filter_freq: "every 6 months" },
      chennai:   { tds: "300–400 ppm", quality: "High",      hardness: "Hard",      membrane_life: "14–18 months", filter_freq: "every 6 months" },
      hyderabad: { tds: "280–350 ppm", quality: "High",      hardness: "Moderate",  membrane_life: "16–20 months", filter_freq: "every 6 months" },
      pune:      { tds: "200–280 ppm", quality: "Moderate",  hardness: "Moderate",  membrane_life: "20–24 months", filter_freq: "every 7–8 months" },
      noida:     { tds: "380–480 ppm", quality: "Very High", hardness: "Very Hard",  membrane_life: "12–14 months", filter_freq: "every 4–5 months" },
      gurgaon:   { tds: "350–450 ppm", quality: "High",      hardness: "Hard",      membrane_life: "12–15 months", filter_freq: "every 5 months" },
    };
    const city = args.city?.toLowerCase().trim();
    const data = cityData[city];
    if (!data) return { result: `No data for ${args.city}. Available: Delhi, Meerut, Mumbai, Bangalore, Chennai, Hyderabad, Pune, Noida, Rohtak, Gurgaon.` };
    return { result: JSON.stringify({ city: args.city, ...data }) };
  }

  if (name === "log_tds_reading") {
    if (!userId) return { result: "Customer must be signed in to log TDS readings." };
    const tds = args.tds_value;
    await db.insert(tdsReadingsTable).values({ userId, tdsValue: tds, city: args.city || null });
    const status = tds < 50 ? "Too low — may lack minerals" : tds > 300 ? "Very high — membrane replacement needed urgently" : tds > 150 ? "Above safe limit — monitor closely" : "Ideal (50–150 ppm) — safe to drink";
    return { result: `TDS ${tds} ppm logged. Status: ${status}` };
  }

  if (name === "get_tds_trend") {
    if (!userId) return { result: "Customer must be signed in." };
    const readings = await db.select().from(tdsReadingsTable).where(eq(tdsReadingsTable.userId, userId)).orderBy(asc(tdsReadingsTable.createdAt)).limit(10);
    if (readings.length < 2) return { result: "Fewer than 2 TDS readings. Not enough for trend analysis. Encourage customer to log readings monthly." };
    const first = readings[0].tdsValue; const last = readings[readings.length - 1].tdsValue;
    const trend = last > first + 30 ? "Rising significantly — membrane may be degrading" : last > first ? "Slightly rising" : last < first ? "Falling — improvement detected" : "Stable";
    return {
      result: JSON.stringify({ readings: readings.map(r => ({ date: r.createdAt, value: r.tdsValue })), trend, change: last - first }),
      data: { tdsReadings: readings.map(r => ({ date: r.createdAt, value: r.tdsValue })) },
    };
  }

  if (name === "get_amc_plans") {
    const plans = await db.select().from(amcPlansTable).where(eq(amcPlansTable.isActive, true));
    return {
      result: JSON.stringify(plans.map(p => ({ id: p.id, name: p.name, price: p.price, description: p.description, visits: p.servicesIncluded, features: p.features }))),
      data: { amcPlans: plans.map(p => ({ id: p.id, name: p.name, price: parseFloat(p.price?.toString() || "0"), description: p.description, visits: p.servicesIncluded, features: p.features })) },
    };
  }

  if (name === "get_product_recommendations") {
    const products = await db.select().from(productsTable).where(eq(productsTable.inStock, true)).limit(4);
    return {
      result: JSON.stringify(products.map(p => ({ id: p.id, name: p.name, brand: p.brand, description: p.description, rating: p.rating, features: p.features }))),
      data: { products: products.map(p => ({ id: p.id, name: p.name, description: p.description, rating: parseFloat(p.rating?.toString() || "4"), brand: p.brand })) },
      // price intentionally omitted — customers should contact AquaCare for current pricing
    };
  }

  if (name === "rate_service") {
    if (!userId) return { result: "Customer must be signed in." };
    const [b] = await db.select().from(bookingsTable).where(and(eq(bookingsTable.id, args.booking_id), eq(bookingsTable.userId, userId))).limit(1);
    if (!b || b.status !== "completed") return { result: `Booking #${args.booking_id} not found or not completed.` };
    if (b.technicianId) {
      await db.insert(reviewsTable).values({ userId, technicianId: b.technicianId, bookingId: args.booking_id, rating: args.rating, comment: args.comment || null }).catch(() => {});
    }
    return { result: `Review submitted: ${args.rating} stars for Booking #${args.booking_id}. Thank you!` };
  }

  return { result: "Unknown tool." };
}

// ── System prompt with RAG context ────────────────────────────────────────────
function buildSystemPrompt(ragContext: string, userId?: number): string {
  const month = new Date().getMonth() + 1;
  const seasonal = month >= 4 && month <= 6
    ? "\n⚠️ SEASONAL: Summer — membranes clog 30% faster. Proactively suggest maintenance."
    : month >= 7 && month <= 9
    ? "\n⚠️ SEASONAL: Monsoon — higher turbidity. Remind about sediment filter checks."
    : "";

  return `You are AquaBot, an expert AI assistant for AquaCare — India's RO water purifier service platform. You are powered by Gemini with real-time tool access and a domain knowledge base (RAG).

## Your Role:
Help customers with RO purifier problems — diagnose issues, book technicians, track water quality, manage bookings, and provide expert maintenance advice.

## Scope — STRICTLY ENFORCE:
You ONLY discuss topics directly related to:
- RO / water purifier diagnosis, repair, maintenance, and installation
- Water quality (TDS, hardness, contamination)
- AquaCare services: bookings, technicians, AMC plans, spare parts, pricing
- RO product recommendations and comparisons

If a user asks about ANYTHING outside this scope (general knowledge, politics, coding, recipes, entertainment, finance, unrelated products, etc.), respond ONLY with:
"I'm AquaBot, specialized in RO water purifiers and AquaCare services. I can't help with that, but I'm happy to assist with any RO or water quality questions! 💧"
Do NOT engage with, answer, or acknowledge off-topic requests in any other way. Do not explain why you can't help beyond this message.

## Tools Available (call them proactively):
- diagnose_ro_issue: When customer describes a problem
- get_price_estimate: When asked about costs
- book_service: When customer wants a technician (need REAL address first)
- cancel_booking: When customer wants to cancel
- get_my_bookings: When asked about booking history
- get_booking_details: When asked about a specific booking
- get_water_quality: When asked about city water or TDS
- log_tds_reading: When customer shares a TDS number
- get_tds_trend: When asked about TDS history
- get_amc_plans: When discussing annual maintenance
- get_product_recommendations: When customer wants to buy an RO
- rate_service: When customer wants to give feedback

## Critical Rules:
1. NEVER book without a real address. "My address", "Delhi my area" are NOT valid. Always ask for house/flat number + street + area + city.
2. When GPS coordinates are provided in the message, use that address directly for booking.
3. Always show cost breakdown (parts + ₹199 service charge) before confirming booking.
4. After booking, remind: keep RO plugged in, inlet valve open, be available at address.
5. Support Hindi — if user writes in Hindi, respond in Hindi using Devanagari script.
6. Be concise but complete. Use emojis naturally. Format with markdown.
7. ₹199 service charge applies to all visits (waived for AMC customers).
8. 30-day warranty on all replaced parts.
9. For angry/frustrated users: empathize first, then solve.
10. Mention AMC when customer discusses recurring maintenance.
11. NEVER mention product purchase prices (e.g. "Kent Grand Plus costs ₹14,999"). You may describe products and their features freely, but for pricing always say "Contact AquaCare for current pricing". Service/parts prices (₹199 charge, filter costs) ARE allowed.
${seasonal}
${userId ? "Customer is signed in (userId: " + userId + ")." : "Customer is NOT signed in. For bookings/history, ask them to sign in."}

## Retrieved Knowledge Base (RAG):
${ragContext || "No specific context retrieved. Use your general RO domain expertise."}

Respond naturally and helpfully. Call tools when needed — you can call multiple tools in sequence to answer complex questions.`;
}

// ── Gemini agentic chat ───────────────────────────────────────────────────────
// ── Gemini agentic chat ───────────────────────────────────────────────────────
async function handleGeminiChat(
  message: string, sessionId: string, userId?: number,
  userLat?: number, userLng?: number, detectedAddress?: string, detectedCity?: string,
  imageBase64?: string, imageMimeType?: string,
): Promise<any> {
  const session = getSession(sessionId);

  // Enrich message with GPS context if available
  let fullMessage = message;
  if (userLat && userLng && detectedAddress) {
    fullMessage = `${message}\n[User GPS Location: ${detectedAddress}, ${detectedCity || ""}]`;
  }

  // Build message payload — multipart when an image is attached
  const messagePayload: any = imageBase64 && imageMimeType
    ? [
        { inlineData: { mimeType: imageMimeType, data: imageBase64 } },
        { text: fullMessage || "Please analyse this image of my RO purifier and diagnose any visible issues." },
      ]
    : fullMessage;

  // ── RAG retrieval ─────────────────────────────────────────────────────────
  let ragContext = "";
  try {
    const chunks = await retrieveRelevantChunks(message, 4);
    if (chunks.length > 0) {
      ragContext = chunks
        .map((c, i) => `[Source ${i + 1}] ${c.title}:\n${c.content}`)
        .join("\n\n---\n\n");
      console.log(`📚 RAG: Retrieved ${chunks.length} relevant chunks (top score: ${chunks[0]?.score?.toFixed(3)})`);
    }
  } catch (e) {
    console.warn("RAG unavailable:", (e as Error).message);
  }

  // ── Resolve best model (cached after first call) ─────────────────────────
  const modelName = await resolveBestModel();

// systemInstruction must be set at model creation, not after
  const genAIInstance = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAIInstance.getGenerativeModel({
   model: modelName,
   systemInstruction: buildSystemPrompt(ragContext, userId),
   generationConfig: { temperature: 0.3, topP: 0.8, maxOutputTokens: 1024 },
  });

  let chat: any = model.startChat({
   history: session.history,
   tools: TOOLS as any,
  });
  console.log(`🤖 Using model: ${modelName}`);

  async function sendWithRetry(payload: any, retries = 3): Promise<any> {
    for (let i = 1; i <= retries; i++) {
      try {
        return await chat.sendMessage(payload);
      } catch (e: any) {
        const is429 = e.message?.includes("429") || e.message?.includes("Too Many Requests");
        const waitMatch = e.message?.match(/retry in ([\d.]+)s/i);
        const waitMs = waitMatch ? Math.min(parseFloat(waitMatch[1]), 60) * 1000 : i * 15000;
        if (is429 && i < retries) {
          console.warn(`⏳ Rate limited. Retrying in ${waitMs/1000}s (attempt ${i}/${retries})...`);
          await new Promise(r => setTimeout(r, waitMs));
        } else throw e;
      }
    }
  }

  // ── Agentic tool-calling loop ──────────────────────────────────────────────
  let response = await sendWithRetry(messagePayload);
  let candidate = response.response;
  const aggregatedData: Record<string, any> = {};
  let iterations = 0;

  while (iterations < 6) {
    const functionCalls = candidate.functionCalls();
    if (!functionCalls || functionCalls.length === 0) break;

    console.log(`🔧 Gemini calling ${functionCalls.length} tool(s):`, functionCalls.map(f => f.name).join(", "));

    const toolResults = await Promise.all(
      functionCalls.map(async (fc) => {
        const result = await executeTool(fc.name, fc.args as Record<string, any>, userId);
        if (result.data) Object.assign(aggregatedData, result.data);
        return { functionResponse: { name: fc.name, response: { result: result.result } } };
      })
    );

    response = await sendWithRetry(toolResults as any);
    candidate = response.response;
    iterations++;
  }

  const text = candidate.text();

  // Update conversation history (bounded to last 20 turns)
  session.history.push(
    { role: "user", parts: [{ text: fullMessage }] },
    { role: "model", parts: [{ text }] },
  );
  if (session.history.length > 20) session.history = session.history.slice(-20);

  return { message: text, ...aggregatedData };
}

// ── Minimal rule-based fallback ───────────────────────────────────────────────
async function handleRuleBased(message: string): Promise<any> {
  const m = message.toLowerCase();
  if (/no water|pani nahi|paani nahi/.test(m)) {
    const parts = await db.select().from(partsTable).where(eq(partsTable.isActive, true));
    const relevant = parts.filter(p => ["RO Pump", "Solenoid Valve"].some(n => p.name.includes(n)));
    const min = relevant.reduce((s, p) => s + parseFloat(p.minPrice?.toString() || "0"), 199);
    const max = relevant.reduce((s, p) => s + parseFloat(p.maxPrice?.toString() || "0"), 199);
    return {
      message: "🔍 **Diagnosis: No Water Output**\n\nLikely: RO pump or solenoid valve issue.\n\n> ⚠️ *AI mode inactive — add `GEMINI_API_KEY` to `.env` for full AI*",
      estimate: { parts: relevant.map(p => ({ name: p.name, minPrice: parseFloat(p.minPrice?.toString() || "0"), maxPrice: parseFloat(p.maxPrice?.toString() || "0") })), serviceCharge: 199, totalMin: min, totalMax: max },
      quickReplies: ["Book a technician", "Show all pricing"],
    };
  }
  return {
    message: "👋 Hi! I'm AquaBot.\n\n⚠️ **Full AI mode is inactive.** Add `GEMINI_API_KEY` to your backend `.env` file.\n\nGet a **free key** at [aistudio.google.com](https://aistudio.google.com).",
    quickReplies: ["My RO has no water", "Show pricing", "Book a service"],
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { message, sessionId, userId, userLat, userLng, detectedAddress, detectedCity, imageBase64, imageMimeType } = req.body;
    if ((!message && !imageBase64) || !sessionId) { res.status(400).json({ error: "Missing message or sessionId" }); return; }

    if (!msgHistory.has(sessionId)) msgHistory.set(sessionId, []);
    msgHistory.get(sessionId)!.push({ role: "user", content: message || "📷 Image sent", timestamp: new Date().toISOString() });

    let response: any;
    if (geminiAvailable) {
      try {
        response = await handleGeminiChat(message || "", sessionId, userId ? Number(userId) : undefined, userLat, userLng, detectedAddress, detectedCity, imageBase64, imageMimeType);
      } catch (e: any) {
        console.error("Gemini error:", e.message);
        response = { message: `⚠️ AI temporarily unavailable. Please try again.\n\n*${e.message}*`, quickReplies: ["Try again"] };
      }
    } else {
      response = await handleRuleBased(message);
    }

    msgHistory.get(sessionId)!.push({ role: "assistant", content: response.message, timestamp: new Date().toISOString() });
    res.json({ ...response, sessionId, aiMode: geminiAvailable ? "gemini-1.5-flash-8b+rag" : "rule-based" });
  } catch (e: any) {
    console.error("Chat route error:", e);
    res.status(500).json({ error: e.message });
  }
});

router.get("/history", async (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) { res.status(400).json({ error: "Missing sessionId" }); return; }
  res.json(msgHistory.get(sessionId as string) || []);
});

router.get("/status", async (_req, res) => {
  const indexed = await isIndexed().catch(() => false);
  const activeModel = geminiAvailable ? await resolveBestModel().catch(() => "unknown") : "none";
  res.json({
    aiMode: geminiAvailable ? `${activeModel}+rag` : "rule-based",
    geminiConfigured: geminiAvailable,
    ragIndexed: indexed,
    model: activeModel,
    embeddingModel: "text-embedding-004",
  });
});

export default router;