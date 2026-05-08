import { Router } from "express";
import { db, productsTable, partsTable, amcPlansTable, amcSubscriptionsTable } from "../lib/db.js";
import { eq, and } from "drizzle-orm";
import { requireUser, AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.get("/products", async (req, res) => {
  try {
    const { category } = req.query;
    const rows = category
      ? await db.select().from(productsTable).where(and(eq(productsTable.inStock, true), eq(productsTable.category, category as string)))
      : await db.select().from(productsTable).where(eq(productsTable.inStock, true));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/products/:id", async (req, res) => {
  try {
    const [p] = await db.select().from(productsTable).where(eq(productsTable.id, parseInt(req.params.id as string))).limit(1);
    if (!p) { res.status(404).json({ error: "Not found" }); return; }
    res.json(p);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/parts", async (req, res) => {
  try {
    const parts = await db.select().from(partsTable).where(eq(partsTable.isActive, true));
    res.json(parts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/amc-plans", async (req, res) => {
  try {
    const plans = await db.select().from(amcPlansTable).where(eq(amcPlansTable.isActive, true));
    res.json(plans);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/amc-plans/subscribe", requireUser as any, async (req: AuthRequest, res) => {
  try {
    const { planId } = req.body;
    const [plan] = await db.select().from(amcPlansTable).where(eq(amcPlansTable.id, planId)).limit(1);
    if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + plan.duration);
    // @ts-ignore drizzle 0.36 insert type
    const [sub] = await db.insert(amcSubscriptionsTable).values({ userId: req.userId!, planId, endDate, status: "active" }).returning();
    res.status(201).json({ ...sub, planName: plan.name });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;

// GET /api/amc-plans/my-subscription — customer's active AMC
router.get("/amc-plans/my-subscription", requireUser as any, async (req: AuthRequest, res) => {
  try {
    const subs = await db.select({
      id: amcSubscriptionsTable.id,
      status: amcSubscriptionsTable.status,
      startDate: amcSubscriptionsTable.startDate,
      endDate: amcSubscriptionsTable.endDate,
      planName: amcPlansTable.name,
      price: amcPlansTable.price,
      features: amcPlansTable.features,
      servicesIncluded: amcPlansTable.servicesIncluded,
    }).from(amcSubscriptionsTable)
      .leftJoin(amcPlansTable, eq(amcSubscriptionsTable.planId, amcPlansTable.id))
      .where(and(eq(amcSubscriptionsTable.userId, req.userId!), eq(amcSubscriptionsTable.status, "active")))
      .limit(1);
    if (!subs.length) { res.json(null); return; }
    res.json(subs[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
