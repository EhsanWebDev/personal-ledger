alter table public.purchases
  add column category text check (category is null or char_length(trim(category)) between 1 and 80);

create index purchases_category_idx on public.purchases (lower(category));
