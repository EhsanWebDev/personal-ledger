-- Electricity readings belong to a billing cycle that opens on the utility's
-- reading day. The reading day moves around (holidays, skipped days), so the
-- cycle is stamped explicitly instead of being inferred from reading_date.
alter table public.electricity_meter_readings
  add column if not exists cycle_start_date date;

-- Existing rows already share previous_reading within a cycle; the cycle opened
-- on the earliest reading_date that used that baseline.
update public.electricity_meter_readings as r
set cycle_start_date = c.started_on
from (
  select meter_name, previous_reading, min(reading_date) as started_on
  from public.electricity_meter_readings
  group by meter_name, previous_reading
) as c
where r.cycle_start_date is null
  and r.meter_name = c.meter_name
  and r.previous_reading = c.previous_reading;

alter table public.electricity_meter_readings
  alter column cycle_start_date set default current_date;

create index if not exists electricity_meter_readings_cycle_idx
  on public.electricity_meter_readings (meter_name, cycle_start_date desc, reading_date desc);
