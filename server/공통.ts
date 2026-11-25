import "dotenv/config";
import { bouquetAmount, checkCapacity } from "./bouquet-rules";
import express from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import pg from "pg";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import path from "node:path";
declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}
const pool = new pg.Pool({connectionString:process.env.DATABASE_URL});
const auth: express.RequestHandler = (req, res, next) => {
  if (!req.session.userId)
    return res.status(401).json({ error: "로그인이 필요합니다." });
  next();
};
const element = z.object({
  id: z.string().uuid(),
  catalogId: z.string(),
  x: z.number().min(-200).max(200),
  y: z.number().min(-150).max(150),
  length: z.number().min(0.5).max(1.7),
  rotation: z.number().min(-90).max(90),
  layer: z.number().int().min(-30).max(30),
});
const design = z.object({
  name: z.string().trim().max(60),
  size: z.string().min(1).max(30),
  ribbon: z.string().nullish(),
  wrapping: z.string(),
  elements: z.array(element).min(1).max(18),
});
export async function validateSize(c: pg.PoolClient, d: z.infer<typeof design>) {
  const size=(await c.query("SELECT min_flowers,capacity,fee FROM size_options WHERE id=$1 FOR SHARE",[d.size])).rows[0];
  if (!size)
    throw Error("사이즈별 꽃 수를 초과했습니다.");
  checkCapacity(d.elements.length, size.capacity, size.min_flowers);
  return size;
}
async function price(c: pg.PoolClient, d: z.infer<typeof design>) {
  const size = await validateSize(c, d);
  const ids = [d.wrapping, ...(d.ribbon?[d.ribbon]:[]), ...d.elements.map((e) => e.catalogId)];
  const { rows } = await c.query(
    "SELECT * FROM catalog WHERE id=ANY($1) ORDER BY id FOR UPDATE",
    [ids],
  );
  const by = new Map(rows.map((r) => [r.id, r]));
  if (
    (d.ribbon && by.get(d.ribbon)?.category !== "RIBBON") || by.get(d.wrapping)?.category !== "WRAPPING" ||
    d.elements.some((e) => by.get(e.catalogId)?.category !== "FLOWER")
  )
    throw Error("올바르지 않은 재료입니다.");
  const stock: Record<string, number> = {};
  for (const id of ids) stock[id] = (stock[id] || 0) + 1;
  for (const [id, n] of Object.entries(stock))
    if (by.get(id).stock < n) throw Error("재료 재고가 부족합니다.");
  return {
    amount: bouquetAmount(size.fee, ids.map((id) => by.get(id).price)),
    stock,
  };
}
// Lock the owner while allocating names or changing saved designs.
async function nameDesign(
  c: pg.PoolClient,
  owner: string,
  d: z.infer<typeof design>,
) {
  if (d.name) return d;
  const { rows } = await c.query(
    "SELECT name FROM bouquet_designs WHERE owner_id=$1",
    [owner],
  );
  const next =
    1 +
    Math.max(
      0,
      ...rows.map((r) => Number(/^나의 디자인(\d+)$/.exec(r.name)?.[1] || 0)),
    );
  return { ...d, name: `나의 디자인${next}` };
}
async function storeElements(
  c: pg.PoolClient,
  id: string,
  d: z.infer<typeof design>,
) {
  for (const e of d.elements)
    await c.query(
      "INSERT INTO design_elements VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [randomUUID(), id, e.catalogId, e.x, e.y, e.length, e.rotation, e.layer],
    );
}
async function transaction<T>(fn: (c: pg.PoolClient) => Promise<T>) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
const selection = z.object({
  ids: z
    .array(z.string().uuid())
    .min(1)
    .max(100)
    .transform((ids) => [...new Set(ids)]),
});

export { pool, auth, design, price, transaction, nameDesign, storeElements, selection };
