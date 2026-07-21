export class WorkerMetrics {
  private readonly counters = new Map<string, number>();
  increment(name: string, amount = 1) {
    this.counters.set(name, (this.counters.get(name) ?? 0) + amount);
  }
  snapshot() {
    return Object.fromEntries(this.counters);
  }
}
