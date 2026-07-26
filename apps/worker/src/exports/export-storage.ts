import { copyFile, mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { ExportObjectStorage } from './export-runner.js';

export class LocalExportStorage implements ExportObjectStorage {
  constructor(private readonly root = process.env.LOCAL_EXPORT_DIR ?? '.data/exports') {}

  async putObject(input: {
    objectKey: string;
    content: Buffer;
    contentType: string;
    checksumSha256: string;
  }) {
    const target = resolve(this.root, input.objectKey);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, input.content, { flag: 'wx' }).catch(async (error: unknown) => {
      if ((error as { code?: string }).code !== 'EEXIST') throw error;
    });
  }

  async putFile(input: {
    objectKey: string;
    filePath: string;
    contentType: string;
    checksumSha256: string;
  }) {
    const target = resolve(this.root, input.objectKey);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(input.filePath, target).catch(async (error: unknown) => {
      if ((error as { code?: string }).code !== 'EEXIST') throw error;
    });
  }

  async delete(objectKey: string) {
    const target = resolve(this.root, objectKey);
    if (target !== this.root && !target.startsWith(`${this.root}${sep}`)) {
      throw new Error('EXPORT_OBJECT_SCOPE_VIOLATION');
    }
    await unlink(target).catch((error: unknown) => {
      if ((error as { code?: string }).code !== 'ENOENT') throw error;
    });
  }
}
