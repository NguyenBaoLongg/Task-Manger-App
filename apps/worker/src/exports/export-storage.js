import { copyFile, mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
export class LocalExportStorage {
  root;
  constructor(root = process.env.LOCAL_EXPORT_DIR ?? '.data/exports') {
    this.root = root;
  }
  async putObject(input) {
    const target = resolve(this.root, input.objectKey);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, input.content, { flag: 'wx' }).catch(async (error) => {
      if (error.code !== 'EEXIST') throw error;
    });
  }
  async putFile(input) {
    const target = resolve(this.root, input.objectKey);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(input.filePath, target).catch(async (error) => {
      if (error.code !== 'EEXIST') throw error;
    });
  }
  async delete(objectKey) {
    const target = resolve(this.root, objectKey);
    if (target !== this.root && !target.startsWith(`${this.root}${sep}`)) {
      throw new Error('EXPORT_OBJECT_SCOPE_VIOLATION');
    }
    await unlink(target).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}
//# sourceMappingURL=export-storage.js.map
