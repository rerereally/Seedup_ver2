export function isAdminEmail(email?: string | null) {
  const allowlist = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (!allowlist.length || !email) return false;
  return allowlist.includes(email.toLowerCase());
}

/**
 * Admin by the ADMIN_EMAILS setting, or by role "admin" in the account's app metadata. Only Supabase (SQL editor or the
 * service key) can write app metadata, so an account cannot make itself an admin.
 */
export function isAdminUser(user?: { email?: string | null; app_metadata?: Record<string, unknown> } | null) {
  if (!user) return false;
  return isAdminEmail(user.email) || user.app_metadata?.role === 'admin';
}
