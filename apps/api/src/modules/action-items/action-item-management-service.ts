import type { ActionItemRepository } from '@adsup/database';

export class ActionItemManagementService {
  constructor(private readonly repository: ActionItemRepository) {}

  list(input: Parameters<ActionItemRepository['listManaged']>[0]) {
    return this.repository.listManaged(input);
  }
}
