-- Clear RSS metadata-only rows that were accidentally stored as article content.
-- This keeps summaries and newsletter metadata, but removes short duplicated bodies
-- from news detail pages. Run after applying the metadata pipeline changes.

update public.news_items
set
  content = null,
  quality_notes = array_append(coalesce(quality_notes, '{}'), 'content_cleared:metadata_only_cleanup')
where content is not null
  and (
    quality_notes && array['content_mode:metadata_only']
    or (
      length(content) < 1200
      and (
        short_summary is not null
        or newsletter_section is not null
      )
    )
  );
