// Who is online + WebRTC setup mail. Logic lives in ../lib/hub.mjs (shared with the local test server).
import { getStore } from '@netlify/blobs';
import { handleHub, blobsKV } from '../lib/hub.mjs';

export default async (req: Request, context: { ip?: string }) =>
  handleHub(req, blobsKV(getStore({ name: 'emberhold-hub', consistency: 'strong' })), Date.now(), { ip: context?.ip, cacheMs: 1200 });

export const config = { path: '/api/hub' };
