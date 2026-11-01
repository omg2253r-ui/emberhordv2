// Guild documents and guild actions. Logic lives in ../lib/docs.mjs and ../lib/guildRules.mjs.
import { getStore } from '@netlify/blobs';
import { handleDocs, blobsDocs } from '../lib/docs.mjs';
import { blobsKV } from '../lib/hub.mjs';

export default async (req: Request, context: { ip?: string }) =>
  handleDocs(
    req,
    blobsDocs(getStore({ name: 'emberhold-docs', consistency: 'strong' })),
    blobsKV(getStore({ name: 'emberhold-hub', consistency: 'strong' })),
    { ip: context?.ip },
  );

export const config = { path: '/api/docs' };
