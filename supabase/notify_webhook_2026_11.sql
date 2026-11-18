-- A Discord or Slack webhook a person adds to get the weekly signals and change alerts in a chat channel.
-- Run once in the Supabase SQL editor.
alter table public.user_onboarding add column if not exists notify_webhook text;
