import { pgTable, serial, text, integer, numeric, boolean, timestamp, json } from "drizzle-orm/pg-core";

// ── Users ────────────────────────────────────────────────────────────────────
export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  passwordHash: text("password_hash").notNull(),
  address: text("address"),
  city: text("city"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Technicians ───────────────────────────────────────────────────────────────
export const techniciansTable = pgTable("technicians", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  passwordHash: text("password_hash").notNull(),
  experience: integer("experience").default(0),
  city: text("city").notNull(),
  address: text("address"),
  lat: numeric("lat", { precision: 10, scale: 7 }),
  lng: numeric("lng", { precision: 10, scale: 7 }),
  isAvailable: boolean("is_available").default(false).notNull(),
  rating: numeric("rating", { precision: 3, scale: 2 }).default("4.5"),
  totalJobs: integer("total_jobs").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Bookings ──────────────────────────────────────────────────────────────────
export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  technicianId: integer("technician_id").references(() => techniciansTable.id),
  serviceType: text("service_type").notNull(),
  status: text("status").default("pending").notNull(),
  bookingType: text("booking_type").notNull(),
  scheduledAt: timestamp("scheduled_at"),
  address: text("address").notNull(),
  city: text("city").notNull(),
  description: text("description"),
  symptoms: text("symptoms"),
  lat: numeric("lat", { precision: 10, scale: 7 }),
  lng: numeric("lng", { precision: 10, scale: 7 }),
  estimatedCost: text("estimated_cost"),
  serviceCharge: numeric("service_charge", { precision: 10, scale: 2 }).default("199"),
  finalAmount: numeric("final_amount", { precision: 10, scale: 2 }),
  notes: text("notes"),
  tdsBefore: integer("tds_before"),  // TDS reading before service (by technician)
  tdsAfter: integer("tds_after"),    // TDS reading after service (by technician)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Booking Parts (bill line items) ──────────────────────────────────────────
export const bookingPartsTable = pgTable("booking_parts", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookingsTable.id),
  partId: integer("part_id").notNull(),
  partName: text("part_name").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
});

// ── Products ──────────────────────────────────────────────────────────────────
export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  brand: text("brand"),
  rating: numeric("rating", { precision: 3, scale: 2 }).default("4.0"),
  imageUrl: text("image_url"),
  features: json("features").$type<string[]>().default([]),
  inStock: boolean("in_stock").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Parts (spare parts for repairs) ──────────────────────────────────────────
export const partsTable = pgTable("parts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  minPrice: numeric("min_price", { precision: 10, scale: 2 }).notNull(),
  maxPrice: numeric("max_price", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
});

// ── AMC Plans ─────────────────────────────────────────────────────────────────
export const amcPlansTable = pgTable("amc_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  duration: integer("duration").notNull(),
  servicesIncluded: integer("services_included").default(2).notNull(),
  features: json("features").$type<string[]>().default([]),
  isActive: boolean("is_active").default(true).notNull(),
});

// ── AMC Subscriptions ─────────────────────────────────────────────────────────
export const amcSubscriptionsTable = pgTable("amc_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  planId: integer("plan_id").notNull().references(() => amcPlansTable.id),
  startDate: timestamp("start_date").defaultNow().notNull(),
  endDate: timestamp("end_date").notNull(),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Reviews ───────────────────────────────────────────────────────────────────
export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  technicianId: integer("technician_id").notNull(),
  bookingId: integer("booking_id").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── TDS Readings ──────────────────────────────────────────────────────────────
export const tdsReadingsTable = pgTable("tds_readings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  tdsValue: integer("tds_value").notNull(),
  city: text("city"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── RO Health Assessments ─────────────────────────────────────────────────────
export const roHealthTable = pgTable("ro_health", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  score: integer("score").notNull(),
  roAge: integer("ro_age_months"),
  lastServiceMonths: integer("last_service_months"),
  currentTds: integer("current_tds"),
  waterTaste: text("water_taste"),
  flowSpeed: text("flow_speed"),
  recommendation: text("recommendation").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Knowledge Chunks (RAG vector store) ──────────────────────────────────────
// Vectors stored as TEXT (JSON array) — we use raw SQL for cosine similarity
export const knowledgeChunksTable = pgTable("knowledge_chunks", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  embedding: text("embedding").notNull(),   // JSON float array from Gemini
  source: text("source").notNull(),         // "troubleshooting"|"faq"|"parts"|"products"
  title: text("title"),
  metadata: json("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
