export function isAdminEmail(email?: string | null) {
  const allowlist = (process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (!allowlist.length || !email) return false;
  return allowlist.includes(email.toLowerCase());
}
