-- Google Routes API results are third-party content whose long-term storage may
-- conflict with Google Maps Platform terms. Keep them isolated in these two
-- columns so they can be purged (set to null) or dropped without touching the
-- rest of a saved plan. Nothing else in the schema may depend on them.
alter table public.plans
  alter column route_snapshot drop not null,
  alter column route_calculated_at drop not null;

-- A route and its calculation time are kept or removed together.
alter table public.plans
  add constraint plans_route_snapshot_pair
  check ((route_snapshot is null) = (route_calculated_at is null));

comment on column public.plans.route_snapshot is
  'Google Routes API result (client snapshot, not live). Purgeable: may be set to null or dropped; the API returns null.';
comment on column public.plans.route_calculated_at is
  'When route_snapshot was calculated. Null exactly when route_snapshot is null.';
