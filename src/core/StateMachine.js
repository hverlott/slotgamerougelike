export class StateMachine {
    constructor(ctx) {
      this.ctx = ctx;
      this.states = new Map();
      this.current = null;
      this.currentKey = null;
      this.lastChangeTime = Date.now();
      this.lastAwaitLabel = null;
    }
  
    register(key, state) {
      this.states.set(key, state);
    }
  
    async change(key, payload) {
      // 🔍 调试跟踪
      if (window.__TRACE__) {
        console.log(`🔄 [StateMachine] ${this.currentKey ?? 'null'} -> ${key} (${Date.now()})`);
      }
      
      if (this.current?.exit) this.current.exit(this.ctx);
      const next = this.states.get(key);
      if (!next) throw new Error(`State not found: ${key}`);
      
      this.current = next;
      this.currentKey = key;
      this.lastChangeTime = Date.now();
      
      await next.enter(this.ctx, payload);
    }
  
    update(dt) {
      if (this.current?.update) this.current.update(dt, this.ctx);
    }
  }
  