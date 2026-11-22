import express from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool } from "../../공통";
const app=express.Router();
app.get("/api/health", async (_q, r) => {
  await pool.query("SELECT 1");
  r.json({ ok: true });
});
app.get("/api/catalog", async (_q, r) =>
  r.json((await pool.query("SELECT id,name,category,price,image,tags,(stock>0) AS available FROM catalog ORDER BY id")).rows),
);
app.get("/api/me", async (q, r) =>
  r.json(
    q.session.userId
      ? (
          await pool.query("SELECT id,name,email,phone,role FROM users WHERE id=$1", [
            q.session.userId,
          ])
        ).rows[0]
      : null,
  ),
);
app.post("/api/register", async (q, r) => {
  const b = z
    .object({
      email: z.string().email().max(200),
      name: z.string().trim().min(1).max(40),
      password: z.string().min(10).max(100),
    })
    .parse(q.body);
  const id = randomUUID();
  await pool.query(
    "INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)",
    [id, b.email.toLowerCase(), b.name, await bcrypt.hash(b.password, 12)],
  );
  await new Promise<void>((resolve, reject) =>
    q.session.regenerate((e) => (e ? reject(e) : resolve())),
  );
  q.session.userId = id;
  r.json({ id, name: b.name, email: b.email });
});
app.post("/api/login", async (q, r) => {
  const b = z
    .object({ email: z.string().email(), password: z.string().max(100) })
    .parse(q.body);
  const u = (
    await pool.query("SELECT * FROM users WHERE email=$1", [
      b.email.toLowerCase(),
    ])
  ).rows[0];
  if (!u?.password_hash || !(await bcrypt.compare(b.password, u.password_hash)))
    return r
      .status(401)
      .json({ error: "이메일 또는 비밀번호를 확인해주세요." });
  await new Promise<void>((resolve, reject) =>
    q.session.regenerate((e) => (e ? reject(e) : resolve())),
  );
  q.session.userId = u.id;
  r.json({ id: u.id, name: u.name, email: u.email });
});
app.post("/api/logout", (q, r) =>
  q.session.destroy(() => r.json({ ok: true })),
);

export default app;
