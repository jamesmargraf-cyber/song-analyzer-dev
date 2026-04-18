-- ============================================
-- STEREO MAP APP — DATABASE SCHEMA
-- Paste this into Supabase SQL Editor and run
-- ============================================

-- PROFILES (one row per user, synced from auth)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  role text not null default 'student' check (role in ('student', 'teacher')),
  created_at timestamptz default now()
);

-- SONGS (created by teacher, includes instruments + answer key)
create table if not exists songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  audio_url text,
  instruments jsonb not null default '[]',
  published boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- SUBMISSIONS (one per student per song)
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  song_id uuid not null references songs(id) on delete cascade,
  student_positions jsonb not null default '[]',
  results jsonb not null default '[]',
  overall_score integer not null default 0,
  submitted_at timestamptz default now(),
  unique(student_id, song_id)
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table profiles   enable row level security;
alter table songs      enable row level security;
alter table submissions enable row level security;

-- PROFILES: users can read/update their own profile
create policy "Users can view their own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can insert their own profile"
  on profiles for insert with check (auth.uid() = id);

-- Teachers can view all profiles (for progress tracking)
create policy "Teachers can view all profiles"
  on profiles for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'teacher'
    )
  );

-- SONGS: published songs visible to all authenticated users
create policy "Anyone authenticated can view published songs"
  on songs for select
  using (auth.role() = 'authenticated' and published = true);

-- Teachers can do everything with songs
create policy "Teachers can manage all songs"
  on songs for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'teacher'
    )
  );

-- SUBMISSIONS: students can view/insert/update their own
create policy "Students can view their own submissions"
  on submissions for select using (auth.uid() = student_id);

create policy "Students can insert their own submissions"
  on submissions for insert with check (auth.uid() = student_id);

create policy "Students can update their own submissions"
  on submissions for update using (auth.uid() = student_id);

-- Teachers can view all submissions (for progress tracking)
create policy "Teachers can view all submissions"
  on submissions for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'teacher'
    )
  );

-- ============================================
-- MAKE YOURSELF A TEACHER
-- Run this after signing in for the first time,
-- replacing the email with your own school email
-- ============================================

-- update profiles set role = 'teacher' where email = 'your.email@school.edu';
