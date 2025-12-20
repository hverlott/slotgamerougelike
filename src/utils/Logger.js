
export class Logger {
  constructor(maxLogs = 1000) {
    this.logs = [];
    this.maxLogs = maxLogs;
    this.startTime = Date.now();
    this.listeners = [];
  }

  static getInstance() {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  _add(level, message, data = null) {
    const entry = {
      timestamp: Date.now(),
      level,
      message,
      data,
      timeSinceStart: Date.now() - this.startTime
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Notify listeners (for auto-repair or UI console)
    this.listeners.forEach(cb => cb(entry));

    // Also output to browser console
    const style = this._getStyle(level);
    if (data) {
      console[level] && console[level](`%c[${level.toUpperCase()}] ${message}`, style, data);
    } else {
      console[level] && console[level](`%c[${level.toUpperCase()}] ${message}`, style);
    }
  }

  _getStyle(level) {
    switch (level) {
      case 'info': return 'color: #00b3ff; font-weight: bold;';
      case 'warn': return 'color: #ffaa00; font-weight: bold;';
      case 'error': return 'color: #ff0033; font-weight: bold;';
      case 'perf': return 'color: #cc00ff; font-weight: bold;';
      default: return 'color: #aaaaaa;';
    }
  }

  info(message, data) { this._add('info', message, data); }
  warn(message, data) { this._add('warn', message, data); }
  error(message, error) { 
    this._add('error', message, { 
      stack: error?.stack, 
      message: error?.message 
    }); 
  }
  perf(metric, value) { this._add('perf', metric, { value }); }

  onLog(callback) {
    this.listeners.push(callback);
  }

  exportLogs() {
    const json = JSON.stringify(this.logs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  analyze() {
    const stats = {
      total: this.logs.length,
      errors: 0,
      warnings: 0,
      perfMetrics: {}
    };

    this.logs.forEach(log => {
      if (log.level === 'error') stats.errors++;
      if (log.level === 'warn') stats.warnings++;
      if (log.level === 'perf') {
        if (!stats.perfMetrics[log.message]) {
          stats.perfMetrics[log.message] = { count: 0, avg: 0, total: 0 };
        }
        const m = stats.perfMetrics[log.message];
        m.count++;
        m.total += log.data.value;
        m.avg = m.total / m.count;
      }
    });

    console.table(stats);
    return stats;
  }
}

export const logger = Logger.getInstance();
