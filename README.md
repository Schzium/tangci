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

## 6. Halaman "Daftar Penyiar" (khusus admin, bisa disunting)

Log in → tombol **Penyiar** di kepala (atau menu ☰ → **Daftar Penyiar**). Isinya
**satu daftar panjang** semua penyiar yang bisa langsung disunting di tempat:

- kolom **Nama** dan **Inisial** (ketik langsung),
- tombol **L/P** (L → P → kosong), **Kat** (**P** = Penatua, **HP** = Hamba
  Pelayanan, kosong = penyiar biasa), **Rot** (ikut rotasi siswa/asisten atau tidak),
- **×** untuk menghapus baris,
- di bawah tiap baris: **tugasnya apa dan pekan mana**, mis.
  `2 tugas: Asisten 4 Nov · Siswa 9 Des`, lalu statusnya (`siap ditugaskan`,
  `jeda N pekan`, `sudah ada tugas mendatang`, `belum pernah dapat tugas`),
- kotak **Tambah** untuk nama baru, dan baris **Ganti PIN · Batal · Simpan** yang
  menempel di bawah layar.

Urutan awal: **Penatua (P) → Hamba Pelayanan (HP) → Penyiar**, lalu A–Z. Baris kuning
= nama yang tertulis di jadwal tapi belum ada di daftar. Mengubah nama di sini ikut
mengganti nama itu di seluruh jadwal (lihat bagian 5). Halaman ini **tidak ikut
tercetak** — saat PDF hanya lembar jadwal (halaman 1) yang keluar.

## 7. Aplikasi menyegarkan diri sendiri

Supaya penyiar tidak perlu tahu cara me-refresh, aplikasi memeriksa berkas
`index.html` di server setiap 3 menit (dan setiap kali dibuka kembali). Kalau ada
versi baru, halaman **memuat ulang sendiri** — kecuali sedang ada panel/jendela
terbuka, supaya isian yang belum disimpan tidak hilang.

Cara kerjanya: ada penanda di kepala berkas

```
<meta name="versi" content="2026-11-23.8">
```

**Setiap kali `index.html` diubah lalu diunggah, ubah juga angka `content` itu**
(mis. jadi `2026-11-23.6`). Angka berbeda = semua HP yang sedang membuka aplikasi
akan menyegarkan dirinya sendiri. Naikkan juga `CACHE` di `sw.js` supaya berkas
lain ikut diperbarui.

## Catatan

- Setiap HP menyimpan salinan di `localStorage`; kalau internet mati aplikasi tetap jalan.
- Tombol **PDF** sekali klik langsung menyimpan berkas PDF ke folder **Unduhan**
  (di HP: folder Download). Tidak ada dialog cetak, jadi tidak ada pengaturan
  kertas, margin, skala, atau "grafik latar belakang" yang perlu diubah.
  Isinya hanya lembar jadwal pekan yang sedang tampil, satu halaman 8,5 × 11 inci
  (612 × 792 pt), warna pita bagian (abu/emas/marun) utuh. Nama berkasnya mengikuti
  pekan, mis. `Jadwal-Tengah-Pekan-25-Nov.pdf`.
  Di dalam berkas itu lembarnya tersimpan sebagai gambar beresolusi tinggi (3×),
  jadi tampilannya persis seperti di layar dan warnanya tidak mungkin pudar —
  tapi teksnya tidak bisa diblok atau dicari. Kalau peramban menolak cara ini,
  aplikasi otomatis kembali memakai dialog cetak biasa (Ctrl+P).

## 4. Tombol di kepala aplikasi

Semua tombol kerja hanya muncul **setelah Log in** (PIN). Sebelumnya yang tampak
hanya **Log in**. Sesudah masuk: **PDF**, **Sync**, **Penyiar**, **Keluar**, plus
**Bagi tugas** di baris pekan.

Saat sedang membuka halaman **Daftar Penyiar**, deretan tombol itu berganti jadi
satu tombol **← Jadwal** (bukan **Keluar**), jadi kembali ke lembar jadwal tidak
membuat Anda harus log in ulang. Kalau ada perubahan yang belum disimpan, aplikasi
menanyakan dulu: **Simpan dulu** atau **Buang perubahan**.

Tombol **Bagi tugas** tidak lagi mengisi semua pekan sekaligus. Setelah ditekan
muncul daftar pekan beserta jumlah slot yang masih kosong (pekan yang perhimpunannya
ditiadakan ditandai *tidak ada perhimpunan* dan tidak bisa dipilih); pilih satu
pekan, dan hanya pekan itu yang diisi. Pekan lain tidak disentuh.

Hanya admin yang bisa mengubah isi jadwal (klik nama siswa/asisten, **Ketua**, dan
**Doa** untuk memilih dari daftar penyiar). Yang belum log in hanya bisa membaca:
nama tidak bisa diklik, tanda panah kecil di sebelah nama tidak ditampilkan, dan
pasangan siswa/asisten ditulis mengalir seperti biasa — **"Calvin / Febri"** — bukan
dua kolom yang saling berjauhan — dan kursi yang belum diisi tidak diberi tanda "—". Lembar PDF (tombol **PDF**) memakai gaya mengalir
yang sama, sedangkan di layar admin tetap berkolom rapi supaya kedua nama mudah diklik.

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
