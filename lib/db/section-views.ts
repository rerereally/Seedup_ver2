import type { Section } from '@/lib/sections';
import { createAdminClient } from '@/lib/supabase/admin';

export async function recordSectionView(section: Section, userId: string | null) {
  const service = createAdminClient();
  if (!service) return;
  const { error } = await service.from('section_views').insert({ section, signed_in: userId !== null, user_id: userId });
  if (error) throw error;
}
