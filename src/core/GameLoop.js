export class GameLoop {
  constructor(ticker) {
    this.ticker = ticker;
    this.callbacks = new Set();
  }

  add(fn) {
    if (typeof fn !== 'function') return;
    this.callbacks.add(fn);
    this.ticker.add(fn);
  }

  remove(fn) {
    if (!fn) return;
    this.callbacks.delete(fn);
    this.ticker.remove(fn);
  }

  start() {
    this.ticker.start();
  }

  stop() {
    this.ticker.stop();
  }

  destroy() {
    this.callbacks.forEach((fn) => this.ticker.remove(fn));
    this.callbacks.clear();
    this.stop();
  }
}
