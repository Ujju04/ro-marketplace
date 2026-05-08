import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.js";
import bookingsRouter from "./routes/bookings.js";
import productsRouter from "./routes/products.js";
import techniciansRouter from "./routes/technicians.js";
import chatRouter from "./routes/chat.js";
import reviewsRouter from "./routes/reviews.js";
import roHealthRouter from "./routes/roHealth.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

// Routes
app.use("/api/auth", authRouter);
app.use("/api/users", authRouter);          // /api/users/me
app.use("/api/bookings", bookingsRouter);
app.use("/api/technicians", techniciansRouter);
app.use("/api", productsRouter);            // /api/products, /api/parts, /api/amc-plans
app.use("/api/chat", chatRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/ro-health", roHealthRouter);

export default app;