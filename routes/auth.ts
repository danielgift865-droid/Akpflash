import * as expressModule from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const express = (expressModule as any).default || expressModule;
const router = express.Router();

// hardcoded admin (you can move to DB later)
const admin = {
  username: "admin",
  password: bcrypt.hashSync("123456", 8)
};

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    return res.status(500).json({ msg: "JWT_SECRET not configured on server" });
  }

  const valid = username === admin.username &&
    bcrypt.compareSync(password, admin.password);

  if (!valid) return res.status(401).json({ msg: "Invalid login" });

  const token = jwt.sign({ user: username }, jwtSecret);
  res.json({ token });
});

export default router;
