-- ============================================================
-- EzRemedy Database Schema (Supabase / PostgreSQL)
-- ============================================================

create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- PROFILES (extends auth.users)
-- ------------------------------------------------------------
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  role text not null check (role in ('patient','doctor','admin')) default 'patient',
  phone text,
  specialization text,
  bio text,
  years_experience integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- APPOINTMENTS
-- ------------------------------------------------------------
create table public.appointments (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references public.profiles(id) on delete cascade not null,
  doctor_id uuid references public.profiles(id) on delete cascade not null,
  appointment_date timestamptz not null,
  status text not null check (status in ('pending','approved','rescheduled','completed','cancelled')) default 'pending',
  reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- MEDICAL RECORDS
-- ------------------------------------------------------------
create table public.medical_records (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references public.profiles(id) on delete cascade not null,
  doctor_id uuid references public.profiles(id) on delete set null,
  diagnosis text not null,
  prescription text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- MEDICATION REMINDERS
-- ------------------------------------------------------------
create table public.medication_reminders (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references public.profiles(id) on delete cascade not null,
  medication_name text not null,
  dosage text not null,
  frequency text not null,
  start_date date not null,
  end_date date,
  reminder_time time not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- UPDATED_AT TRIGGER FUNCTION
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger trg_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

create trigger trg_records_updated_at
before update on public.medical_records
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- HELPER: current user's role (security definer avoids RLS recursion)
-- ------------------------------------------------------------
create or replace function public.get_my_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.appointments enable row level security;
alter table public.medical_records enable row level security;
alter table public.medication_reminders enable row level security;

-- PROFILES policies
create policy "profiles_select_own"
on public.profiles for select
using (id = auth.uid());

create policy "profiles_select_staff"
on public.profiles for select
using (public.get_my_role() in ('doctor','admin'));

create policy "profiles_insert_own"
on public.profiles for insert
with check (id = auth.uid());

create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- APPOINTMENTS policies
create policy "appointments_select_patient"
on public.appointments for select
using (patient_id = auth.uid());

create policy "appointments_select_staff"
on public.appointments for select
using (public.get_my_role() in ('doctor','admin'));

create policy "appointments_insert_patient"
on public.appointments for insert
with check (patient_id = auth.uid() and public.get_my_role() = 'patient');

create policy "appointments_update_own_patient"
on public.appointments for update
using (patient_id = auth.uid())
with check (patient_id = auth.uid());

create policy "appointments_update_staff"
on public.appointments for update
using (public.get_my_role() in ('doctor','admin'));

-- MEDICAL RECORDS policies
create policy "records_select_patient"
on public.medical_records for select
using (patient_id = auth.uid());

create policy "records_select_staff"
on public.medical_records for select
using (public.get_my_role() in ('doctor','admin'));

create policy "records_insert_staff"
on public.medical_records for insert
with check (public.get_my_role() in ('doctor','admin'));

create policy "records_update_staff"
on public.medical_records for update
using (public.get_my_role() in ('doctor','admin'));

-- MEDICATION REMINDERS policies
create policy "reminders_all_own"
on public.medication_reminders for all
using (patient_id = auth.uid())
with check (patient_id = auth.uid());

create policy "reminders_select_staff"
on public.medication_reminders for select
using (public.get_my_role() in ('doctor','admin'));

-- ------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------
create index idx_appointments_patient on public.appointments(patient_id);
create index idx_appointments_doctor on public.appointments(doctor_id);
create index idx_appointments_status on public.appointments(status);
create index idx_records_patient on public.medical_records(patient_id);
create index idx_reminders_patient on public.medication_reminders(patient_id);
create index idx_profiles_role on public.profiles(role);
