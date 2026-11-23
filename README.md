# TangCi — Jadwal & Hadirin Tangerang Cipendoh

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

Log in → tombol **Penyiar** di kepala. (Tidak ada lagi di menu ☰ supaya tidak dobel;
di sana tinggal **Jadwal Tengah Pekan** dan **Hitung Hadirin**.)

Isinya **satu daftar ringkas** semua penyiar yang bisa disunting di tempat:

- kotak **Cari nama…** di atas untuk menyaring daftar (nama atau inisial),
- tombol **+ Tambah** → muncul jendela form (Nama, Inisial, L/P, Kategori), lalu
  orangnya langsung masuk ke kelompoknya,
- kolom **Nama** dan **Inisial** (ketik langsung; inisial kosong untuk saudari),
- tombol **L/P** (L → P → kosong) dan **Kat** — sekali ketuk berganti urut:
  kosong (penyiar biasa) → **P** Penatua → **HP** Hamba Pelayanan → **OP**
  Operator → **MC** Mic → **OM** Operator & Mic → kembali kosong. Tiap kategori
  punya warna sendiri supaya gampang dilihat sekilas,
- **×** untuk menghapus — selalu ditanya dulu **"Hapus penyiar?"** dengan pilihan
  **Ya, hapus** / **Batal**, jadi tidak ada yang terhapus karena salah tekan,
- baris **Ganti PIN · Batal · Simpan** menempel di bawah layar.

**Urutan daftar:** Penatua → Hamba Pelayanan → OP → MC → OM → penyiar
laki-laki → penyiar perempuan, masing-masing A–Z. (Urutan dirapikan saat daftar
dibuka; mengubah kategori tidak membuat baris melompat di bawah jari.) Baris kuning = nama yang tertulis di jadwal tapi belum
ada di daftar. Mengubah nama di sini ikut mengganti nama itu di seluruh jadwal
(lihat bagian 5). Halaman ini **tidak ikut tercetak** — saat PDF hanya lembar jadwal
yang keluar.

## 6b. Riwayat tugas & antrean yang adil

Jeda tugas tetap **8 pekan sekali**: setelah dapat tugas siswa/asisten, orang itu
baru muncul lagi sebagai "siap" setelah 8 pekan lewat.

Supaya pembagiannya kelihatan adil, aplikasi menyimpan **riwayat tugas 26 pekan
sebelum 4 November 2026** (dibaca dari lembar jadwal Mei–Oktober 2026: 6 Mei s.d.
28 Oktober). Riwayat ini:

- hanya dipakai untuk menghitung **kapan terakhir seseorang dapat tugas** — pekan
  lama tidak tampil sebagai lembar yang bisa disunting dan tidak menambah penyiar
  baru ke daftar;
- membuat kolom **Status** di daftar pilihan berbunyi `siap · 21 pekan` (sudah 21
  pekan tidak dapat tugas → paling layak didahulukan), bukan cuma `siap`;
- pekan yang tidak ada perhimpunan (1 Juli, 18 November) tetap dihitung satu pekan.

### Penyeragaman nama (23 Nov 2026)

Nama penyiar diseragamkan di **semua** tempat (daftar penyiar, lembar jadwal, dan
hitungan tugas), termasuk untuk daftar yang sudah tersimpan di HP/cloud — tidak
perlu diubah manual:

| di jadwal lama | sekarang |
|---|---|
| Anchilla | **Ancilla** |
| Heliana | **Helliana** |
| Hans | **Hansen** |
| Sisca | **Fransisca** |
| Rita / Rita S. | **Anarita** |
| Debby | **Debby M** (Debby P tetap ada, tidak dicampur) |
| A. Pangaribuan | **Agus P** |
| HR | **Tsunehiro N** |
| Benyamin / Beny E | **Benyamin E** |
| Rey D | **Reynatan** |

Empat nama yang dulu tidak ada di daftar ditambahkan: **Alex, Itje, Jerry, Josea**
(L/P-nya masih kosong — ketuk sekali di kolom L/P untuk mengisi; begitu diisi,
inisial & tampilannya menyesuaikan). `BM` dan `Yulia` sengaja **tidak** ditambahkan
karena sudah pindah — keduanya hanya tertinggal di jadwal lama.

Kalau salah satu nama di atas dihapus lewat tombol ×, nama itu tidak akan muncul
lagi sendiri (aplikasi mengingatnya).

## 6c. Tombol **Cetak S-89** (slip tugas siswa)

Di baris pekan, sebelah **Bagi tugas**, ada tombol **Cetak S-89**. Sekali tekan,
aplikasi membuat slip tugas (form S-89) untuk **setiap siswa yang bertugas di pekan
yang sedang dibuka** — satu siswa satu berkas PDF, tidak digabung:

- nama berkas: `S-89_Nama_Penyiar.pdf`;
- ukuran halaman sama dengan PDF jadwal (8,5 × 11 inci, 612 × 792 pt);
- isi slip: Nama, Asisten, Tanggal, Bagian no., pilihan ruang (Ruang utama /
  Ruang tambahan 1 / Ruang tambahan 2), dan catatan untuk siswa — seperti form
  aslinya.

**Yang dapat slip:** siswa **Pembacaan Alkitab (bagian 3)** dan siswa bagian
**Bersemangatlah dalam Pelayanan (bagian 4–6)**. Kalau bagian itu ada asistennya,
nama asisten ditulis di kolom **Asisten** pada slip yang sama (bukan slip
terpisah).

Nama yang dicetak di slip adalah **nama lengkap** siswa (lihat 6d). Kalau nama
lengkapnya belum diisi, slip memakai nama yang tampil di jadwal. Pelajaran Alkitab Sidang dan Pembahasan tidak dibuatkan slip.

Contoh: pekan 25 Nov → 4 berkas, yaitu Adriel (bag. 3), Lilis (bag. 4, asisten Iim),
Bile (bag. 5, asisten Anarita), Sumanto (bag. 6). Nama yang dipakai adalah nama
yang tampil di layar, jadi kalau nama sudah diganti lewat Penyiar, slipnya ikut.

### Rupa dan huruf slip (sejak versi 2026-11-23.20)

Slip dibuat semirip form S-89 aslinya:

- judul **tugas perhimpunan pelayanan dan kehidupan kristen** dua baris, huruf
  tebal, rata tengah;
- tiap isian: label tebal di kiri, kotak isian biru muda dengan **garis putus-putus**
  di bawahnya (seperti kotak isian pada PDF aslinya);
- isi isian ditulis dengan huruf ketik (monospace) berjarak renggang — meniru isian
  yang diketik di form kertas;
- tiga pilihan ruang tetap di posisinya (kotak centang menjorok ke dalam); hanya
  **kotak centang kecilnya** yang berlatar biru muda — persis seperti kotak centang
  pada form aslinya — sedangkan barisnya tetap putih. Lalu catatan untuk siswa dengan
  kalimat S-38 disorot kuning;
- kaki halaman `S-89-IN   11/23` di kiri bawah.

- tulisan label isian tetap **rata kiri** seperti aslinya; hanya tanda titik dua (:)
  yang ditaruh di ujung kanan kolom label, jadi keempat titik dua segaris dan
  menempel pada kotak isian.

Hurufnya **dibundel di dalam berkas** (Open Sans untuk teks tebal/isi, Cousine untuk
isian) dalam bentuk `@font-face` base64, jadi tampilan slip sama di semua HP — tidak
bergantung huruf bawaan Android/Samsung/iPhone dan tetap benar saat berkas dipakai
tanpa internet. Karena hurufnya ikut, ukuran `index.html` bertambah sekitar 55 KB.

## 6d. Nama lengkap (untuk slip S-89)

Setiap penyiar punya tiga bentuk nama, dan masing-masing dipakai di tempat berbeda:

| Bentuk | Contoh | Dipakai di |
| --- | --- | --- |
| Nama di jadwal (semi) | `Calvin W` | tabel jadwal & PDF jadwal |
| Inisial | `CW` | kolom inisial di jadwal |
| Nama lengkap | `Calvin Wijaya` | slip S-89 & nama berkasnya |

**Mengisi nama lengkap:**

1. buka **Penyiar**;
2. ketuk tombol **Lengkap** di atas daftar (sebelah **+ Tambah**);
3. isi nama lengkap tiap orang pada kolom kanan — kolom kiri hanya menampilkan
   nama yang dipakai di jadwal, supaya tidak tertukar;
4. ketuk **Simpan** di jendela itu, lalu **Simpan** di halaman penyiar.

Kolom nama lengkap juga ada di jendela **+ Tambah** waktu menambah penyiar baru.
Nama lengkap yang dibiarkan kosong tidak masalah: slip S-89 memakai nama di jadwal.
Mengubah nama lengkap **tidak** mengubah jadwal, inisial, atau nama di tabel.

## 7. Aplikasi menyegarkan diri sendiri

Supaya penyiar tidak perlu tahu cara me-refresh, aplikasi memeriksa berkas
`index.html` di server setiap 3 menit (dan setiap kali dibuka kembali). Kalau ada
versi baru, halaman **memuat ulang sendiri** — kecuali sedang ada panel/jendela
terbuka, supaya isian yang belum disimpan tidak hilang.

Cara kerjanya: ada penanda di kepala berkas

```
<meta name="versi" content="2026-11-23.10">
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

### Catatan kinerja

Daftar penyiar, hasil pencarian nama, dan hitungan tugas sekarang disimpan di
memori (cache) dan hanya dihitung ulang kalau daftar penyiar atau pilihan nama di
jadwal berubah. Dulu setiap pencarian nama membaca ulang data dan menyortir 76 nama,
sehingga satu kali membuka **Penyiar** memicu ±470 pembacaan dan terasa tersendat di
HP. Sesudah diperbaiki: buka tabel penyiar **13 ms** (dari 57 ms), dan menekan tombol
**L/P**, **kategori**, atau **rotasi** hanya menggambar ulang satu baris —
**1 ms** per ketukan (dari 21 ms untuk seluruh 76 baris).

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
**Doa** untuk memilih dari daftar penyiar). Daftar pilihan itu sudah disaring sesuai
tugasnya — judul kecil di atas daftar menyebut aturannya, jadi tidak perlu mengingat:

| Yang dipilih | Isi daftar |
|---|---|
| **Ketua** | Penatua (P) & Hamba Pelayanan (HP) saja |
| **Doa** | laki-laki **atau** Penatua/HP |
| **1.** Pelajaran pertama, **2.** Permata Rohani | Penatua & HP saja |
| **3.** Pembacaan Alkitab (Siswa) | laki-laki (L) saja |
| **4–5.** Memulai Percakapan, Kunjungan Kembali, Menjadikan Murid | semua nama |
| **6.** Khotbah | laki-laki saja |
| **Kehidupan Kristen** (7, 8, termasuk Pelajaran Alkitab Sidang) | Penatua & HP saja |

Nama yang sedang terpasang tetap ditampilkan walau di luar aturan, supaya bisa diganti
(dan kelihatan kalau ada yang perlu diperbaiki). Tombol **Bagi tugas** memakai aturan
yang sama: Pembacaan Alkitab dan Khotbah hanya diisi saudara (L).

**Inisial dipakai di kolom tugas, nama dipakai di kolom siswa/asisten.**
Kolom **Ketua**, **Doa**, **Ruang Utama**, **Pemandu/Pembaca** Pelajaran Alkitab
Sidang, **Pembahasan**, dan **Bagian Penutup** ditulis dengan inisial — **FN**,
**DL**, **RI** — persis seperti lembar aslinya; kolom **Siswa/Asisten** ditulis
dengan nama — **Adriel**, **Lilis / Iim**, **Bile / Rita**.

**Saudari tanpa inisial.** Perempuan tidak berinisial: kalau seorang saudari
bertugas di kolom Ketua/Doa/Pemandu dan seterusnya, yang ditulis namanya —
mis. **Doa: Rita** — dan kolom **Inisial** di Daftar Penyiar untuk saudari
dibiarkan kosong (tidak bisa diisi). Inisial saudara tetap unik: dulu *Arindra N*
dan *Anchilla* sama-sama **AN** sehingga "AN" jadi tidak jelas siapa; sekarang
**AN** hanya milik *Arindra N*, dan inisial Anchilla tidak ditampilkan.

**Isi kolom nama selalu nama, bukan inisial.** Ketua, Doa, siswa/asisten, Pemandu/Pembaca
Pelajaran Alkitab Sidang, Pembahasan, sampai Bagian Penutup ditulis seperti
**"Arindra N"** — inisial (**AN**) hanya dipakai sebagai kunci pencarian, tidak lagi
muncul di lembar jadwal. Supaya tidak ada dua orang berinisial sama (dulu *Arindra N*
dan *Anchilla* sama-sama **AN**, sehingga "AN" jadi tidak jelas siapa), inisial
dibuat unik: yang lebih dulu berhak (Penatua/HP didahulukan) memakai inisialnya,
yang lain diberi bentuk lain — mis. **Anchilla → ANC**. Singkatan dari lembar WOL yang
belum ada di daftar penyiar (mis. **HR**) tetap tampil apa adanya dan ikut muncul
sebagai baris kuning di **Penyiar** supaya bisa dicocokkan.

**Urutan "Bagi tugas":** yang **belum pernah** dapat tugas didahulukan, lalu yang
terakhir bertugas **8 pekan** lalu, lalu 7, 6, … sampai 1 pekan lalu — jadi orang yang
paling lama tidak dapat tugas selalu paling atas dalam daftar giliran. Yang sudah
terjadwal di pekan mendatang otomatis paling belakang. Sesudah jeda, jumlah tugas
yang sudah dipegang jadi penentu berikutnya. Yang belum log in hanya bisa membaca:
nama tidak bisa diklik, tanda panah kecil di sebelah nama tidak ditampilkan, dan
pasangan siswa/asisten ditulis mengalir seperti biasa — **"Calvin / Febri"** — bukan
dua kolom yang saling berjauhan — dan kursi yang belum diisi tidak diberi tanda "—". Lembar PDF (tombol **PDF**) memakai gaya mengalir
yang sama, sedangkan di layar admin tetap berkolom rapi supaya kedua nama mudah diklik.

## 5. Tombol ↻ Sync (jadwal baru tanpa repot)

Di kepala aplikasi ada tombol **↻ Sync**; baris pekan berisi **dropdown pekan**.

- **Dropdown pekan** — semua pekan ada di satu daftar, **pekan terbaru di paling
  atas** (30 Des → 4 Nov); klik untuk pindah. Baris tab tidak lagi memakan tempat
  (satu baris saja, juga di HP).
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
