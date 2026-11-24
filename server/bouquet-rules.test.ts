import assert from "node:assert/strict";
import test from "node:test";
import { bouquetAmount, checkCapacity } from "./bouquet-rules";

test("같은 꽃 두 송이, 포장지와 사이즈 비용을 모두 합산한다", () => {
  assert.equal(bouquetAmount(3000, [3500, 3500, 4000]), 14000);
});

test("사이즈의 최대 송이 수까지 허용한다", () => {
  assert.doesNotThrow(() => checkCapacity(5, 5));
});

test("한 송이 초과하면 저장과 주문을 거부한다", () => {
  assert.throws(() => checkCapacity(6, 5), /꽃 수를 초과/);
});
