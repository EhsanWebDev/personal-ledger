create table public.purchases (
  id bigint generated always as identity primary key,
  item_name text not null check (char_length(trim(item_name)) between 1 and 160),
  purchase_price numeric(12, 0) not null check (purchase_price >= 0),
  purchase_date date not null,
  created_at timestamptz not null default now()
);

create index purchases_date_idx on public.purchases (purchase_date desc);
create index purchases_name_idx on public.purchases (lower(item_name));
