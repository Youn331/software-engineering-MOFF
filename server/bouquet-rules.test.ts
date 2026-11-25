import assert from "node:assert/strict";
import test from "node:test";
import { bouquetAmount, checkCapacity } from "./bouquet-rules";

test("같은 꽃 두 송이, 포장지와 사이즈 비용을 모두 합산한다", () => {
  assert.equal(bouquetAmount(3000, [3500, 3500, 4000]), 14000);
});

for (const [size, min, max] of [["S", 1, 1], ["M", 2, 6], ["L", 7, 12]] as const) {
  test(`${size}는 ${min}~${max}송이를 허용한다`, () => {
    assert.doesNotThrow(() => checkCapacity(min, max, min));
    assert.doesNotThrow(() => checkCapacity(max, max, min));
    assert.throws(() => checkCapacity(min - 1, max, min), /최소/);
    assert.throws(() => checkCapacity(max + 1, max, min), /초과/);
  });
}
