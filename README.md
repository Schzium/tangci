# Jadwal & Hadirin — Tangerang Cipendoh

Satu aplikasi, dua tampilan. Tombol **☰** di kiri atas untuk pindah:

| Menu | Isi |
|---|---|
| **Jadwal Tengah Pekan** | Jadwal Nov–Des 2026 (WOL), 9 pekan, link biru + spoiler lagu/ayat, pilih nama, admin PIN |
| **Hitung Hadirin** | Denah kursi (app TangCi): klik kursi → isi nama → hijau; ada view AV / Podium, pilih baris, reset |

Isi folder:

```
index.html          ← seluruh aplikasi (jadwal + hitung hadirin + menu)
manifest.json       ← supaya bisa di-install ke HP (PWA)
sw.js               ← cache offline
icon-192-3d.png     ← ikon
icon-512-3d.png     ← ikon
firebase.json       ← pengaturan deploy Firebase Hosting
```

## 1. Firebase (supaya semua HP lihat data yang sama)

Aplikasi memakai project **tangci** yang sudah ada. Data jadwal disimpan di:

- `jhtp/tugas` → nama yang dipilih per pekan per slot
- `jhtp/daftar` → daftar penyiar (nama, inisial, L/P, boleh-tugas)
- `tangci/state` → denah kursi hitung hadirin (dipakai app lama)

Sekarang Firestore menolak baca/tulis (pesan di menu: **"Cloud terkunci"**), jadi aplikasi
jalan dari data HP saja. Supaya tersambung, buka
**Firebase Console → Firestore Database → Rules**, lalu pakai:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tangci/{doc} { allow read, write: if true; }
    match /jhtp/{doc}   { allow read, write: if true; }
  }
}
```

Setelah disimpan, buka menu lagi — tulisan berubah jadi **"Cloud aktif · data tersinkron"**.
Kalau mau lebih aman daripada `if true`, ganti dengan `if request.auth != null`
(tapi aplikasi ini belum pakai login).

## 2. Deploy ke Firebase Hosting

Dari folder ini:

```bash
firebase login
firebase use tangci
firebase deploy --only hosting
```

Alamatnya jadi `https://tangci.web.app`.

## 3. Install ke HP

Buka alamat di atas dengan Chrome → menu ⋮ → **Tambahkan ke layar utama**.
Sudah ada manifest + service worker, jadi terbuka layar penuh tanpa address bar.

## Catatan

- Setiap HP menyimpan salinan di `localStorage`; kalau internet mati aplikasi tetap jalan.
- PIN admin jadwal: **000000** (bisa diganti di panel Hadirin → Ganti PIN).
- Print jadwal tetap 9 halaman per set, ukuran 612×792 pt, sama seperti file aslinya.
