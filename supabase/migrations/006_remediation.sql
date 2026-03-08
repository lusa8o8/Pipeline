-- Rename stages to projects conceptually via a new table
alter table stages rename to projects;

-- Add status field to cards
alter table cards add column status text not null default 'backlog'
  check (status in ('backlog', 'ready', 'doing', 'done'));

-- Remove position from cards (no longer needed for column placement)
-- position is still used for ordering within a status column
