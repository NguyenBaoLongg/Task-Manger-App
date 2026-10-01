import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Router, raw } from 'express';
import type { Request, Response } from 'express';
import type { MemoryObjectStorage } from './s3-object-storage.js';

export type DevStoragePendingMedia = {
  objectKey: string;
  contentType: string;
  byteSize: bigint;
  checksumSha256: string;
  status: string;
  uploadExpiresAt: Date;
};

export type DevStorageRoutesDependencies = {
  storage: MemoryObjectStorage;
  findPendingMediaByObjectKey: (objectKey: string) => Promise<DevStoragePendingMedia | null>;
};

const bytesRoot = path.join(tmpdir(), 'adsup-dev-storage');
const bytesPath = (objectKey: string) =>
  path.join(bytesRoot, Buffer.from(objectKey).toString('base64url'));

/**
 * Presigned-PUT stand-in for the in-process memory storage used outside production. The upload URL
 * returned by createUploadIntent points here; the route enforces the same constraints S3 would
 * (content type, declared size, checksum) so complete() sees a faithful head() result. Bytes are
 * kept on disk under the OS temp dir and served back on GET, mirroring a signed download URL.
 */
export const devStorageRoutes = (deps: DevStorageRoutesDependencies) => {
  const router = Router();
  router.get('/dev-storage/:key', async (request: Request, response: Response) => {
    const objectKey = decodeURIComponent(String(request.params.key));
    const metadata = await deps.storage.head(objectKey);
    if (!metadata) {
      response.status(404).json({ code: 'RESOURCE_NOT_FOUND' });
      return;
    }
    try {
      const bytes = await readFile(bytesPath(objectKey));
      response.status(200).type(metadata.contentType).send(bytes);
    } catch {
      response.status(404).json({ code: 'RESOURCE_NOT_FOUND' });
    }
  });
  router.put(
    '/dev-storage/:key',
    // Global parsers skip binary content types; this claims the body for every PUT that reaches it.
    raw({ type: () => true, limit: '524288000' }),
    async (request: Request, response: Response) => {
      const objectKey = decodeURIComponent(String(request.params.key));
      const media = await deps.findPendingMediaByObjectKey(objectKey);
      if (!media || media.status !== 'PENDING_UPLOAD' || media.uploadExpiresAt <= new Date()) {
        response.status(404).json({ code: 'RESOURCE_NOT_FOUND' });
        return;
      }
      const body = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
      const contentType = (request.header('content-type') ?? '').split(';')[0] ?? '';
      const checksum = (request.header('x-checksum-sha256') ?? '').toLowerCase();
      if (
        body.byteLength === 0 ||
        contentType !== media.contentType ||
        checksum !== media.checksumSha256.toLowerCase() ||
        body.byteLength !== Number(media.byteSize)
      ) {
        response.status(422).json({ code: 'VALIDATION_FAILED' });
        return;
      }
      deps.storage.put(objectKey, {
        contentType: media.contentType,
        byteSize: body.byteLength,
        checksumSha256: media.checksumSha256,
      });
      await mkdir(bytesRoot, { recursive: true });
      await writeFile(bytesPath(objectKey), body);
      response.status(200).json({ ok: true });
    },
  );
  return router;
};
