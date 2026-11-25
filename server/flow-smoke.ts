import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const base = (process.env.TEST_ORIGIN || "http://127.0.0.1:3001") + "/api/";
const ownerIds: string[] = [];
const orderIds: string[] = [];
function client() {
  let cookie = "";
  return async (
    path: string,
    method = "GET",
    body?: unknown,
    expected = 200,
  ) => {
    const response = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    cookie = response.headers.get("set-cookie")?.split(";")[0] || cookie;
    const result = await response.json();
    assert.equal(response.status, expected, JSON.stringify(result));
    return result;
  };
}
async function stock(){return (await pool.query("SELECT stock FROM catalog WHERE id='f_gerbera'")).rows[0].stock;}
const req = client(),
  other = client();
const draft = {
  name: "",
  size: "S",
  wrapping: "w_kraft",
  elements: [
    {
      id: randomUUID(),
      catalogId: "f_gerbera",
      x: 12,
      y: -8,
      length: 1.2,
      rotation: 15,
      layer: 2,
    },
  ],
};
const address = {
  name: "시연 테스트",
  phone: "010-0000-0000",
  address: "배송하지 않는 테스트 주소",
  note: "통합 테스트",
};
try {
  for (const request of [req, other]) {
    const u = await request("register", "POST", {
      email: `flow-${randomUUID()}@example.test`,
      name: "기능 검증",
      password: randomUUID(),
    });
    ownerIds.push(u.id);
  }
  const first = await req("designs", "POST", draft),
    second = await req("designs", "POST", draft);
  assert.equal(first.name, "나의 디자인1");
  assert.equal(second.name, "나의 디자인2");
  await req("cart/bulk", "POST", { ids: [first.id, second.id] });
  await req("designs/" + first.id, "PUT", {
    ...draft,
    name: "수정된 디자인",
    elements: [{ ...draft.elements[0], length: 1.5 }],
  });
  const saved = await req("designs");
  assert.equal(saved.length, 2);
  assert.equal(
    saved.find((s: any) => s.id === first.id).elements[0].length,
    1.5,
  );
  const cart = await req("cart");
  assert.equal(cart[0].snapshot.elements[0].length, 1.2);
  await other(
    "designs/" + first.id,
    "PUT",
    { ...draft, name: "타인 변경" },
    409,
  );
  await other("cart/bulk", "POST", { ids: [first.id] }, 409);
  assert.ok((await req('catalog')).every((item:any)=>!('stock' in item)));
  await req('admin/catalog','GET',undefined,403);
  const inquiry=await req('inquiries','POST',{title:'테스트',body:'비밀 문의'},201);
  assert.ok(!(await other('inquiries')).some((i:any)=>i.id===inquiry.id));
  await pool.query('DELETE FROM inquiries WHERE id=$1',[inquiry.id]);
  const times=[];
  for (const [size, count] of [["S", 2], ["M", 1], ["M", 7], ["L", 6], ["L", 13]] as const) {
    const elements = Array.from({ length: count }, () => ({ ...draft.elements[0], id: randomUUID() }));
    await req("designs", "POST", { ...draft, size, elements }, 409);
  }
  for (const [size, count, expected] of [["S", 1, 9000], ["M", 2, 15000], ["L", 7, 34000]] as const) {
    const elements = Array.from({ length: count }, () => ({ ...draft.elements[0], id: randomUUID() }));
    const quote = await req("designs/quote", "POST", { ...draft, size, elements });
    assert.equal(quote.amount, expected);
  }
  for(let n=0;n<20;n++){const start=performance.now();const quote=await req('designs/quote','POST',draft);assert.equal(quote.amount,9000);times.push(performance.now()-start);}
  console.log('Local quote API, 20 samples, maximum ms:', Math.ceil(Math.max(...times)));
  assert.ok(Math.max(...times)<1000);
  const before = await stock();
  const requestKey = randomUUID();
  const body = { requestKey, cartIds: cart.map((c: any) => c.id), address };
  const order = await req("orders", "POST", body);
  orderIds.push(order.id);
  assert.equal(order.total, 21000);
  assert.equal((await req("orders"))[0].orderItems.length, 2);
  assert.equal((await req("cart")).length, 0);
  assert.equal(
    await stock(),
    before - 2,
  );
  assert.equal((await req("orders", "POST", body)).id, order.id);
  await req("orders/" + order.id + "/cancel", "POST");
  assert.equal(
    await stock(),
    before,
  );
  // Another user's cart cannot be checked out or removed.
  await req("cart/bulk", "POST", { ids: [first.id] });
  const ownCart = await req("cart");
  await other(
    "orders",
    "POST",
    { requestKey: randomUUID(), cartIds: [ownCart[0].id], address },
    409,
  );
  assert.equal((await req("cart")).length, 1);
  // One isolated test material proves aggregate stock validation + rollback.
  const material = "f_test_" + randomUUID();
  await pool.query(
    "INSERT INTO catalog(id,name,category,price,stock,image) VALUES($1,$2,$3,100,1,$4)",
    [material, "통합검증 재료", "FLOWER", ""],
  );
  try {
    const scarce = {
      ...draft,
      name: "재고 검증",
      elements: [{ ...draft.elements[0], catalogId: material }],
    };
    await req("cart", "POST", scarce);
    await req("cart", "POST", scarce);
    const scarceCart = (await req("cart")).filter(
      (c: any) => c.snapshot.name === "재고 검증",
    );
    const count = (await req("orders")).length;
    await req(
      "orders",
      "POST",
      {
        requestKey: randomUUID(),
        cartIds: scarceCart.map((c: any) => c.id),
        address,
      },
      409,
    );
    assert.equal((await req("orders")).length, count);
    assert.equal(
      (await pool.query("SELECT stock FROM catalog WHERE id=$1", [material]))
        .rows[0].stock,
      1,
    );
    assert.equal((await req("cart")).length, 3);
  } finally {
    await pool.query("DELETE FROM catalog WHERE id=$1", [material]);
  }
  await req("designs/bulk-delete", "POST", { ids: [first.id, second.id] });
  assert.equal((await req("designs")).length, 0);
  assert.equal((await req("cart")).length, 3);
  console.log(
    "PASS: sequential names, overwrite save, immutable cart, bulk add/delete, multi-item checkout, server totals, idempotency, ownership, aggregate stock rollback, cancellation.",
  );
} finally {
  for (const id of orderIds) {
    const row = (
      await pool.query("SELECT status FROM orders WHERE id=$1", [id])
    ).rows[0];
    if (row?.status === "PAYMENT_COMPLETED")
      await req("orders/" + id + "/cancel", "POST");
  }
  for (const owner of ownerIds) {
    await pool.query("DELETE FROM session WHERE sess->>'userId'=$1", [owner]);
    await pool.query(
      "DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE owner_id=$1)",
      [owner],
    );
    await pool.query(
      "DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE owner_id=$1)",
      [owner],
    );
    await pool.query("DELETE FROM orders WHERE owner_id=$1", [owner]);
    await pool.query("DELETE FROM cart_items WHERE owner_id=$1", [owner]);
    await pool.query("DELETE FROM bouquet_designs WHERE owner_id=$1", [owner]);
    await pool.query("DELETE FROM users WHERE id=$1", [owner]);
  }
  await pool.end();
}
