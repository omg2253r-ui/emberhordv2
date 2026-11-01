// Cloud saves: accounts and one save per account. Logic lives in ../lib/cloud.mjs (shared with the local test server).
import { getStore } from '@netlify/blobs';
import { blobsKV } from '../lib/hub.mjs';
import { handleCloud } from '../lib/cloud.mjs';

export default async (req: Request, context: { ip?: string }) =>
  handleCloud(req, blobsKV(getStore({ name: 'emberhold-cloud', consistency: 'strong' })), Date.now(), { ip: context?.ip });

export const config = { path: '/api/cloud' };
