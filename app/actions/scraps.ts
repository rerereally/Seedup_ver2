'use server';

import { deleteScrapRow } from '@/lib/db/scraps';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const ALLOWED_TYPES = new Set(['news', 'paper', 'project', 'idea', 'trend', 'ai_product', 'github']);

export async function deleteScrap(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect('/login');

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect('/login');

  const id = String(formData.get('id') ?? '');
  if (id) {
    await deleteScrapRow(supabase, user.id, id);
  }

  revalidatePath('/scrap');
  redirect('/scrap');
}
