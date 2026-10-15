interface Metrics {
  totalConnections: number;
  totalOperations: number;
  activeRooms: number;
  startTime: number;
}

interface MetricsResponse {
  totalConnections: number;
  totalOperations: number;
  activeRooms: number;
  startTime: number;
  uptime: number;
  operationsPerSecond: number[];
  avgOperationsPerSecond: number;
}

class MetricsCollector {
  private totalConnections = 0;
  private totalOperations = 0;
  private activeRooms = 0;
  private readonly startTime = Date.now();

  // Rolling window of ops-per-second samples (last 60s)
  private opsWindow: Array<{ second: number; count: number }> = [];
  private currentSecondOps = 0;
  private currentSecondStart = Math.floor(Date.now() / 1000);

  incrementConnections(): void {
    this.totalConnections++;
  }

  decrementConnections(): void {
    this.totalConnections = Math.max(0, this.totalConnections - 1);
  }

  incrementOperations(): void {
    this.totalOperations++;
    this.currentSecondOps++;
  }

  // Call this whenever a room is created or deleted
  setActiveRooms(count: number): void {
    this.activeRooms = Math.max(0, count);
  }

  addRoom(): void {
    this.activeRooms++;
  }

  removeRoom(): void {
    this.activeRooms = Math.max(0, this.activeRooms - 1);
  }

  getMetrics(): MetricsResponse {
    const uptime = (Date.now() - this.startTime) / 1000;
    const samples = this.opsWindow.map((s) => s.count);
    const avgOpsPerSecond = samples.length > 0
      ? samples.reduce((a, b) => a + b, 0) / samples.length
      : 0;

    return {
      totalConnections: this.totalConnections,
      totalOperations: this.totalOperations,
      activeRooms: this.activeRooms,
      startTime: this.startTime,
      uptime,
      operationsPerSecond: samples,
      avgOperationsPerSecond: Math.round(avgOpsPerSecond)
    };
  }

  reset(): void {
    this.totalConnections = 0;
    this.totalOperations = 0;
    this.activeRooms = 0;
    this.opsWindow = [];
    this.currentSecondOps = 0;
    this.currentSecondStart = Math.floor(Date.now() / 1000);
  }

  // Called once per second by the sampler below
  private flushSecond(): void {
    const nowSecond = Math.floor(Date.now() / 1000);

    // Fill any skipped seconds with zeros (so avg is accurate)
    while (this.currentSecondStart < nowSecond) {
      this.opsWindow.push({
        second: this.currentSecondStart,
        count: this.currentSecondOps
      });
      this.currentSecondOps = 0;
      this.currentSecondStart++;
    }

    // Keep only last 60 samples
    if (this.opsWindow.length > 60) {
      this.opsWindow = this.opsWindow.slice(-60);
    }
  }

  // Expose for the interval
  _tick(): void {
    this.flushSecond();
  }
}

export const metrics = new MetricsCollector();

// Sample every second — records ops/sec even during idle periods
setInterval(() => {
  metrics._tick();
}, 1000);

// Log summary every minute
setInterval(() => {
  const stats = metrics.getMetrics();
  console.log('📊 Metrics:', {
    connections: stats.totalConnections,
    operations: stats.totalOperations,
    activeRooms: stats.activeRooms,
    opsPerSecond: stats.avgOperationsPerSecond,
    uptime: Math.floor(stats.uptime)
  });
}, 60_000);