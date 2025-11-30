import { Request, Response, NextFunction } from "express";
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.header("x-admin-key");
  if (!token || token !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}
