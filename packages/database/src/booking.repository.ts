import type { DatabaseExecutor } from './client.js';

export class BookingRepository {
  constructor(readonly database: DatabaseExecutor) {}
}
