import { Router } from "express";
import { db, roHealthTable } from "../lib/db.js";
import { eq, desc } from "drizzle-orm";
import { requireUser, AuthRequest } from "../middlewares/auth.js";

const router = Router();

// ── Score calculation ─────────────────────────────────────────────────────────
function calculateHealth(data: {
  roAge: number;           // months
  lastServiceMonths: number;
  currentTds: number;
  waterTaste: string;      // "good" | "ok" | "bad"
  flowSpeed: string;       // "fast" | "normal" | "slow" | "very_slow"
}): { score: number; status: string; recommendation: string } {
  let score = 100;

  // Age deduction (older = worse)
  if (data.roAge > 60)       score -= 30;
  else if (data.roAge > 36)  score -= 20;
  else if (data.roAge > 24)  score -= 10;

  // Last service deduction
  if (data.lastServiceMonths > 12)      score -= 25;
  else if (data.lastServiceMonths > 6)  score -= 15;
  else if (data.lastServiceMonths > 3)  score -= 5;

  // TDS deduction
  if (data.currentTds > 300)       score -= 30;
  else if (data.currentTds > 150)  score -= 15;
  else if (data.currentTds < 20)   score -= 10; // too pure

  // Water taste
  if (data.waterTaste === "bad")  score -= 15;
  if (data.waterTaste === "ok")   score -= 5;

  // Flow speed
  if (data.flowSpeed === "very_slow")  score -= 20;
  if (data.flowSpeed === "slow")       score -= 10;

  score = Math.max(0, Math.min(100, score));

  let status: string;
  let recommendation: string;

  if (score >= 80) {
    status = "Excellent";
    recommendation = "Your RO is in great health! Schedule a routine filter check in 3–4 months.";
  } else if (score >= 60) {
    status = "Good";
    recommendation = "Your RO is functioning well. Consider scheduling a service visit within 1–2 months.";
  } else if (score >= 40) {
    status = "Needs Attention";
    recommendation = "Several indicators suggest your RO needs servicing soon. Book a technician within 2 weeks.";
  } else {
    status = "Critical";
    recommendation = "Your RO purifier has critical issues. Book an emergency service immediately to ensure safe water.";
  }

  return { score, status, recommendation };
}

// POST /api/ro-health — submit assessment answers, get score, persist
router.post("/", requireUser as any, async (req: AuthRequest, res) => {
  try {
    const { roAge, lastServiceMonths, currentTds, waterTaste, flowSpeed } = req.body;
    if (roAge == null || lastServiceMonths == null || currentTds == null || !waterTaste || !flowSpeed) {
      res.status(400).json({ error: "All fields required: roAge, lastServiceMonths, currentTds, waterTaste, flowSpeed" });
      return;
    }
    const { score, status, recommendation } = calculateHealth({
      roAge: parseInt(roAge), lastServiceMonths: parseInt(lastServiceMonths),
      currentTds: parseInt(currentTds), waterTaste, flowSpeed,
    });
    const [record] = await db.insert(roHealthTable).values({
      userId: req.userId!, score, status, recommendation,
      roAge: parseInt(roAge), lastServiceMonths: parseInt(lastServiceMonths),
      currentTds: parseInt(currentTds), waterTaste, flowSpeed,
    }).returning();
    res.status(201).json(record);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/ro-health — latest assessment for this user
router.get("/", requireUser as any, async (req: AuthRequest, res) => {
  try {
    const [latest] = await db.select().from(roHealthTable)
      .where(eq(roHealthTable.userId, req.userId!))
      .orderBy(desc(roHealthTable.createdAt))
      .limit(1);
    res.json(latest || null);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/ro-health/history — all assessments
router.get("/history", requireUser as any, async (req: AuthRequest, res) => {
  try {
    const records = await db.select().from(roHealthTable)
      .where(eq(roHealthTable.userId, req.userId!))
      .orderBy(desc(roHealthTable.createdAt))
      .limit(10);
    res.json(records);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;