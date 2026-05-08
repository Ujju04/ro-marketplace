import { Request, Response, NextFunction } from "express";
import { verifyJwt } from "../lib/auth.js";

export interface AuthRequest extends Request {
  userId?: number;
  technicianId?: number;
  role?: "user" | "technician";
}

export function requireUser(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.slice(7);
  if (!token) { res.status(401).json({ error: "Missing token" }); return; }
  const payload = verifyJwt(token);
  if (!payload || payload.role !== "user") { res.status(401).json({ error: "Unauthorized" }); return; }
  req.userId = payload.id as number;
  req.role = "user";
  next();
}

export function requireTechnician(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.slice(7);
  if (!token) { res.status(401).json({ error: "Missing token" }); return; }
  const payload = verifyJwt(token);
  if (!payload || payload.role !== "technician") { res.status(401).json({ error: "Unauthorized" }); return; }
  req.technicianId = payload.id as number;
  req.role = "technician";
  next();
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.slice(7);
  if (!token) { res.status(401).json({ error: "Missing token" }); return; }
  const payload = verifyJwt(token);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (payload.role === "user") req.userId = payload.id as number;
  if (payload.role === "technician") req.technicianId = payload.id as number;
  req.role = payload.role as "user" | "technician";
  next();
}
