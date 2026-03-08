-- No new tables needed.
-- Today's Focus is driven by cards with status = 'doing' across all pipelines.
-- We just need a way to surface them in one place.

-- Add a focused_at timestamp to cards so we can sort by when user started working
alter table cards add column focused_at timestamptz;
