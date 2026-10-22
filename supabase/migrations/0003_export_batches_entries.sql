-- 0003: export batches and entries.

create table public.export_batches (
  id           uuid primary key default gen_random_uuid(),
  created_by   uuid not null references public.profiles (id),
  created_at   timestamptz not null default now(),
  date_from    date not null,
  date_to      date not null,
  entry_count  int  not null check (entry_count > 0),
  total_amount numeric(14,2) not null,
  ledgers_path text not null,
  xml_path     text not null,
  xlsx_path    text not null,
  unlocked_at  timestamptz,
  unlocked_by  uuid references public.profiles (id),
  check (date_to >= date_from)
);

create table public.entries (
  id           uuid primary key default gen_random_uuid(),
  entry_date   date not null,
  kind         public.entry_kind not null,
  category_id  int  not null references public.categories (id),
  source_id    int  not null references public.payment_sources (id),
  amount       numeric(12,2) not null check (amount > 0),
  party        text check (party is null or length(party) <= 120),
  programme    text check (programme is null or length(programme) <= 120),
  narration    text not null check (length(trim(narration)) between 3 and 500),

  receipt_path text,
  receipt_size int  check (receipt_size is null or (receipt_size > 0 and receipt_size <= 204800)),
  receipt_mime text check (receipt_mime is null or receipt_mime in ('image/jpeg', 'image/webp', 'application/pdf')),

  status       public.entry_status not null default 'pending',
  review_note  text,
  reviewed_by  uuid references public.profiles (id),
  reviewed_at  timestamptz,

  batch_id     uuid references public.export_batches (id),
  voucher_no   int check (voucher_no is null or voucher_no > 0),
  voucher_fy   int generated always as (public.fy_of(entry_date)) stored,

  created_by   uuid not null references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,

  constraint entries_receipt_consistent check (
    (receipt_path is null) = (receipt_size is null) and (receipt_path is null) = (receipt_mime is null)
  ),
  constraint entries_rejected_has_note check (
    status <> 'rejected' or length(trim(coalesce(review_note, ''))) >= 5
  ),
  constraint entries_exported_has_batch check (
    status <> 'exported' or (batch_id is not null and voucher_no is not null)
  )
);

create unique index entries_voucher_no_key on public.entries (voucher_fy, voucher_no) where voucher_no is not null;
create index entries_date_idx          on public.entries (entry_date) where deleted_at is null;
create index entries_category_date_idx on public.entries (category_id, entry_date) where deleted_at is null;
create index entries_creator_idx       on public.entries (created_by, created_at desc);
create index entries_queue_idx         on public.entries (status, created_at) where deleted_at is null;
create index entries_batch_idx         on public.entries (batch_id) where batch_id is not null;
