import express from "express";
import { randomUUID } from "node:crypto";
import { pool, auth, design, transaction, selection, validateSize } from "../../공통";
const app=express.Router();
app.get("/api/cart", auth, async (q, r) =>
  r.json(
    (
      await pool.query("SELECT * FROM cart_items WHERE owner_id=$1", [
        q.session.userId,
      ])
    ).rows,
  ),
);
app.post("/api/cart/bulk", auth, async (q, r) =>
  r.json(
    await transaction(async (c) => {
      const { ids } = selection.parse(q.body);
      await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        q.session.userId,
      ]);
      const rows = (
        await c.query(
          "SELECT * FROM bouquet_designs WHERE id=ANY($1::uuid[]) AND owner_id=$2",
          [ids, q.session.userId],
        )
      ).rows;
      if (rows.length !== ids.length)
        throw Error("선택한 디자인을 찾을 수 없습니다.");
      for (const row of rows) {
        const elements = (
          await c.query(
            'SELECT id,catalog_id AS "catalogId",x,y,length,rotation,layer FROM design_elements WHERE design_id=$1',
            [row.id],
          )
        ).rows;
        const d = design.parse({ ...row, elements });
        await validateSize(c, d);
        await c.query("INSERT INTO cart_items VALUES($1,$2,$3,1)", [
          randomUUID(),
          q.session.userId,
          JSON.stringify(d),
        ]);
      }
      return { count: rows.length };
    }),
  ),
);
app.post("/api/cart", auth, async (q, r) => {
  const d = design.parse(q.body);
  await transaction(async c => {
    await validateSize(c, d);
    await c.query("INSERT INTO cart_items VALUES($1,$2,$3,1)", [
      randomUUID(),
      q.session.userId,
      JSON.stringify({ ...d, name: d.name || "나의 꽃다발" }),
    ]);
  });
  r.json({ ok: true });
});
app.delete("/api/cart/:id", auth, async (q, r) => {
  await pool.query("DELETE FROM cart_items WHERE id=$1 AND owner_id=$2", [
    q.params.id,
    q.session.userId,
  ]);
  r.json({ ok: true });
});

export default app;
