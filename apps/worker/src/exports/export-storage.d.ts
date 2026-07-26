import type { ExportObjectStorage } from './export-runner.js';
export declare class LocalExportStorage implements ExportObjectStorage {
  private readonly root;
  constructor(root?: string);
  putObject(input: {
    objectKey: string;
    content: Buffer;
    contentType: string;
    checksumSha256: string;
  }): Promise<void>;
  putFile(input: {
    objectKey: string;
    filePath: string;
    contentType: string;
    checksumSha256: string;
  }): Promise<void>;
  delete(objectKey: string): Promise<void>;
}
//# sourceMappingURL=export-storage.d.ts.map
