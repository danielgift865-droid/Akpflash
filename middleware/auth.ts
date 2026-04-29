import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export default function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  
  if (!authHeader) {
    return res.status(403).json({ error: "No authorization header provided" });
  }

  // Handle both "Bearer <token>" and raw token formats
  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return res.status(500).json({ error: "Server authentication misconfigured (JWT_SECRET missing)" });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    // Attach decoded user info to request if needed
    (req as any).user = decoded;
    next();
  } catch (err) {
    console.error('JWT Verification Error:', err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
