export interface BookingSchedulerResult {
  readonly jobType: string;
  readonly processed: number;
}

export interface BookingScheduledRunner {
  run(now: Date): Promise<BookingSchedulerResult[]>;
}

export class BookingScheduler {
  constructor(private readonly runners: readonly BookingScheduledRunner[] = []) {}

  async tick(now = new Date()): Promise<BookingSchedulerResult[]> {
    const results: BookingSchedulerResult[] = [];
    for (const runner of this.runners) results.push(...(await runner.run(now)));
    return results;
  }
}
