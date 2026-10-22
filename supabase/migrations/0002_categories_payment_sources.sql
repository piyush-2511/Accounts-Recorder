-- 0002: categories and payment sources. Each carries the (hidden) Tally ledger it posts to.

create table public.categories (
  id           serial primary key,
  label        text not null check (length(trim(label)) between 2 and 60),
  kind         public.entry_kind not null,
  tally_ledger text not null check (length(trim(tally_ledger)) between 1 and 100 and tally_ledger !~ '[[:cntrl:]]'),
  tally_group  text not null check (length(trim(tally_group)) between 1 and 100 and tally_group !~ '[[:cntrl:]]'),
  sort_order   int  not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (label, kind)
);

create table public.payment_sources (
  id           serial primary key,
  label        text not null unique check (length(trim(label)) between 2 and 60),
  tally_ledger text not null check (length(trim(tally_ledger)) between 1 and 100 and tally_ledger !~ '[[:cntrl:]]'),
  tally_group  text not null check (length(trim(tally_group)) between 1 and 100 and tally_group !~ '[[:cntrl:]]'),
  voucher_mode text not null check (voucher_mode in ('payment_receipt', 'journal')),
  sort_order   int  not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger categories_set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger payment_sources_set_updated_at before update on public.payment_sources
  for each row execute function public.set_updated_at();

-- Default reference data (editable by the admin in Settings).
insert into public.categories (label, kind, tally_ledger, tally_group, sort_order) values
  ('Fuel',                    'expense', 'Fuel Expense',                'Indirect Expenses', 10),
  ('Fooding',                 'expense', 'Fooding Expense',             'Indirect Expenses', 20),
  ('Staff',                   'expense', 'Staff Expense',               'Indirect Expenses', 30),
  ('Travel',                  'expense', 'Travel Expense',              'Indirect Expenses', 40),
  ('Printing and Stationery', 'expense', 'Printing and Stationery',     'Indirect Expenses', 50),
  ('Programme Material',      'expense', 'Programme Material Expense',  'Indirect Expenses', 60),
  ('Communication',           'expense', 'Communication Expense',       'Indirect Expenses', 70),
  ('Other',                   'expense', 'Other Expense',               'Indirect Expenses', 99),
  ('Donation',                'income',  'Donation Received',           'Direct Incomes',    10),
  ('Grant',                   'income',  'Grant Received',              'Direct Incomes',    20),
  ('Other Income',            'income',  'Other Income',                'Indirect Incomes',  99);

insert into public.payment_sources (label, tally_ledger, tally_group, voucher_mode, sort_order) values
  ('Cash',                'Cash',                'Cash-in-Hand',  'payment_receipt', 10),
  ('Bank',                'Bank Account',        'Bank Accounts', 'payment_receipt', 20),
  ('Loan from Secretary', 'Loan from Secretary', 'Unsecured Loans', 'journal',        30);
