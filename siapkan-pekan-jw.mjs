#!/usr/bin/env node
/* =========================================================================
   siapkan-pekan-jw.mjs — menaruh pekan BARU hasil `ambil-jw.mjs` ke dalam
   `const PEKAN_JW` di index.html.

   Pakai:
     node ambil-jw.mjs                  # 1) ambil pekan baru dari jw.org → wol.json
     node siapkan-pekan-jw.mjs          # 2) pratinjau (belum mengubah berkas)
     node siapkan-pekan-jw.mjs --tulis  # 3) tulis ke index.html (+ build mandiri)

   Aturannya cuma satu dan itu penting: pekan baru harus **lebih muda** daripada
   pekan terakhir yang sudah ada di bundel, dan harus urut tanggal. Aplikasi
   menambah pekan secara *append* (ke ujung daftar), jadi pekan yang lebih tua
   akan diabaikan. Pekan lama (Nov–Des 2026) tidak perlu masuk bundel karena sudah
   datang dari wol.json / simpanan HP.
   ========================================================================= */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sini = path.dirname(fileURLToPath(import.meta.url));
const BERKAS = [path.join(sini, "index.html"), path.join(sini, "..", "Jadwal-Perhimpunan-Tengah-Pekan.html")];
const BERKAS_JSON = path.join(sini, "wol.json");
const TULIS = process.argv.includes("--tulis");

const BULAN = ["januari","februari","maret","april","mei","juni",
               "juli","agustus","september","oktober","november","desember"];

/* "6 Januari" → { bulan:0, hari:6, kunci:"1-6", urut:106 } */
function urai(tanggal){
  const m = String(tanggal || "").match(/(\d{1,2})\s+([A-Za-z]+)/);
  if (!m) return null;
  const b = BULAN.findIndex((x) => x.startsWith(m[2].slice(0, 3).toLowerCase()));
  if (b < 0) return null;
  return { bulan: b, hari: +m[1], kunci: (b + 1) + "-" + (+m[1]), urut: (b + 1) * 100 + (+m[1]) };
}

const html = await fs.readFile(BERKAS[0], "utf8");
const blok = html.match(/const PEKAN_JW = (\[[\s\S]*?\]);\n/);
if (!blok) throw new Error("blok `const PEKAN_JW = [...]` tidak ditemukan di index.html");
const lama = JSON.parse(blok[1]);
if (!lama.length) throw new Error("PEKAN_JW kosong — tidak ada patokan pekan terakhir");

let wol = { pekan: [] };
try { wol = JSON.parse(await fs.readFile(BERKAS_JSON, "utf8")); }
catch (e) { throw new Error("wol.json tidak terbaca — jalankan `node ambil-jw.mjs` dulu"); }

/* ---- pekan terakhir di bundel, dalam tanggal penuh (tahun ikut) ---------- */
const akhir = urai(lama[lama.length - 1].tanggal);
const semua = (wol.pekan || [])
  .filter((p) => p.baris && p.bagian && p.tanggal)
  .map((p) => ({ p, u: urai(p.tanggal) }))
  .filter((x) => x.u);

/* Tahun pekan terakhir dicari dari pekan yang sama di wol.json (di sana tahunnya
   tersimpan). Kalau tidak ketemu, dipakai tahun terbaru yang diketahui. */
const tahunDiketahui = semua.map((x) => +x.p.tahun).filter((t) => t > 1990);
const pasangan = semua.find((x) => x.u.kunci === akhir.kunci && +x.p.tahun > 1990);
const tahunAkhir = pasangan ? +pasangan.p.tahun
  : (tahunDiketahui.length ? Math.max(...tahunDiketahui) : new Date().getFullYear());
const absAkhir = tahunAkhir * 10000 + akhir.urut;

const kunciLama = new Set(lama.map((p) => (urai(p.tanggal) || {}).kunci).filter(Boolean));
const abs = (x) => (+x.p.tahun || tahunAkhir) * 10000 + x.u.urut;

const dobel      = semua.filter((x) => kunciLama.has(x.u.kunci));
const tanpaTahun = semua.filter((x) => !kunciLama.has(x.u.kunci) && !(+x.p.tahun > 1990));
const lebihTua   = semua.filter((x) => !kunciLama.has(x.u.kunci) && +x.p.tahun > 1990 && abs(x) <= absAkhir);
const baru       = semua
  .filter((x) => !kunciLama.has(x.u.kunci) && +x.p.tahun > 1990 && abs(x) > absAkhir)
  .sort((a, b) => abs(a) - abs(b));
const urutBaru = baru.map((x) => x.p);

console.log("pekan terakhir di bundel :", lama[lama.length - 1].tanggal, "(" + lama.length + " pekan)");
console.log("pekan baru dari wol.json:", urutBaru.length);
urutBaru.forEach((p) => console.log("   +", String(p.tanggal).padEnd(13), "·", p.alkitab || "", "·", (p.baris || []).length, "baris"));
if (dobel.length) console.log("sudah ada di bundel      :", dobel.length, "pekan (diabaikan)");
if (lebihTua.length) console.log("lebih tua dari bundel    :", lebihTua.map((x) => x.p.tanggal).join(", "), "— diabaikan");
if (tanpaTahun.length) console.log("tanpa tahun (pekan lama) :", tanpaTahun.length, "pekan — sudah dilayani wol.json, diabaikan");

if (!urutBaru.length){
  console.log("\nTidak ada pekan baru untuk ditambahkan. Berkas tidak diubah.");
  process.exit(0);
}

const hasil = lama.concat(urutBaru);
const teksBaru = "const PEKAN_JW = [" + JSON.stringify(hasil).slice(1, -1).replace(/\},\{"pekan"/g, "},\n{\"pekan\"") + "];\n";

console.log("hasil                    :", hasil.length, "pekan,", hasil[0].tanggal, "→", hasil[hasil.length - 1].tanggal);

if (!TULIS){
  console.log("\nBelum ada berkas yang diubah. Jalankan ulang dengan --tulis untuk menyimpan.");
  process.exit(0);
}

let n = 0;
for (const f of BERKAS){
  let isi;
  try { isi = await fs.readFile(f, "utf8"); } catch (e) { continue; }
  const pola = /const PEKAN_JW = \[[\s\S]*?\];\n/;
  if (!pola.test(isi)){ console.log("lewati (tidak ada PEKAN_JW):", f); continue; }
  await fs.writeFile(f, isi.replace(pola, teksBaru), "utf8");
  console.log("ditulis:", path.relative(sini, f), "→", hasil.length, "pekan");
  n++;
}
if (!n) throw new Error("tidak ada berkas yang diperbarui");

console.log("\nLangkah berikutnya: naikkan <meta name=\"versi\"> dan CACHE di sw.js,");
console.log("uji sintaks, buka aplikasinya, lalu unggah.");
