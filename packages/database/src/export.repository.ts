import type { DatabaseExecutor } from './client.js';

export class ExportRepository {
  constructor(readonly database: DatabaseExecutor) {}
}
