import { Router } from "express";
import { db, techniciansTable } from "../lib/db.js";
import { eq, and } from "drizzle-orm";
import { requireTechnician, AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.get("/nearby", async (req, res) => {
  try {
    const techs = await db.select({
      id: techniciansTable.id, name: techniciansTable.name, city: techniciansTable.city,
      lat: techniciansTable.lat, lng: techniciansTable.lng, isAvailable: techniciansTable.isAvailable,
      rating: techniciansTable.rating, totalJobs: techniciansTable.totalJobs, experience: techniciansTable.experience,
    }).from(techniciansTable).where(and(eq(techniciansTable.isAvailable, true), eq(techniciansTable.isActive, true))).limit(10);
    res.json(techs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/me", requireTechnician as any, async (req: AuthRequest, res) => {
  try {
    const [tech] = await db.select().from(techniciansTable).where(eq(techniciansTable.id, req.technicianId!)).limit(1);
    if (!tech) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ id: tech.id, name: tech.name, email: tech.email, phone: tech.phone, city: tech.city, isAvailable: tech.isAvailable, rating: tech.rating, totalJobs: tech.totalJobs, experience: tech.experience });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/me/availability", requireTechnician as any, async (req: AuthRequest, res) => {
  try {
    const { isAvailable } = req.body;
    const [tech] = await db.update(techniciansTable).set({ isAvailable, updatedAt: new Date() }).where(eq(techniciansTable.id, req.technicianId!)).returning();
    res.json({ id: tech.id, isAvailable: tech.isAvailable });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
