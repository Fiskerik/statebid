import { env } from 'cloudflare:workers';
import { getChatGPTUser, requireChatGPTUser, type ChatGPTUser } from '@/app/chatgpt-auth';

function allowed(value: string | undefined) {
  return new Set((value ?? '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean));
}

export function isAdmin(user: ChatGPTUser) {
  const ids = allowed(env.ADMIN_USER_IDS);
  const emails = allowed(env.ADMIN_EMAIL);
  if (ids.size || emails.size) {
    return ids.has(user.userId.toLowerCase()) || emails.has(user.email.toLowerCase());
  }
  return !env.SITE_URL && user.userId === 'local_seedy';
}

export async function requireAdminPage(returnTo = '/admin') {
  const user = await requireChatGPTUser(returnTo);
  if (!isAdmin(user)) throw new Error('StateBid admin access is not configured for this identity.');
  return user;
}

export async function requireAdminApi() {
  const user = await getChatGPTUser();
  if (!user) return { response: Response.json({ error: 'Authentication required.' }, { status: 401 }) } as const;
  if (!isAdmin(user)) return { response: Response.json({ error: 'Forbidden.' }, { status: 403 }) } as const;
  return { user } as const;
}
