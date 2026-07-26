import { stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

export class LocalExportDownloadStorage {
  private readonly root: string;

  constructor(root = process.env.LOCAL_EXPORT_DIR ?? '.data/exports') {
    this.root = resolve(root);
  }

  async createDownloadUrl(objectKey: string, expiresInSeconds: number) {
    const target = this.resolveObject(objectKey);
    const metadata = await stat(target).catch(() => null);
    if (!metadata?.isFile()) throw new Error('EXPORT_ARTIFACT_NOT_FOUND');
    return {
      url: `local://download/${encodeURIComponent(objectKey)}`,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1_000),
    };
  }

  private resolveObject(objectKey: string) {
    const target = resolve(this.root, objectKey);
    if (target !== this.root && !target.startsWith(`${this.root}${sep}`)) {
      throw new Error('EXPORT_OBJECT_SCOPE_VIOLATION');
    }
    return target;
  }
}
