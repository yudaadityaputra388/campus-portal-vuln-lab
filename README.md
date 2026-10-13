# Portal Kampus Fiktif - Vulnerable-by-Design Lab

> **Hanya untuk edukasi.** Semua data sintetis. Server hanya listen di `127.0.0.1:3000`.
> Jangan deploy ke server publik / jaringan bersama.

## Menjalankan
```bash
npm install
npm start      # http://127.0.0.1:3000
```

## Akun demo (fiktif)
| Role     | Username | Password  | ID / NIM / NIP       |
|----------|----------|-----------|----------------------|
| Student  | mhs01    | mhs123    | NIM 2024000001       |
| Student  | mhs02    | mhs123    | NIM 2024000002       |
| Student  | mhs03    | mhs123    | NIM 2024000003       |
| Lecturer | dosen01  | dosen123  | NIP 198001012010011001 |
| Lecturer | dosen02  | dosen123  | NIP 198505052012022002 |
| Admin    | admin01  | admin123  | -                    |

Restart server untuk mereset data (semua in-memory); hapus folder `uploads/` untuk membersihkan berkas.

## Peta kerentanan (cari tag `[VULN-x]` di `server.js`)
| Tag | Kelas | Lokasi | Ide latihan |
|-----|-------|--------|-------------|
| VULN-1a/b/c | Weak File Upload Validation | `POST /upload`, JS di `/upload` | Login sbg mahasiswa; amati bahwa validasi hanya MIME header & JS client. Kirim ulang request dengan header/nama file berbeda (Burp/curl) dan amati perilaku server serta nama file yang tersimpan. |
| VULN-2 | Missing Function-Level Access Control | `PUT /api/grades/:id` | Login sbg mahasiswa, panggil API nilai langsung. Bandingkan dengan halaman `/grades` yang memeriksa role. |
| VULN-3 | Privilege Escalation | `POST /api/users/:id/role`, `GET /api/users` | Login sbg mahasiswa, ubah role akun sendiri. Bandingkan dengan halaman `/admin`. |
| VULN-3a | IDOR | `GET /transcript?nim=` | Ganti parameter `nim` ke NIM mahasiswa lain. |

## Tugas Code Review & Patch
1. Temukan setiap tag `[VULN-x]`, tulis bukti (PoC request) dan dampaknya.
2. Terapkan patch dari komentar `PATCH`, lalu uji ulang bahwa serangan gagal:
   - Upload: allow-list ekstensi + cek magic bytes + nama acak + `Content-Disposition: attachment` + `nosniff`.
   - Access control: `requireRole(...)` di setiap endpoint API, ambil identitas dari **session**, bukan dari parameter.
3. Tulis test otomatis (mis. supertest) yang memastikan `student` mendapat `403` pada endpoint dosen/admin.
4. Bonus: tambahkan hash password (bcrypt/argon2), CSRF token, rate limiting, dan audit log.

## Catatan desain
- Ruang diskusi sengaja meng-escape output agar fokus lab tetap pada 2 kelas kerentanan utama.
- Express hanya menyajikan berkas statis, tidak mengeksekusi apa pun; pembelajaran berfokus pada logika validasi dan otorisasi.
