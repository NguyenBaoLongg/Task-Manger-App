import type { DatabaseExecutor } from './client.js';

export class BookingWorkerRepository {
  constructor(readonly database: DatabaseExecutor) {}
}
