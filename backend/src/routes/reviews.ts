import { Router } from "express";
import { db, reviewsTable, usersTable, techniciansTable, bookingsTable } from "../lib/db.js";
import { eq, avg, count, desc, and } from "drizzle-orm";
import { requireUser, requireTechnician, AuthRequest } from "../middlewares/auth.js";

const router = Router();

// POST /api/reviews — customer submits a review for a completed booking
router.post("/", requireUser as any, async (req: AuthRequest, res) => {
  try {
    const { bookingId, rating, comment } = req.body;
    if (!bookingId || !rating) { res.status(400).json({ error: "bookingId and rating are required" }); return; }
    if (rating < 1 || rating > 5) { res.status(400).json({ error: "Rating must be between 1 and 5" }); return; }

    // Verify this booking belongs to this user and is completed
    const [booking] = await db.select().from(bookingsTable)
      .where(and(eq(bookingsTable.id, bookingId), eq(bookingsTable.userId, req.userId!)))
      .limit(1);
    if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
    if (booking.status !== "completed") { res.status(400).json({ error: "Can only review completed bookings" }); return; }
    if (!booking.technicianId) { res.status(400).json({ error: "No technician assigned to this booking" }); return; }

    // Check not already reviewed
    const existing = await db.select().from(reviewsTable)
      .where(and(eq(reviewsTable.bookingId, bookingId), eq(reviewsTable.userId, req.userId!)))
      .limit(1);
    if (existing.length) { res.status(400).json({ error: "You have already reviewed this booking" }); return; }

    const [review] = await db.insert(reviewsTable).values({
      userId: req.userId!,
      technicianId: booking.technicianId,
      bookingId,
      rating,
      comment: comment?.trim() || null,
    }).returning();

    // Update technician's average rating
    const stats = await db.select({
      avgRating: avg(reviewsTable.rating),
      totalReviews: count(reviewsTable.id),
    }).from(reviewsTable).where(eq(reviewsTable.technicianId, booking.technicianId));

    if (stats[0]?.avgRating) {
      await db.update(techniciansTable)
        .set({ rating: parseFloat(stats[0].avgRating).toFixed(2) })
        .where(eq(techniciansTable.id, booking.technicianId));
    }

    res.status(201).json({ ...review, message: "Review submitted successfully" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/reviews/technician/:id — public: get all reviews for a technician
router.get("/technician/:id", async (req, res) => {
  try {
    const techId = parseInt(req.params.id as string);
    const reviews = await db.select({
      id: reviewsTable.id,
      rating: reviewsTable.rating,
      comment: reviewsTable.comment,
      createdAt: reviewsTable.createdAt,
      bookingId: reviewsTable.bookingId,
      userName: usersTable.name,
    }).from(reviewsTable)
      .leftJoin(usersTable, eq(reviewsTable.userId, usersTable.id))
      .where(eq(reviewsTable.technicianId, techId))
      .orderBy(desc(reviewsTable.createdAt))
      .limit(20);

    const stats = await db.select({
      avgRating: avg(reviewsTable.rating),
      totalReviews: count(reviewsTable.id),
    }).from(reviewsTable).where(eq(reviewsTable.technicianId, techId));

    res.json({
      reviews,
      averageRating: stats[0]?.avgRating ? parseFloat(stats[0].avgRating).toFixed(1) : null,
      totalReviews: stats[0]?.totalReviews || 0,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/reviews/my — customer's submitted reviews
router.get("/my", requireUser as any, async (req: AuthRequest, res) => {
  try {
    const reviews = await db.select({
      id: reviewsTable.id,
      rating: reviewsTable.rating,
      comment: reviewsTable.comment,
      createdAt: reviewsTable.createdAt,
      bookingId: reviewsTable.bookingId,
      technicianId: reviewsTable.technicianId,
      techName: techniciansTable.name,
    }).from(reviewsTable)
      .leftJoin(techniciansTable, eq(reviewsTable.technicianId, techniciansTable.id))
      .where(eq(reviewsTable.userId, req.userId!))
      .orderBy(desc(reviewsTable.createdAt));
    res.json(reviews);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/reviews/technician/me — technician sees their own reviews
router.get("/technician/me", requireTechnician as any, async (req: AuthRequest, res) => {
  try {
    const reviews = await db.select({
      id: reviewsTable.id,
      rating: reviewsTable.rating,
      comment: reviewsTable.comment,
      createdAt: reviewsTable.createdAt,
      bookingId: reviewsTable.bookingId,
      userName: usersTable.name,
    }).from(reviewsTable)
      .leftJoin(usersTable, eq(reviewsTable.userId, usersTable.id))
      .where(eq(reviewsTable.technicianId, req.technicianId!))
      .orderBy(desc(reviewsTable.createdAt));

    const stats = await db.select({
      avgRating: avg(reviewsTable.rating),
      totalReviews: count(reviewsTable.id),
    }).from(reviewsTable).where(eq(reviewsTable.technicianId, req.technicianId!));

    res.json({
      reviews,
      averageRating: stats[0]?.avgRating ? parseFloat(stats[0].avgRating).toFixed(1) : null,
      totalReviews: stats[0]?.totalReviews || 0,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/reviews/booking/:id — check if a booking has been reviewed
router.get("/booking/:id", requireUser as any, async (req: AuthRequest, res) => {
  try {
    const bookingId = parseInt(req.params.id as string);
    const [review] = await db.select().from(reviewsTable)
      .where(and(eq(reviewsTable.bookingId, bookingId), eq(reviewsTable.userId, req.userId!)))
      .limit(1);
    res.json({ reviewed: !!review, review: review || null });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
