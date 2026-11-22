import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool, auth, design, price, transaction, nameDesign } from "../../공통";
const app=express.Router();
app.get("/api/orders", auth, async (q, r) =>
  r.json(
    (
      await pool.query(
        `SELECT o.*,jsonb_agg(i.snapshot ORDER BY i.id) items,
 jsonb_agg(jsonb_build_object('id',i.id,'snapshot',i.snapshot,'quantity',i.quantity,'unitPrice',i.unit_price) ORDER BY i.id) AS "orderItems"
 FROM orders o JOIN order_items i ON i.order_id=o.id WHERE owner_id=$1 GROUP BY o.id ORDER BY created_at DESC`,
        [q.session.userId],
      )
    ).rows,
  ),
);
const checkout = z.object({
  requestKey: z.string().uuid(),
  design: design.optional(),
  cartId: z.string().uuid().optional(),
  cartIds: z.array(z.string().uuid()).min(1).max(100).optional(),
  address: z.object({
    name: z.string().trim().min(1).max(50),
    phone: z.string().regex(/^0[0-9-]{9,13}$/),
    address: z.string().trim().min(5).max(300),
    note: z.string().max(300).default(""),
  }),
});
app.post("/api/orders", auth, async (q, r) =>
  r.json(
    await transaction(async (c) => {
      if(process.env.PAYMENT_MODE !== "demo") throw Error("결제 서비스가 준비 중입니다.");
      const b = checkout.parse(q.body);
      await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        q.session.userId,
      ]);
      const old = (
        await c.query(
          "SELECT * FROM orders WHERE owner_id=$1 AND request_key=$2",
          [q.session.userId, b.requestKey],
        )
      ).rows[0];
      if (old) return old;
      const cartIds = [...new Set(b.cartIds || (b.cartId ? [b.cartId] : []))];
      let lines: { snapshot: z.infer<typeof design>; quantity: number }[];
      if (cartIds.length) {
        lines = (
          await c.query(
            "SELECT snapshot,quantity FROM cart_items WHERE id=ANY($1::uuid[]) AND owner_id=$2 FOR UPDATE",
            [cartIds, q.session.userId],
          )
        ).rows;
        if (lines.length !== cartIds.length)
          throw Error("선택한 장바구니 항목을 찾을 수 없습니다.");
      } else if (b.design) {
        lines = [
          {
            snapshot: await nameDesign(c, q.session.userId!, b.design),
            quantity: 1,
          },
        ];
      } else throw Error("주문할 꽃다발을 선택해주세요.");
      // Lock all materials in a consistent order; aggregate stock across every line.
      const materialIds = [
        ...new Set(
          lines.flatMap((l) => [
            l.snapshot.wrapping, ...(l.snapshot.ribbon?[l.snapshot.ribbon]:[]),
            ...l.snapshot.elements.map((e) => e.catalogId),
          ]),
        ),
      ];
      await c.query(
        "SELECT id FROM catalog WHERE id=ANY($1) ORDER BY id FOR UPDATE",
        [materialIds],
      );
      const priced = [];
      const required: Record<string, number> = {};
      let amount = 0;
      for (const line of lines) {
        const snapshot = design.parse(line.snapshot),
          p = await price(c, snapshot);
        amount += p.amount * line.quantity;
        priced.push({ ...line, snapshot, unitPrice: p.amount });
        for (const [id, n] of Object.entries(p.stock))
          required[id] = (required[id] || 0) + n * line.quantity;
      }
      const shipping = amount >= 30000 ? 0 : 3000,
        id = randomUUID();
      for (const [material, n] of Object.entries(required)) {
        const result = await c.query(
          "UPDATE catalog SET stock=stock-$1 WHERE id=$2 AND stock>=$1",
          [n, material],
        );
        if (!result.rowCount)
          throw Error("선택한 꽃다발 전체를 만들 재료 재고가 부족합니다.");
      }
      await c.query(
        "INSERT INTO orders(id,owner_id,request_key,status,total,shipping,address) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          id,
          q.session.userId,
          b.requestKey,
          "DEMO_CONFIRMED",
          amount + shipping,
          shipping,
          JSON.stringify(b.address),
        ],
      );
      for (const line of priced)
        await c.query("INSERT INTO order_items VALUES($1,$2,$3,$4,$5)", [
          randomUUID(),
          id,
          JSON.stringify(line.snapshot),
          line.quantity,
          line.unitPrice,
        ]);
      await c.query("INSERT INTO payments VALUES($1,$2,$3,$4,$5)", [
        randomUUID(),
        id,
        "MOCK",
        amount + shipping,
        "SIMULATED",
      ]);
      if (cartIds.length)
        await c.query(
          "DELETE FROM cart_items WHERE id=ANY($1::uuid[]) AND owner_id=$2",
          [cartIds, q.session.userId],
        );
      return { id, total: amount + shipping };
    }),
  ),
);
app.post("/api/orders/:id/cancel", auth, async (q, r) =>
  r.json(
    await transaction(async (c) => {
      const o = (
        await c.query(
          "SELECT * FROM orders WHERE id=$1 AND owner_id=$2 FOR UPDATE",
          [q.params.id, q.session.userId],
        )
      ).rows[0];
      if (!o || !["DEMO_CONFIRMED","PAYMENT_COMPLETED"].includes(o.status))
        throw Error("결제완료 상태에서만 취소할 수 있습니다.");
      const items = (
        await c.query(
          "SELECT snapshot,quantity FROM order_items WHERE order_id=$1",
          [o.id],
        )
      ).rows;
      const restored: Record<string, number> = {};
      for (const { snapshot: s, quantity } of items)
        for (const id of [
          s.wrapping, ...(s.ribbon?[s.ribbon]:[]),
          ...s.elements.map((e: { catalogId: string }) => e.catalogId),
        ])
          restored[id] = (restored[id] || 0) + quantity;
      for (const id of Object.keys(restored).sort())
        await c.query("UPDATE catalog SET stock=stock+$1 WHERE id=$2", [
          restored[id],
          id,
        ]);
      await c.query("UPDATE orders SET status=$1 WHERE id=$2", [
        "CANCELLED",
        o.id,
      ]);
      await c.query("UPDATE payments SET status=$1 WHERE order_id=$2", [
        "CANCELLED",
        o.id,
      ]);
      return { ok: true };
    }),
  ),
);

export default app;
