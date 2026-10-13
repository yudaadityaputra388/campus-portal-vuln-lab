/**
 * ============================================================================
 *  PORTAL KAMPUS FIKTIF "Universitas Contoh Nusantara" - VULNERABLE-BY-DESIGN LAB
 * ============================================================================
 *  !!! HANYA UNTUK EDUKASI. JANGAN PERNAH DI-DEPLOY KE JARINGAN PUBLIK. !!!
 *  - Semua data (nama, NIM, NIP, email, nilai) 100% sintetis.
 *  - Server di-bind ke 127.0.0.1 agar tidak bisa diakses dari luar mesin Anda.
 *  - Kerentanan ditandai dengan komentar:  [VULN-1] , [VULN-2] , [VULN-3]
 *    beserta penjelasan flaw dan REMEDIATION (cara perbaikan).
 *
 *  Jalankan:  npm install && npm start   ->  http://127.0.0.1:3000
 * ============================================================================
 */
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// DATA SINTETIS (in-memory). Password plaintext sengaja dipakai demi kesederhanaan lab.
// ---------------------------------------------------------------------------
const users = [
  { id: 1, username: 'admin01',  password: 'admin123', role: 'admin',    name: 'Admin Fiktif',        email: 'admin01@contoh.test' },
  { id: 2, username: 'dosen01',  password: 'dosen123', role: 'lecturer', name: 'Dr. Budi Sampurna',   email: 'budi@contoh.test',  nip: '198001012010011001' },
  { id: 3, username: 'dosen02',  password: 'dosen123', role: 'lecturer', name: 'Dr. Citra Lestari',   email: 'citra@contoh.test', nip: '198505052012022002' },
  { id: 4, username: 'mhs01',    password: 'mhs123',   role: 'student',  name: 'Ani Contoh',          email: 'ani@mhs.contoh.test',  nim: '2024000001' },
  { id: 5, username: 'mhs02',    password: 'mhs123',   role: 'student',  name: 'Beni Sampel',         email: 'beni@mhs.contoh.test', nim: '2024000002' },
  { id: 6, username: 'mhs03',    password: 'mhs123',   role: 'student',  name: 'Dewi Rekaan',         email: 'dewi@mhs.contoh.test', nim: '2024000003' },
];
const grades = [
  { id: 1, nim: '2024000001', course: 'Pemrograman Web',  score: 88 },
  { id: 2, nim: '2024000001', course: 'Basis Data',       score: 76 },
  { id: 3, nim: '2024000002', course: 'Pemrograman Web',  score: 65 },
  { id: 4, nim: '2024000002', course: 'Basis Data',       score: 91 },
  { id: 5, nim: '2024000003', course: 'Pemrograman Web',  score: 72 },
  { id: 6, nim: '2024000003', course: 'Jaringan Komputer',score: 58 },
];
const submissions = []; // { id, nim, filename, mimetype }
const posts = [{ id: 1, author: 'Dr. Budi Sampurna', text: 'Selamat datang di ruang diskusi (fiktif).' }];

const letter = s => (s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : s >= 40 ? 'D' : 'E');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

// ---------------------------------------------------------------------------
// MIDDLEWARE
// ---------------------------------------------------------------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ secret: 'lab-only-secret', resave: false, saveUninitialized: false }));

// Mengambil user dari session
const me = req => users.find(u => u.id === req.session.uid);

// Middleware yang BENAR: hanya cek "sudah login".
const requireLogin = (req, res, next) => (me(req) ? next() : res.redirect('/login'));
const requireLoginApi = (req, res, next) => (me(req) ? next() : res.status(401).json({ error: 'login required' }));

/**
 * Middleware role yang BENAR (dipakai sebagai contoh REMEDIATION).
 * Perhatikan: beberapa endpoint di bawah SENGAJA tidak memakainya.
 */
const requireRole = (...roles) => (req, res, next) => {
  const u = me(req);
  if (!u || !roles.includes(u.role)) return res.status(403).json({ error: 'forbidden' });
  next();
};

// ---------------------------------------------------------------------------
// TEMPLATE HTML SEDERHANA
// ---------------------------------------------------------------------------
function page(req, title, body) {
  const u = me(req);
  let nav = '<a href="/">Beranda</a>';
  if (u) {
    if (u.role === 'student')  nav += ' | <a href="/transcript">Transkrip</a> | <a href="/upload">Unggah Tugas</a> | <a href="/forum">Diskusi</a>';
    if (u.role === 'lecturer') nav += ' | <a href="/grades">Input Nilai</a> | <a href="/forum">Diskusi</a>';
    // Menu admin hanya DISEMBUNYIKAN di UI untuk non-admin (security by obscurity!) -> lihat [VULN-3]
    if (u.role === 'admin')    nav += ' | <a href="/admin">Kelola Akun</a>';
    nav += ` | <a href="/logout">Logout (${esc(u.username)} / ${u.role})</a>`;
  } else nav += ' | <a href="/login">Login</a>';
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:sans-serif;max-width:860px;margin:20px auto;padding:0 12px}
.banner{background:#fff3cd;border:1px solid #e0c36a;padding:8px;margin-bottom:12px;font-size:13px}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px;text-align:left}
nav{margin:10px 0;padding:8px;background:#eef}</style></head><body>
<div class="banner">&#9888; LAB EDUKASI KEAMANAN - aplikasi sengaja rentan. Data 100% fiktif. Hanya jalankan di localhost.</div>
<h2>Universitas Contoh Nusantara (Fiktif)</h2><nav>${nav}</nav><h3>${esc(title)}</h3>${body}</body></html>`;
}

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------
app.get('/', (req, res) => {
  const u = me(req);
  res.send(page(req, 'Beranda', u
    ? `<p>Halo, <b>${esc(u.name)}</b> (${u.role}).</p>`
    : `<p>Silakan <a href="/login">login</a>.</p>
       <p><small>Akun demo: mhs01/mhs123, dosen01/dosen123, admin01/admin123</small></p>`));
});

app.get('/login', (req, res) => res.send(page(req, 'Login',
  `<form method="post" action="/login">
    <p>Username <input name="username"></p><p>Password <input type="password" name="password"></p>
    <button>Masuk</button></form>`)));

app.post('/login', (req, res) => {
  const u = users.find(x => x.username === req.body.username && x.password === req.body.password);
  if (!u) return res.status(401).send(page(req, 'Login gagal', '<p>Kredensial salah. <a href="/login">Coba lagi</a></p>'));
  req.session.uid = u.id;
  res.redirect('/');
});
app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

// ---------------------------------------------------------------------------
// MAHASISWA: TRANSKRIP
// ---------------------------------------------------------------------------
app.get('/transcript', requireLogin, (req, res) => {
  const u = me(req);

  // [VULN-3a] IDOR (Insecure Direct Object Reference) pada parameter ?nim=
  // ---------------------------------------------------------------------------
  // FLAW   : NIM diambil dari query string dan dipercaya begitu saja. Tidak ada
  //          pengecekan bahwa NIM tersebut milik user yang sedang login. Mahasiswa
  //          bisa membuka /transcript?nim=2024000002 untuk melihat nilai orang lain.
  // PATCH  : Jangan terima identitas objek dari klien untuk data milik sendiri:
  //            const nim = u.nim;                                  // dari session
  //          atau jika dosen/admin boleh melihat milik orang lain:
  //            if (u.role === 'student' && req.query.nim !== u.nim) return res.sendStatus(403);
  const nim = req.query.nim || u.nim;

  const rows = grades.filter(g => g.nim === nim)
    .map(g => `<tr><td>${esc(g.course)}</td><td>${g.score}</td><td>${letter(g.score)}</td></tr>`).join('');
  const owner = users.find(x => x.nim === nim);
  res.send(page(req, 'Transkrip Nilai',
    `<p>NIM: <b>${esc(nim)}</b> ${owner ? '- ' + esc(owner.name) : ''}</p>
     <table><tr><th>Mata Kuliah</th><th>Nilai</th><th>Huruf</th></tr>${rows || '<tr><td colspan=3>Tidak ada data</td></tr>'}</table>`));
});

// ---------------------------------------------------------------------------
// MAHASISWA: UNGGAH TUGAS
// ---------------------------------------------------------------------------
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  // [VULN-1b] Nama file asli dari klien dipakai apa adanya.
  // FLAW  : Nama bisa berisi ekstensi ganda ("tugas.php.png"), karakter aneh, atau
  //         menimpa file lain dengan nama sama.
  // PATCH : Generate nama acak di server dan tentukan ekstensi dari hasil deteksi tipe:
  //           filename: (req, file, cb) => cb(null, crypto.randomUUID() + '.pdf')
  filename: (req, file, cb) => cb(null, file.originalname),
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // [VULN-1a] Weak File Upload Validation: hanya mempercayai header MIME dari klien.
    // ---------------------------------------------------------------------------
    // FLAW   : file.mimetype berasal dari header Content-Type pada multipart request
    //          yang dikontrol penuh oleh pengirim (mudah dipalsukan dengan proxy
    //          seperti Burp / curl -F "file=@x;type=application/pdf"). Isi file
    //          (magic bytes) dan ekstensi TIDAK diperiksa. Pengecekan ekstensi di
    //          browser (lihat JS di halaman /upload) juga hanya client-side dan
    //          bisa dilewati.
    // PATCH  : (1) allow-list ekstensi di server, (2) cek magic bytes isi file
    //              (mis. PDF diawali "%PDF-", PNG diawali 89 50 4E 47) memakai
    //              pustaka seperti `file-type`, (3) rename acak, (4) simpan di luar
    //              web root / bucket terpisah, (5) sajikan dengan
    //              Content-Disposition: attachment dan X-Content-Type-Options: nosniff,
    //              (6) batasi ukuran & scan antivirus.
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Tipe berkas tidak diizinkan (hanya PDF/PNG/JPG)'));
  },
});

// Berkas dilayani statis. Di lab ini Express TIDAK mengeksekusi file apa pun;
// kerentanan dipelajari di level logika validasi, bukan eksekusi kode.
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/upload', requireLogin, (req, res) => {
  const u = me(req);
  const list = submissions.filter(s => s.nim === u.nim)
    .map(s => `<li><a href="/uploads/${encodeURIComponent(s.filename)}">${esc(s.filename)}</a> (${esc(s.mimetype)})</li>`).join('');
  res.send(page(req, 'Unggah Tugas', `
    <form id="f" method="post" action="/upload" enctype="multipart/form-data">
      <input type="file" name="file" id="file" accept=".pdf,.png,.jpg"> <button>Unggah</button>
    </form>
    <script>
      // [VULN-1c] Validasi ekstensi HANYA di client-side.
      // FLAW : Penyerang cukup menonaktifkan JS / mengirim request langsung (curl/Burp).
      // PATCH: Anggap ini hanya UX. Validasi otoritatif harus selalu di server.
      document.getElementById('f').addEventListener('submit', e => {
        const n = document.getElementById('file').value.toLowerCase();
        if (!/\\.(pdf|png|jpg)$/.test(n)) { alert('Hanya PDF/PNG/JPG'); e.preventDefault(); }
      });
    </script>
    <h4>Tugas saya</h4><ul>${list || '<li>Belum ada</li>'}</ul>`));
});

app.post('/upload', requireLogin, (req, res) => {
  upload.single('file')(req, res, err => {
    if (err) return res.status(400).send(page(req, 'Gagal', `<p>${esc(err.message)}</p><a href="/upload">Kembali</a>`));
    if (!req.file) return res.status(400).send(page(req, 'Gagal', '<p>Tidak ada berkas.</p>'));
    submissions.push({ id: submissions.length + 1, nim: me(req).nim, filename: req.file.filename, mimetype: req.file.mimetype });
    res.redirect('/upload');
  });
});

// ---------------------------------------------------------------------------
// RUANG DISKUSI (output di-escape; bukan fokus kerentanan lab ini)
// ---------------------------------------------------------------------------
app.get('/forum', requireLogin, (req, res) => {
  const list = posts.map(p => `<li><b>${esc(p.author)}</b>: ${esc(p.text)}</li>`).join('');
  res.send(page(req, 'Ruang Diskusi', `<ul>${list}</ul>
    <form method="post" action="/forum"><input name="text" size="60" maxlength="300"><button>Kirim</button></form>`));
});
app.post('/forum', requireLogin, (req, res) => {
  const text = String(req.body.text || '').slice(0, 300);
  if (text) posts.push({ id: posts.length + 1, author: me(req).name, text });
  res.redirect('/forum');
});

// ---------------------------------------------------------------------------
// DOSEN: INPUT / EDIT NILAI
// ---------------------------------------------------------------------------
// Halaman UI: dicek rolenya dengan benar (hanya dosen) ...
app.get('/grades', requireLogin, (req, res) => {
  if (me(req).role !== 'lecturer') return res.status(403).send(page(req, 'Ditolak', '<p>Khusus dosen.</p>'));
  const rows = grades.map(g => `<tr><td>${g.id}</td><td>${esc(g.nim)}</td><td>${esc(g.course)}</td>
    <td><input id="s${g.id}" type="number" min="0" max="100" value="${g.score}" style="width:70px">
    <button onclick="save(${g.id})">Simpan</button></td></tr>`).join('');
  res.send(page(req, 'Input Nilai Mahasiswa', `<table><tr><th>ID</th><th>NIM</th><th>MK</th><th>Nilai</th></tr>${rows}</table>
    <script>
      async function save(id){
        const r = await fetch('/api/grades/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({score:Number(document.getElementById('s'+id).value)})});
        alert(r.ok?'Tersimpan':'Gagal: '+r.status);
      }
    </script>`));
});

// ... TETAPI endpoint API-nya tidak:
// [VULN-2] Missing Function-Level Access Control (Broken Access Control)
// ---------------------------------------------------------------------------
// FLAW   : Halaman /grades memeriksa role, namun endpoint API di bawah hanya memeriksa
//          "sudah login". Akibatnya MAHASISWA yang login dapat memanggil langsung:
//            PUT /api/grades/3  {"score":100}
//          dan mengubah nilai siapa pun (juga IDOR karena :id objek apa pun diterima).
//          Menyembunyikan tombol/halaman di UI BUKAN kontrol akses.
// PATCH  : Terapkan otorisasi di SETIAP endpoint sisi server, deny-by-default:
//            app.put('/api/grades/:id', requireLoginApi, requireRole('lecturer'), handler)
//          dan untuk skenario nyata, verifikasi juga bahwa dosen tersebut memang
//          mengampu mata kuliah itu (object-level authorization).
app.put('/api/grades/:id', requireLoginApi, (req, res) => {
  const g = grades.find(x => x.id === Number(req.params.id));
  if (!g) return res.status(404).json({ error: 'not found' });
  const score = Number(req.body.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) return res.status(400).json({ error: 'invalid score' });
  g.score = score;
  res.json({ ok: true, grade: g });
});

// ---------------------------------------------------------------------------
// ADMIN: KELOLA AKUN
// ---------------------------------------------------------------------------
app.get('/admin', requireLogin, (req, res) => {
  if (me(req).role !== 'admin') return res.status(403).send(page(req, 'Ditolak', '<p>Khusus admin.</p>'));
  const rows = users.map(u => `<tr><td>${u.id}</td><td>${esc(u.username)}</td><td>${esc(u.name)}</td>
    <td>${esc(u.email)}</td><td>${esc(u.nim || u.nip || '-')}</td>
    <td><select id="r${u.id}">${['student','lecturer','admin'].map(r => `<option ${r===u.role?'selected':''}>${r}</option>`).join('')}</select>
    <button onclick="setRole(${u.id})">Ubah</button></td></tr>`).join('');
  res.send(page(req, 'Daftar Akun', `<table><tr><th>ID</th><th>User</th><th>Nama</th><th>Email</th><th>NIM/NIP</th><th>Role</th></tr>${rows}</table>
    <script>
      async function setRole(id){
        const r = await fetch('/api/users/'+id+'/role',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({role:document.getElementById('r'+id).value})});
        alert(r.ok?'Role diubah':'Gagal: '+r.status); location.reload();
      }
    </script>`));
});

// [VULN-3] Privilege Escalation via Missing Function-Level Access Control
// ---------------------------------------------------------------------------
// FLAW   : Endpoint ini tidak mengecek role pemanggil. Mahasiswa mana pun dapat
//          mengirim:  POST /api/users/4/role  {"role":"admin"}
//          lalu menjadi admin (vertical privilege escalation). Sama halnya GET
//          /api/users membocorkan seluruh daftar akun ke user biasa.
// PATCH  : requireLoginApi, requireRole('admin') pada kedua route; jangan pernah
//          menerima field role/privilege dari input user biasa; catat audit log;
//          untuk perubahan sensitif pertimbangkan re-autentikasi.
app.post('/api/users/:id/role', requireLoginApi, (req, res) => {
  const target = users.find(u => u.id === Number(req.params.id));
  if (!target) return res.status(404).json({ error: 'not found' });
  if (!['student', 'lecturer', 'admin'].includes(req.body.role)) return res.status(400).json({ error: 'invalid role' });
  target.role = req.body.role;
  res.json({ ok: true, id: target.id, role: target.role });
});

app.get('/api/users', requireLoginApi, (req, res) =>
  // FLAW sama: tanpa requireRole('admin'). Password sengaja tidak dikirim.
  res.json(users.map(({ password, ...safe }) => safe)));

// Referensi implementasi yang benar (tidak dipakai di atas, untuk perbandingan saat latihan patch):
// app.post('/api/users/:id/role', requireLoginApi, requireRole('admin'), handler);

// ---------------------------------------------------------------------------
// START: bind ke loopback saja
// ---------------------------------------------------------------------------
app.listen(3000, '127.0.0.1', () =>
  console.log('Lab aktif di http://127.0.0.1:3000  (HANYA lokal, aplikasi sengaja rentan)'));
