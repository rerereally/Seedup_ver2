import { reactToContent } from '@/app/actions/engagement';
import type { ContentTarget } from '@/lib/content-targets';
import { Eye, ThumbsDown, ThumbsUp } from 'lucide-react';

export default function ContentEngagement({
  itemType,
  itemId,
  returnTo,
  views,
  likes,
  dislikes,
}: {
  itemType: ContentTarget;
  itemId: string;
  returnTo: string;
  views: number | null | undefined;
  likes: number | null | undefined;
  dislikes: number | null | undefined;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
      <span className="inline-flex h-10 items-center gap-1 rounded-lg border border-outline-soft bg-white px-3 font-semibold">
        <Eye className="h-4 w-4" />
        {Number(views ?? 0)}
      </span>
      <form action={reactToContent}>
        <input type="hidden" name="item_type" value={itemType} />
        <input type="hidden" name="item_id" value={itemId} />
        <input type="hidden" name="reaction" value="like" />
        <input type="hidden" name="return_to" value={returnTo} />
        <button type="submit" className="inline-flex h-10 items-center gap-1 rounded-lg border border-outline-soft bg-white px-3 font-semibold hover:border-brand-primary hover:text-brand-primary">
          <ThumbsUp className="h-4 w-4" />
          {Number(likes ?? 0)}
        </button>
      </form>
      <form action={reactToContent}>
        <input type="hidden" name="item_type" value={itemType} />
        <input type="hidden" name="item_id" value={itemId} />
        <input type="hidden" name="reaction" value="dislike" />
        <input type="hidden" name="return_to" value={returnTo} />
        <button type="submit" className="inline-flex h-10 items-center gap-1 rounded-lg border border-outline-soft bg-white px-3 font-semibold hover:border-brand-primary hover:text-brand-primary">
          <ThumbsDown className="h-4 w-4" />
          {Number(dislikes ?? 0)}
        </button>
      </form>
    </div>
  );
}
