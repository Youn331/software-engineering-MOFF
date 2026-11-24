export function checkCapacity(flowerCount: number, capacity: number) {
  if (flowerCount > capacity) throw Error("사이즈별 꽃 수를 초과했습니다.");
}

export function bouquetAmount(sizeFee: number, materialPrices: number[]) {
  return materialPrices.reduce((total, price) => total + price, sizeFee);
}
