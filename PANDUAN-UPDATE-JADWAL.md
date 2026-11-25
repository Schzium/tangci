# Panduan update jadwal — TangCi (Jadwal Perhimpunan Tengah Pekan)

> **Untuk agent AI yang menerima berkas ini.** Tugasmu: menambahkan jadwal pekan baru
> dari jw.org ke aplikasi, tanpa mengubah apa pun yang lain. Ikuti langkahnya persis.
> Semua perintah dijalankan di dalam folder paket (`app/`), Node 20+.

---

## 1. Apa yang dikerjakan

Aplikasi ini satu berkas: `app/index.html` (HTML + CSS + JS, tanpa build). Jadwal
disimpan **di dalam berkas** sebagai

```js
const PEKAN_JW = [{ pekan, tanggal, label, alkitab, bagian, baris, urls }, …];
```

Daftar itu dimuat otomatis saat aplikasi dibuka (`muatWolOtomatis()`), lalu ditambah
`wol.json` dan simpanan di HP pengguna. Tidak ada server, tidak ada API.

**Tugas barumu:** menambah pekan edisi baru (mis. Mei–Juni 2027) ke `PEKAN_JW`.
Rentang sekarang: **4 Nov 2026 → 28 Apr 2027** (9 pekan lama dari wol.json +
16 pekan dari jw.org). Kalau pengguna bilang "perbarui jadwal", artinya: cari edisi
yang **lebih baru dari 28 Apr 2027** dan tambahkan.

---

## 2. Aturan yang TIDAK boleh dilanggar

1. **Slip S-89 jangan disentuh** (tampilan, huruf, ukuran, isi). Sudah disetujui pengguna.
2. **Kotak isian Nama/Asisten/Tanggal/Bagian no. jangan diubah.**
3. **Checklist ruang jangan dipindah**; hanya kotak centang kecilnya yang berlatar biru.
4. Label isian tetap **rata kiri**; hanya titik dua `:` yang didekatkan ke kotak.
5. **Satu perubahan per permintaan** — jangan menambah "perbaikan" lain yang tidak diminta.
6. Tombol **Sync sudah dihapus** (versi 2026-11-23.26) — jangan dikembalikan kecuali diminta.
7. Jangan menyentuh data Firebase (daftar penyiar, nama terpilih, hadirin).

---

## 3. Peta berkas

| Berkas | Isi |
| --- | --- |
| `app/index.html` | aplikasi (deliverable utama), berisi `const PEKAN_JW` |
| `app/wol.json` | pekan + isi ayat + lirik (dimuat aplikasi saat dibuka) |
| `app/ambil-jw.mjs` | pengambil jadwal dari jw.org → `wol.json` |
| `app/siapkan-pekan-jw.mjs` | menyalin pekan baru dari `wol.json` ke `const PEKAN_JW` |
| `app/sw.js` | service worker, ada `const CACHE = 'jhtp-vNN'` |
| `app/README.md` | dokumentasi untuk pengguna (bahasa awam) |
| `Jadwal-Perhimpunan-Tengah-Pekan.html` | build mandiri (satu berkas, untuk uji `file://`), **ikut diperbarui** |

---

## 4. Langkah update (5 langkah)

```bash
cd app
npm install                      # sekali saja: jsdom

# 1) ambil pekan dari jw.org (2 edisi terbaru = bawaan)
node ambil-jw.mjs
#    edisi tertentu : node ambil-jw.mjs mwb-mei-juni-2027
#    semua edisi    : node ambil-jw.mjs --semua
#    tanpa teks rujukan (berkas kecil): node ambil-jw.mjs --tanpa-ref

# 2) pratinjau: pekan mana yang akan masuk
node siapkan-pekan-jw.mjs

# 3) tulis ke index.html + build mandiri
node siapkan-pekan-jw.mjs --tulis
```

4. **Naikkan versi** di `app/index.html`:
   `<meta name="versi" content="2026-11-23.26">` → `.27` (dan seterusnya).
   Lalu `app/sw.js`: `jhtp-v30` → `jhtp-v31`.
   Angka versi inilah yang membuat semua HP menyegarkan diri sendiri.

5. **Uji**, lalu serahkan hasilnya (lihat bagian 7).

---

## 5. Cara kerja pengambil jadwal (kalau perlu diperbaiki)

jw.org menerbitkan jadwal **lebih dulu** daripada wol.jw.org. Halaman yang dipakai:

```
https://www.jw.org/id/perpustakaan/jw-lembar-pelajaran/                     → daftar edisi (mwb-<bulan>-<bulan>-<tahun>)
https://www.jw.org/id/perpustakaan/jw-lembar-pelajaran/<edisi>/              → daftar pekan
…/Jadwal-Perhimpunan-Pelayanan-dan-Kehidupan-Kristen-untuk-<tgl>-<bulan>-<tahun>/
```

Dari tiap halaman pekan diambil:

- `h1` → rentang tanggal pekan (mis. `4-10 Januari`), `tanggal` = hari perhimpunan
  (Rabu dalam rentang itu), `label` = `6 Jan`;
- `h2` berisi tautan → bacaan Alkitab (`Yehezkiel 11-12`);
- `h3` "1." … "N." dan "Bagian Penutup" → `bagian` (judul, `m` = menit) + `baris`;
- tiga `<a class="pub-sjj">Lagu NN</a>` → nyanyian pembuka, setelah **KEHIDUPAN
  KRISTEN**, dan penutup. `ambil-jw.mjs` menyusunnya menjadi `baris` (jenis `lagu`,
  `seksi`, `bagian`) — inilah yang membuat jam 19.00/19.05/… tampil benar.
- `div.gen-field` → teks paragraf; tiap rujukan mendapat id `rN` + entri `urls`.

**Penting:** `baris` **tidak** diisi oleh parser lama — kalau kamu memakai parser lain,
kamu harus menyusun `baris` sendiri (lagu → seksi → bagian dengan menit → lagu → …),
kalau tidak nomor nyanyian dan jamnya kosong di layar.

---

## 6. Jebakan yang sudah pernah menggagalkan (jangan diulang)

- **UA peramban ditolak WAF jw.org** (HTTP `202`, badan kosong). Pakai UA sederhana:
  `User-Agent: Mozilla/5.0`. Tanpa header pun lolos; UA gaya Chrome lengkap gagal.
- **Peramban tidak bisa mengambil jw.org (CORS).** Semua perantara gratis gagal
  (jina/ditolak, allorigins 522, corsproxy 401, cors.lol 429, translate.goog tanpa
  ACAO). **Jangan coba proxy lagi.** Karena itu pengambilan dilakukan di komputer.
- **`b.jw-cdn.org` hanya menyediakan PDF/JWPUB**, tidak bisa diparse di browser.
- **Penambahan pekan bersifat append.** Pekan baru harus **lebih muda** dari pekan
  terakhir dan **urut tanggal**; kalau tidak, aplikasi mengabaikannya. `sort()` bawaan
  JS untuk tanggal **leksikografis** — urutkan lewat indeks bulan, bukan `sort()` string.
- `--tanpa-ref` sengaja membuang id rujukan pekan baru supaya tidak menunjuk isi
  rujukan lama (id `rN` dipakai ulang tiap edisi; tanpa `--tanpa-ref` id otomatis
  digeser supaya tidak bertabrakan).
- Setelah mengubah `index.html`, **selalu cek sintaks**:
  ```bash
  node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');
  [...h.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].forEach((m,i)=>{
  try{new Function(m[1])}catch(e){console.log('GAGAL skrip',i,e.message)}})"
  ```

---

## 7. Verifikasi sebelum menyerahkan hasil

```bash
# sintaks (harus tidak ada "GAGAL")
node -e "…"                       # lihat perintah di atas
node --check ambil-jw.mjs; node --check siapkan-pekan-jw.mjs

# jumlah pekan & urutannya
node -e "const s=require('fs').readFileSync('index.html','utf8');
const b=JSON.parse(s.match(/const PEKAN_JW = (\[[\s\S]*?\]);\n/)[1]);
console.log(b.length, b[0].tanggal,'→',b[b.length-1].tanggal);
console.log(b.slice(-3).map(p=>p.tanggal+' · '+p.alkitab+' · '+p.baris.length+' baris').join('\n'))"
```

Yang benar: jumlah pekan bertambah **tepat sebanyak pekan baru**, tanggal pertama dan
terakhir sesuai, tiap pekan punya `baris` ≥ 16 (lagu + 3 seksi + bagian + penutup).

Kalau bisa menjalankan Playwright, buka `file:///…/Jadwal-Perhimpunan-Tengah-Pekan.html`,
pastikan `JADWAL.length` benar, dropdown pekan Z→A (terbaru di atas), dan `pageerror` kosong.

**Serahkan:** `app/index.html` (atau `jhtp-app.zip`), sebutkan versi baru, pekan yang
masuk, dan pengingat "unggah seperti biasa, lalu buka ulang aplikasi".

---

## 8. Acuan hasil yang sudah benar (pekan 6 Januari 2027)

```
Nyanyian 83 · 19.00
Bagian Pembuka (1)
HARTA DALAM FIRMAN ALLAH
  1. ”Mungkin Mereka Akan Memperhatikan” (10)
  2. Permata Rohani (10)
  3. Pembacaan Alkitab (4)
BERSEMANGATLAH DALAM PELAYANAN
  4. Melakukan Kunjungan Kembali (3)
  5. Melakukan Kunjungan Kembali (4)
  6. Apa yang Akan Saudara Katakan? (5)
KEHIDUPAN KRISTEN
Nyanyian 2
  7. Kebutuhan Setempat (15)
  8. Pelajaran Alkitab Sidang (30)
Bagian Penutup (3)
Nyanyian 164 · 20.37
```

Bacaan: `Yehezkiel 11-12`. Kalau hasilmu berbeda jauh dari ini, jangan lanjut.

---

## 9. Kalau pengguna minta tombol Sync dikembalikan

Kodenya masih ada di `index.html` (`function syncWol()`, `pesanKotak()`, `JINA`,
`kodeBerikut()`); yang dihapus hanya tombol `<button id="btnSync">` di
`perbaruiTombol()` dan satu baris penanganan klik. Tapi ingat: tombol itu **tidak bisa**
mengambil jadwal dari jw.org (CORS) — hanya bisa membaca `wol.json`.
