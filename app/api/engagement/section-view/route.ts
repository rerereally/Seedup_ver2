import { recordSectionView } from '@/lib/db/section-views';
import { getCurrentUser } from '@/lib/supabase/server';
import { handleSectionView } from './handler';

export function POST(request: Request) {
  return handleSectionView(request, {
    getUserId: async () => (await getCurrentUser())?.id ?? null,
    record: recordSectionView,
  });
}
