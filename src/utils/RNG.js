export class RNG {
  constructor(seed = Date.now()) {
    this.state = seed >>> 0;
  }

  next() {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }

  nextFloat() {
    return this.next() / 0xffffffff;
  }

  range(min = 0, max = 1) {
    return min + this.nextFloat() * (max - min);
  }

  pick(list) {
    if (!Array.isArray(list) || list.length === 0) return undefined;
    const idx = Math.floor(this.nextFloat() * list.length);
    return list[idx];
  }
}
