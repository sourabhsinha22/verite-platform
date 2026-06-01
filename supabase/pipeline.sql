-- Phase B: Pipeline fields on engagements
alter table engagements add column if not exists probability integer default null check (probability >= 0 and probability <= 100);
alter table engagements add column if not exists expected_close_date date default null;
alter table engagements add column if not exists pipeline_notes text default '';

-- Set default probabilities based on current stage
update engagements set probability = case
  when stage = 'lead'        then 10
  when stage = 'opportunity' then 30
  when stage = 'active'      then 80
  when stage = 'paused'      then 40
  when stage = 'closed'      then 0
  else 50
end
where probability is null;
