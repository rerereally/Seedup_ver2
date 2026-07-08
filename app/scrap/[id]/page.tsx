import { getScrap } from '@/lib/data';
import { getContentHref } from '@/lib/content-targets';
import { notFound } from 'next/navigation';
import { redirect } from 'next/navigation';

export default async function ScrapDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getScrap(id);

  if (!item) notFound();
  redirect(getContentHref(item.item_type, item.item_id));
}
