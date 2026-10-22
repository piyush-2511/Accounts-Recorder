-- Local development only. Categories and sources are already seeded by the migrations.
-- Set the Tally company name used in exports:
update public.app_settings set value = to_jsonb('My Organisation'::text) where key = 'company_name';
