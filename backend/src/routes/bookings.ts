import { Router } from "express";
import { db, bookingsTable, bookingPartsTable, techniciansTable, usersTable, partsTable, tdsReadingsTable } from "../lib/db.js";
import { eq, and, isNull, or, desc } from "drizzle-orm";
import { requireUser, requireTechnician, requireAuth, AuthRequest } from "../middlewares/auth.js";

const router = Router();
const SERVICE_CHARGE = 199;

// POST /api/bookings — create booking
router.post("/", requireUser as any, async (req: AuthRequest, res) => {
  try {
    const { serviceType, bookingType, scheduledAt, address, city, description, symptoms, lat, lng, estimatedCost } = req.body;
    if (!serviceType || !bookingType || !address || !city) { res.status(400).json({ error: "Missing required fields" }); return; }
    // @ts-ignore drizzle 0.36 insert type
    const [booking] = await db.insert(bookingsTable).values({
      userId: req.userId!, technicianId: null, serviceType, status: "pending",
      bookingType, scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      address, city, description, symptoms, lat: lat?.toString(), lng: lng?.toString(),
      serviceCharge: SERVICE_CHARGE.toString(), estimatedCost: estimatedCost || null,
    }).returning();
    res.status(201).json({ ...booking, partsUsed: [] });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/bookings — user bookings
router.get("/", requireUser as any, async (req: AuthRequest, res) => {
  try {
    const bookings = await db.select({
      id: bookingsTable.id, userId: bookingsTable.userId, technicianId: bookingsTable.technicianId,
      serviceType: bookingsTable.serviceType, status: bookingsTable.status,
      bookingType: bookingsTable.bookingType, scheduledAt: bookingsTable.scheduledAt,
      address: bookingsTable.address, city: bookingsTable.city,
      description: bookingsTable.description, symptoms: bookingsTable.symptoms,
      serviceCharge: bookingsTable.serviceCharge, finalAmount: bookingsTable.finalAmount,
      estimatedCost: bookingsTable.estimatedCost, notes: bookingsTable.notes,
      createdAt: bookingsTable.createdAt, updatedAt: bookingsTable.updatedAt,
      techName: techniciansTable.name, techPhone: techniciansTable.phone,
      techLat: techniciansTable.lat, techLng: techniciansTable.lng,
      techRating: techniciansTable.rating,
    }).from(bookingsTable)
      .leftJoin(techniciansTable, eq(bookingsTable.technicianId, techniciansTable.id))
      .where(eq(bookingsTable.userId, req.userId!))
      .orderBy(desc(bookingsTable.createdAt));
    res.json(bookings);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/bookings/:id — single booking with parts
router.get("/:id", requireAuth as any, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [booking] = await db.select({
      id: bookingsTable.id, userId: bookingsTable.userId, technicianId: bookingsTable.technicianId,
      serviceType: bookingsTable.serviceType, status: bookingsTable.status,
      bookingType: bookingsTable.bookingType, address: bookingsTable.address, city: bookingsTable.city,
      description: bookingsTable.description, symptoms: bookingsTable.symptoms,
      serviceCharge: bookingsTable.serviceCharge, finalAmount: bookingsTable.finalAmount,
      estimatedCost: bookingsTable.estimatedCost, notes: bookingsTable.notes,
      createdAt: bookingsTable.createdAt, updatedAt: bookingsTable.updatedAt,
      techName: techniciansTable.name, techPhone: techniciansTable.phone,
      techLat: techniciansTable.lat, techLng: techniciansTable.lng, techRating: techniciansTable.rating,
    }).from(bookingsTable)
      .leftJoin(techniciansTable, eq(bookingsTable.technicianId, techniciansTable.id))
      .where(eq(bookingsTable.id, id)).limit(1);
    if (!booking) { res.status(404).json({ error: "Not found" }); return; }
    const parts = await db.select().from(bookingPartsTable).where(eq(bookingPartsTable.bookingId, id));
    res.json({ ...booking, partsUsed: parts });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/bookings/:id/cancel — user cancels
router.post("/:id/cancel", requireUser as any, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [booking] = await db.select().from(bookingsTable).where(and(eq(bookingsTable.id, id), eq(bookingsTable.userId, req.userId!))).limit(1);
    if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
    if (["completed", "cancelled"].includes(booking.status)) { res.status(400).json({ error: "Cannot cancel a completed or already cancelled booking" }); return; }
    // @ts-ignore drizzle 0.36 insert type
    const [updated] = await db.update(bookingsTable).set({ status: "cancelled", updatedAt: new Date() }).where(eq(bookingsTable.id, id)).returning();
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/bookings/:id/accept — technician accepts
router.post("/:id/accept", requireTechnician as any, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [booking] = await db.update(bookingsTable)
      // @ts-ignore drizzle 0.36 insert type
      .set({ status: "accepted", technicianId: req.technicianId!, updatedAt: new Date() })
      .where(and(eq(bookingsTable.id, id), eq(bookingsTable.status, "pending"), isNull(bookingsTable.technicianId)))
      .returning();
    if (!booking) { res.status(409).json({ error: "Job already claimed or does not exist" }); return; }
    res.json(booking);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/bookings/:id/status — technician updates status
router.patch("/:id/status", requireTechnician as any, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { status } = req.body;
    if (!["in_progress", "completed", "cancelled"].includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
    // @ts-ignore drizzle 0.36 insert type
    const [booking] = await db.update(bookingsTable).set({ status, updatedAt: new Date() })
      .where(and(eq(bookingsTable.id, id), eq(bookingsTable.technicianId, req.technicianId!))).returning();
    if (!booking) { res.status(404).json({ error: "Not found" }); return; }
    res.json(booking);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/bookings/:id/bill — technician generates bill
router.post("/:id/bill", requireTechnician as any, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { parts = [], serviceCharge, notes, tdsBefore, tdsAfter } = req.body;
    // Clear old parts for this booking (in case re-generating)
    await db.delete(bookingPartsTable).where(eq(bookingPartsTable.bookingId, id));
    let partsTotal = 0;
    const billParts: any[] = [];
    for (const p of parts) {
      const [part] = await db.select().from(partsTable).where(eq(partsTable.id, p.partId)).limit(1);
      if (!part) continue;
      const unitPrice = parseFloat(p.customPrice?.toString() || part.maxPrice?.toString() || "0");
      const qty = p.quantity || 1;
      const totalPrice = unitPrice * qty;
      partsTotal += totalPrice;
      // @ts-ignore drizzle 0.36 insert type
      await db.insert(bookingPartsTable).values({ bookingId: id, partId: p.partId, partName: part.name, quantity: qty, unitPrice: unitPrice.toString(), totalPrice: totalPrice.toString() });
      billParts.push({ partId: p.partId, partName: part.name, quantity: qty, unitPrice, totalPrice });
    }
    const sc = serviceCharge ?? SERVICE_CHARGE;
    const totalAmount = partsTotal + sc;

    // Save bill + TDS readings to booking
    const [updated] = await db.update(bookingsTable)
      .set({
      // @ts-ignore drizzle 0.36 update type
      finalAmount: totalAmount.toString(),
      status: "completed",
      notes,
      tdsBefore: tdsBefore ? parseInt(tdsBefore) : null,
      tdsAfter: tdsAfter ? parseInt(tdsAfter) : null,
      updatedAt: new Date(),
    }).where(eq(bookingsTable.id, id)).returning();

    // Auto-log technician-verified TDS reading to customer's trend
    if (updated && tdsAfter) {
      // @ts-ignore drizzle 0.36 insert type
      await db.insert(tdsReadingsTable).values({
        userId: updated.userId,
        tdsValue: parseInt(tdsAfter),
        city: updated.city,
        notes: `After service #${id} by technician`,
      }).catch(() => {});
    }
    // Also log before reading for trend context
    if (updated && tdsBefore) {
      // @ts-ignore drizzle 0.36 insert type
      await db.insert(tdsReadingsTable).values({
        userId: updated.userId,
        tdsValue: parseInt(tdsBefore),
        city: updated.city,
        notes: `Before service #${id}`,
      }).catch(() => {});
    }

    res.json({ bookingId: id, parts: billParts, serviceCharge: sc, partsTotal, totalAmount, notes, tdsBefore, tdsAfter, booking: updated });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/bookings/:id/location — technician updates live location
router.patch("/:id/location", requireTechnician as any, async (req: AuthRequest, res) => {
  try {
    const { lat, lng } = req.body;
    if (!lat || !lng) { res.status(400).json({ error: "lat and lng required" }); return; }
    // Update the technician's lat/lng (customers query booking which joins technician)
    // @ts-ignore drizzle 0.36 insert type
    await db.update(techniciansTable).set({ lat: lat.toString(), lng: lng.toString() }).where(eq(techniciansTable.id, req.technicianId!));
    res.json({ success: true, lat, lng });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/bookings/technician/jobs — technician's job pool + my jobs
router.get("/technician/jobs", requireTechnician as any, async (req: AuthRequest, res) => {
  try {
    const bookings = await db.select({
      id: bookingsTable.id, userId: bookingsTable.userId, technicianId: bookingsTable.technicianId,
      serviceType: bookingsTable.serviceType, status: bookingsTable.status, bookingType: bookingsTable.bookingType,
      scheduledAt: bookingsTable.scheduledAt, address: bookingsTable.address, city: bookingsTable.city,
      description: bookingsTable.description, symptoms: bookingsTable.symptoms,
      serviceCharge: bookingsTable.serviceCharge, finalAmount: bookingsTable.finalAmount,
      estimatedCost: bookingsTable.estimatedCost, notes: bookingsTable.notes,
      createdAt: bookingsTable.createdAt, updatedAt: bookingsTable.updatedAt,
      userName: usersTable.name, userPhone: usersTable.phone,
    }).from(bookingsTable)
      .leftJoin(usersTable, eq(bookingsTable.userId, usersTable.id))
      .where(or(
        and(eq(bookingsTable.status, "pending"), isNull(bookingsTable.technicianId)),
        eq(bookingsTable.technicianId, req.technicianId!)
      ))
      .orderBy(desc(bookingsTable.createdAt));
    res.json(bookings);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/bookings/technician/earnings
router.get("/technician/earnings", requireTechnician as any, async (req: AuthRequest, res) => {
  try {
    const all = await db.select().from(bookingsTable).where(eq(bookingsTable.technicianId, req.technicianId!));
    const completed = all.filter(b => b.status === "completed");
    const totalEarnings = completed.reduce((s, b) => s + parseFloat(b.finalAmount?.toString() || "0"), 0);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = completed.filter(b => new Date(b.createdAt) >= monthStart).reduce((s, b) => s + parseFloat(b.finalAmount?.toString() || "0"), 0);
    res.json({ totalEarnings, thisMonthEarnings: thisMonth, totalJobs: all.length, completedJobs: completed.length, pendingJobs: all.filter(b => b.status === "pending").length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
