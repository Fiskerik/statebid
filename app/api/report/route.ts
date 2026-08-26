import { env } from '@/lib/server/platform';
import { z } from 'zod';
import { ensureDatabase } from '@/db/runtime';
import { enforceRateLimit, HttpError, jsonError } from '@/lib/server/security';
import { STATE_BY_CODE } from '@/lib/states';

const schema = z.object({
  listingId: z.string().uuid(),
  stateCode: z.string().length(2),
  reason: z.enum(['malware', 'impersonation', 'adult', 'regulated', 'copyright', 'other']),
  details: z.string().max(1000).optional().default(''),
  turnstileToken: z.string().max(4096).optional(),
});

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, 'report', 4, 60 * 60);
    const input = schema.parse(await request.json());
    const stateCode = input.stateCode.toUpperCase();
    if (!STATE_BY_CODE.has(stateCode as never)) throw new HttpError(400, 'Invalid state.');
    await ensureDatabase();
    const listing = await env.DB.prepare('SELECT id FROM listings WHERE id = ? LIMIT 1').bind(input.listingId).first();
    if (!listing) throw new HttpError(404, 'Listing not found.');
    await env.DB.prepare(`INSERT INTO content_reports(
      id, listing_id, state_code, reason, details, status, created_at
    ) VALUES (?, ?, ?, ?, ?, 'open', ?)`)
      .bind(crypto.randomUUID(), input.listingId, stateCode, input.reason, input.details, Date.now()).run();
    return Response.json({ submitted: true }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
