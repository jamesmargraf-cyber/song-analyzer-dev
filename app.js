// ── SUPABASE CONFIG ──
const SUPABASE_URL = 'https://hmaplzcwhunonyrntnvr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NilRxviJIdeMEGCuOPT6fg_832uShsL';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── AUTH HELPERS ──
async function getSession() {
  const { data: { session } } = await db.auth.getSession();
  return session;
}

async function getUser() {
  const session = await getSession();
  return session?.user ?? null;
}

async function signInWithGoogle() {
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'https://jamesmargraf-cyber.github.io/stereomap/index.html' }
  });
  if (error) showToast(error.message, 'error');
}

async function signOut() {
  await db.auth.signOut();
  window.location.href = '/stereomap/index.html';
}

// ── ROLE CHECK ──
const TEACHER_EMAILS = ['james.margraf@camas.wednet.edu'];

async function isTeacher(user) {
  if (!user) return false;
  if (TEACHER_EMAILS.includes(user.email)) return true;
  const { data } = await db.from('profiles').select('role').eq('id', user.id).single();
  return data?.role === 'teacher';
}

// Ensure a profile row exists for this user
async function ensureProfile(user) {
  const { data } = await db.from('profiles').select('id').eq('id', user.id).single();
  if (!data) {
    await db.from('profiles').insert({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.email.split('@')[0],
      role: 'student'
    });
  }
}

// ── TOAST ──
function showToast(msg, type = '') {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'toast ' + type;
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── NAV RENDER ──
async function renderNav(role) {
  const user = await getUser();
  if (!user) return;
  const nav = document.getElementById('nav');
  if (!nav) return;
  nav.innerHTML = `
    <a class="nav-logo" href="${role === 'teacher' ? '/stereomap/teacher.html' : '/stereomap/student.html'}">Stereo Map</a>
    <div class="nav-right">
      <span class="nav-user">${user.user_metadata?.full_name || user.email}</span>
      <span class="nav-badge ${role}">${role}</span>
      ${role === 'teacher' ? '<a href="/stereomap/student.html?preview=1" class="btn sm">Student view</a>' : ''}
      <button class="btn sm" onclick="signOut()">Sign out</button>
    </div>
  `;
}

// ── MODAL HELPERS ──
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── GUARD: redirect if not logged in ──
async function requireAuth(redirectTo = '/stereomap/index.html') {
  const user = await getUser();
  if (!user) { window.location.href = redirectTo; return null; }
  return user;
}

// ── GUARD: redirect if not teacher ──
async function requireTeacher() {
  const user = await requireAuth('/stereomap/index.html');
  if (!user) return null;
  const teacher = await isTeacher(user);
  if (!teacher) { window.location.href = '/stereomap/student.html'; return null; }
  return user;
}

