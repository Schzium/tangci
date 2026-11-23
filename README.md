# Jadwal & Hadirin — Tangerang Cipendoh

Satu aplikasi, dua tampilan. Tombol **☰** di kiri atas untuk pindah:

| Menu | Isi |
|---|---|
| **Jadwal Tengah Pekan** | Jadwal Nov–Des 2026 (WOL), 9 pekan, link biru + spoiler lagu/ayat, pilih nama, mode admin |
| **Hitung Hadirin** | Denah kursi (app TangCi): klik kursi → isi nama → hijau; ada view AV / Podium, pilih baris, reset |

Isi folder:

```
index.html          ← seluruh aplikasi (jadwal + hitung hadirin + menu)
wol.json            ← isi jadwal + ayat + lirik (dibaca otomatis saat aplikasi dibuka)
manifest.json       ← supaya bisa di-install ke HP (PWA)
sw.js               ← cache offline
icon-192-3d.png     ← ikon
icon-512-3d.png     ← ikon
firebase.json       ← pengaturan deploy Firebase Hosting
ambil-wol.mjs       ← alat bantu (opsional): ambil ulang isi ayat + lirik
package.json        ← daftar paket untuk alat bantu itu
package-lock.json
```

## 1. Firebase (supaya semua HP lihat data yang sama)

Aplikasi memakai project **tangci** yang sudah ada. Data jadwal disimpan di:

- `jhtp/tugas` → nama yang dipilih per pekan per slot
- `jhtp/daftar` → daftar penyiar (nama, inisial, L/P, boleh-tugas)
- `tangci/state` → denah kursi hitung hadirin (dipakai app lama)

Kalau Firestore menolak baca/tulis (pesan di menu: **"Cloud terkunci"**), aplikasi
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

## 6. Halaman "Daftar Penyiar" (khusus admin)

Masuk PIN → menu **☰** → **Daftar Penyiar**. Isinya tabel semua penyiar dalam
**dua kolom kiri-kanan** (supaya 70+ nama tidak memanjang ke bawah), diurutkan
**P (Perintis) → HP (Hamba Pelayanan) → Penyiar**, lalu A–Z. Tiap baris:
nama + inisial, kategori, jumlah tugas (×), dan statusnya (`siap`, `jeda N pekan`,
`jadwal 23 Des`, `belum pernah`). Tombol **✎ Sunting daftar** membuka panel sunting
seperti biasa. Halaman ini **tidak ikut tercetak** — saat PDF hanya lembar jadwal
(halaman 1) yang keluar.

## 7. Aplikasi menyegarkan diri sendiri

Supaya penyiar tidak perlu tahu cara me-refresh, aplikasi memeriksa berkas
`index.html` di server setiap 3 menit (dan setiap kali dibuka kembali). Kalau ada
versi baru, halaman **memuat ulang sendiri** — kecuali sedang ada panel/jendela
terbuka, supaya isian yang belum disimpan tidak hilang.

Cara kerjanya: ada penanda di kepala berkas

```
<meta name="versi" content="2026-11-23.2">
```

**Setiap kali `index.html` diubah lalu diunggah, ubah juga angka `content` itu**
(mis. jadi `2026-11-23.3`). Angka berbeda = semua HP yang sedang membuka aplikasi
akan menyegarkan dirinya sendiri. Naikkan juga `CACHE` di `sw.js` supaya berkas
lain ikut diperbarui.

## Catatan

- Setiap HP menyimpan salinan di `localStorage`; kalau internet mati aplikasi tetap jalan.
- Tombol **⇩ PDF** hanya mencetak lembar jadwal pekan yang sedang tampil (1 lembar,
  612×792 pt). Menu, tombol, dan tampilan Hitung Hadirin tidak ikut tercetak.
  Warna pita bagian (abu/emas/marun), garis kepala, dan titik bullet dipaksa ikut
  tercetak lewat `print-color-adjust: exact`, jadi tidak perlu mencentang
  "Grafik latar belakang" di dialog cetak.

## 4. Tombol di kepala aplikasi

Di kepala (sejajar dengan tombol ☰) ada **⇩ PDF**, **↻ Sync**, dan **Admin** (berganti
jadi **Keluar** setelah masuk PIN). Tombol **✎ Penyiar** dan **↻ Bagi tugas** muncul
di baris pekan, hanya saat mode admin aktif.

## 5. Tombol ↻ Sync (jadwal baru tanpa repot)

Di kepala aplikasi ada tombol **↻ Sync**; baris pekan berisi **dropdown pekan**.

- **Dropdown pekan** — semua pekan ada di satu daftar; klik untuk pindah. Baris tab
  tidak lagi memakan tempat (satu baris saja, juga di HP).
- **⟳ Sync** — aplikasi memeriksa sendiri ke wol.jw.org apakah edisi berikutnya
  sudah terbit.
  - Belum terbit → muncul: *"Jadwal baru belum terbit. Jadwal terakhir yang ada:
    30 Desember. Sudah diperiksa: 2020265, 2020266."*
  - Sudah terbit → muncul tawaran *"Jadwal baru sudah terbit! … Ambil sekarang?"* →
    aplikasi mengunduh 9 halaman pelajaran, menyusun jadwalnya, lalu menambahkannya
    **di ujung daftar**. Pekan lama, nama yang sudah dipilih, daftar penyiar, dan
    Hitung Hadirin tidak diubah.

Hasil sync disimpan di HP (localStorage) dan `wol.json` menyimpan isi ayat + lirik,
jadi tampilan tetap lengkap saat dibuka offline.

Catatan teknis: wol.jw.org tidak mengizinkan permintaan langsung dari browser (CORS),
jadi halaman diambil lewat `r.jina.ai` yang meneruskan HTML aslinya (tanpa akun,
gratis). Kalau pemeriksaan gagal, aplikasi memberi pesan dan tidak mengubah data apa pun.

### Alat bantu di folder yang sama (opsional, untuk memuat ulang isi ayat + lirik)

```
ambil-wol.mjs      ← pengambil jadwal dari wol.jw.org → wol.json (Node 20+, jsdom)
package.json
package-lock.json
```

Semua berkas ada di satu folder supaya gampang diunggah ke GitHub. Jalankan di komputer:

```
npm install
node ambil-wol.mjs 2020264 wol.json
```

lalu ganti `wol.json` di folder aplikasi. Ini hanya perlu kalau ingin isi ayat/lirik
diperbarui; untuk menambah pekan baru cukup tombol ⟳ Sync. Ketiga berkas alat itu
tidak ikut terbit ke hosting (sudah masuk `ignore` di `firebase.json`).
