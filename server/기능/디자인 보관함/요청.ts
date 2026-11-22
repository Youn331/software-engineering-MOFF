import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool, auth, design, price, transaction, nameDesign, storeElements, selection } from "../../공통";
const app=express.Router();
app.get("/api/designs", auth, async (q, r) => {
  const { rows } = await pool.query(
    "SELECT d.*, COALESCE(jsonb_agg(jsonb_build_object('id',e.id,'catalogId',e.catalog_id,'x',e.x,'y',e.y,'length',e.length,'rotation',e.rotation,'layer',e.layer)) FILTER(WHERE e.id IS NOT NULL),'[]') elements FROM bouquet_designs d LEFT JOIN design_elements e ON e.design_id=d.id WHERE owner_id=$1 GROUP BY d.id ORDER BY updated_at DESC",
    [q.session.userId],
  );
  r.json(rows);
});
app.post("/api/designs", auth, async (q, r) =>
  r.json(
    await transaction(async (c) => {
      await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        q.session.userId,
      ]);
      const d = await nameDesign(c, q.session.userId!, design.parse(q.body));
      await price(c, d);
      const id = randomUUID();
      await c.query(
        "INSERT INTO bouquet_designs(id,owner_id,name,size,wrapping) VALUES($1,$2,$3,$4,$5)",
        [id, q.session.userId, d.name, d.size, d.wrapping],
      );
      await c.query("UPDATE bouquet_designs SET ribbon=$1 WHERE id=$2",[d.ribbon??null,id]);
      await storeElements(c, id, d);
      return { id, name: d.name };
    }),
  ),
);
app.put("/api/designs/:id", auth, async (q, r) =>
  r.json(
    await transaction(async (c) => {
      await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        q.session.userId,
      ]);
      const old = (
        await c.query(
          "SELECT * FROM bouquet_designs WHERE id=$1 AND owner_id=$2 FOR UPDATE",
          [z.string().uuid().parse(q.params.id), q.session.userId],
        )
      ).rows[0];
      if (!old) throw Error("디자인을 찾을 수 없습니다.");
      const d = await nameDesign(c, q.session.userId!, design.parse(q.body));
      await price(c, d);
      await c.query(
        "UPDATE bouquet_designs SET name=$1,size=$2,wrapping=$3,updated_at=now() WHERE id=$4",
        [d.name, d.size, d.wrapping, old.id],
      );
      await c.query("DELETE FROM design_elements WHERE design_id=$1", [old.id]);
      await c.query("UPDATE bouquet_designs SET ribbon=$1 WHERE id=$2",[d.ribbon??null,old.id]);
      await storeElements(c, old.id, d);
      return { id: old.id, name: d.name };
    }),
  ),
);
app.post("/api/designs/bulk-delete", auth, async (q, r) => {
  const { ids } = selection.parse(q.body);
  await pool.query(
    "DELETE FROM bouquet_designs WHERE id=ANY($1::uuid[]) AND owner_id=$2",
    [ids, q.session.userId],
  );
  r.json({ ok: true });
});
app.delete("/api/designs/:id", auth, async (q, r) => {
  await pool.query("DELETE FROM bouquet_designs WHERE id=$1 AND owner_id=$2", [
    q.params.id,
    q.session.userId,
  ]);
  r.json({ ok: true });
});

export default app;
