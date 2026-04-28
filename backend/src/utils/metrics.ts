interface Metrics {
  totalConnections: number;
  totalOperations: number;
  activeRooms: number;
  startTime: number;
  operationsPerSecond: number[];
}

interface MetricsResponse {
  totalConnections: number;
  totalOperations: number;
  activeRooms: number;
  startTime: number;
  operationsPerSecond: number[];
  uptime: number;
  avgOperationsPerSecond: number;
}

class MetricsCollector {
  private metrics: Metrics = {
    totalConnections: 0,
    totalOperations: 0,
    activeRooms: 0,
    startTime: Date.now(),
    operationsPerSecond: []
  };
  
  private lastOperationCount = 0;
  private lastMetricsTime = Date.now();
  
  incrementConnections(): void {
    this.metrics.totalConnections++;
  }
  
  decrementConnections(): void {
    this.metrics.totalConnections--;
  }
  
  incrementOperations(): void {
    this.metrics.totalOperations++;
    this.updateOperationsPerSecond();
  }
  
  setActiveRooms(count: number): void {
    this.metrics.activeRooms = count;
  }
  
  private updateOperationsPerSecond(): void {
    const now = Date.now();
    if (now - this.lastMetricsTime >= 1000) {
      const opsInLastSecond = this.metrics.totalOperations - this.lastOperationCount;
      this.metrics.operationsPerSecond.push(opsInLastSecond);
      
      if (this.metrics.operationsPerSecond.length > 60) {
        this.metrics.operationsPerSecond.shift();
      }
      
      this.lastOperationCount = this.metrics.totalOperations;
      this.lastMetricsTime = now;
    }
  }
  
  getMetrics(): MetricsResponse {
    const uptime = (Date.now() - this.metrics.startTime) / 1000;
    const avgOpsPerSecond = this.metrics.operationsPerSecond.length > 0
      ? this.metrics.operationsPerSecond.reduce((a, b) => a + b, 0) / this.metrics.operationsPerSecond.length
      : 0;
    
    return {
      totalConnections: this.metrics.totalConnections,
      totalOperations: this.metrics.totalOperations,
      activeRooms: this.metrics.activeRooms,
      startTime: this.metrics.startTime,
      operationsPerSecond: this.metrics.operationsPerSecond,
      uptime: uptime,
      avgOperationsPerSecond: Math.round(avgOpsPerSecond)
    };
  }
  
  reset(): void {
    this.metrics = {
      totalConnections: 0,
      totalOperations: 0,
      activeRooms: 0,
      startTime: Date.now(),
      operationsPerSecond: []
    };
    this.lastOperationCount = 0;
    this.lastMetricsTime = Date.now();
  }
}

export const metrics = new MetricsCollector();

// Log metrics every minute
setInterval(() => {
  const stats = metrics.getMetrics();
  console.log('📊 Metrics:', {
    connections: stats.totalConnections,
    operations: stats.totalOperations,
    activeRooms: stats.activeRooms,
    opsPerSecond: stats.avgOperationsPerSecond,
    uptime: Math.floor(stats.uptime)
  });
}, 60000);