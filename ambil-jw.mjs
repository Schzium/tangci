/*  ambil-jw.mjs — ambil jadwal "Pelayanan dan Kehidupan Kristen" dari jw.org
 *  (jw.org menerbitkan lebih awal daripada wol.jw.org) lalu tulis wol.json.
 *
 *  Pakai:  node ambil-jw.mjs [edisi ...] [--tanpa-ref]
 *  contoh: node ambil-jw.mjs                       (semua edisi terbaru)
 *          node ambil-jw.mjs mwb-januari-februari-2027
 *          node ambil-jw.mjs mwb-maret-april-2027 --tanpa-ref
 *
 *  Halaman sumber: https://www.jw.org/id/perpustakaan/jw-lembar-pelajaran/
 *  Hasilnya digabung dengan wol.json yang sudah ada (pekan lama tidak dibuang).
 */
import { JSDOM } from "jsdom";
import fs from "node:fs/promises";

const DASAR = "https://www.jw.org";
const INDEKS = "/id/perpustakaan/jw-lembar-pelajaran/";
const DASAR_WOL = "https://wol.jw.org";
const JALUR = "/id/wol";
/* jw.org memakai pelindung yang menolak UA mirip peramban tanpa cookie,
   jadi cukup UA sederhana — ini yang lolos. */
const UA = "Mozilla/5.0";

const arg = process.argv.slice(2);
const tanpaRef = arg.includes("--tanpa-ref");
const edisiDiminta = arg.filter((a) => a.startsWith("mwb-"));
const berkas = new URL("./wol.json", import.meta.url).pathname;

const teks = (el) => (el ? el.textContent : "");
const bersih = (t) => String(t || "").replace(/\u200b/g, "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

const cache = new Map();
async function ambil(url, ulang = 3) {
  if (cache.has(url)) return cache.get(url);
  for (let i = 0; i < ulang; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA }, redirect: "manual" });
      const out = { status: r.status, html: await r.text(), location: r.headers.get("location") || "" };
      if (r.ok || r.status === 404 || (r.status >= 300 && r.status < 400)) {
        cache.set(url, out);
        await new Promise((z) => setTimeout(z, 120));   // sopan ke server
        return out;
      }
    } catch (e) { /* coba lagi */ }
    await new Promise((r) => setTimeout(r, 900 * (i + 1)));
  }
  throw new Error("gagal ambil " + url);
}
function kePenuh(u) { return u.startsWith("http") ? u : DASAR + u; }

/* halaman /bc/ dan /pc/ hanya berisi meta-refresh ke halaman sebenarnya */
function tujuanRedirect(html) {
  const m = html.match(/url='([^']+)'/i) || html.match(/url=([^"'>\s]+)/i);
  if (!m) return null;
  const u = m[1];
  return u.startsWith("http") ? u : DASAR + u;
}

/* ---------- parser halaman pekan ---------- */
const BERSIH_A = (t) => String(t || "").replace(/\u200b/g, "").replace(/\u00a0/g, " ").replace(/\s+/g, " ");
function rapikan(out) {
  if (!out.length) return out;
  const p = out[0], a = out[out.length - 1];
  if (p.t !== undefined) p.t = p.t.replace(/^\s+/, ""); else p.l = p.l.replace(/^\s+/, "");
  if (a.t !== undefined) a.t = a.t.replace(/\s+$/, ""); else a.l = a.l.replace(/\s+$/, "");
  return out.filter((s) => (s.t === undefined || s.t !== "") && (s.l === undefined || s.l !== ""));
}
function segmenDari(node, urls, counter) {
  const out = [];
  const push = (t) => {
    const s = t.replace(/\u200b/g, "");
    if (!s) return;
    const akhir = out[out.length - 1];
    if (akhir && akhir.t !== undefined) akhir.t += s;
    else out.push({ t: s });
  };
  const jalan = (el) => {
    el.childNodes.forEach((n) => {
      if (n.nodeType === 3) return push(n.nodeValue);
      if (n.nodeType !== 1) return;
      const tag = n.tagName.toLowerCase();
      if (tag === "a") {
        const href = n.getAttribute("href") || "";
        const t = BERSIH_A(n.textContent);
        if (!href || !t) return jalan(n);
        const id = "r" + counter.n++;
        urls[id] = { url: href.startsWith("http") ? href : DASAR + href, teks: t };
        out.push({ l: t, r: id });
        return;
      }
      if (tag === "textarea" || tag === "input" || tag === "button") return;
      jalan(n);
    });
  };
  jalan(node);
  return rapikan(out);
}
function judulKasus(t) {
  return String(t || "").toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Dan|Di|Ke|Dari|Yang|Untuk|Atas|Pada)\b/g, (m) => m.toLowerCase());
}
const BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

function parsePekan(html, urls, counter) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const art = doc.querySelector("#article") || doc.body;

  const h1 = art.querySelector("h1");
  const rentang = bersih(teks(h1)).toUpperCase();              // "2-8 NOVEMBER" / "30 NOVEMBER-6 DESEMBER"
  let tanggal = "", label = "";
  const R = rentang.replace(/[\u2013\u2014]/g, "-");
  const namaBulan = (x) => BULAN.findIndex((b) => b.toUpperCase().startsWith(String(x).slice(0, 3).toUpperCase()));
  let mulai = 0, bulanAwal = -1, tahunAwal = 0;
  let m = R.match(/^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?\s*-\s*(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?$/);
  if (m) {
    mulai = +m[1]; bulanAwal = namaBulan(m[2]); tahunAwal = +(m[3] || m[6] || 0);
  } else {
    m = R.match(/^(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?$/);
    if (m) { mulai = +m[1]; bulanAwal = namaBulan(m[3]); tahunAwal = +(m[4] || 0); }
  }
  if (bulanAwal >= 0) {
    if (!tahunAwal) {
      const sekarang = new Date();
      tahunAwal = sekarang.getUTCFullYear();
      if (new Date(Date.UTC(tahunAwal, bulanAwal, mulai)) < new Date(sekarang.getTime() - 200 * 864e5)) tahunAwal += 1;
    }
    const hari = new Date(Date.UTC(tahunAwal, bulanAwal, mulai + 2));   // Rabu = hari ke-3 rentang
    tanggal = hari.getUTCDate() + " " + BULAN[hari.getUTCMonth()];
    label = hari.getUTCDate() + " " + BULAN[hari.getUTCMonth()].slice(0, 3);
  }
  const pekan = judulKasus(rentang);

  let alkitab = "";
  const h2s = Array.from(art.querySelectorAll("h2"));
  /* WOL menandai judul pembacaan dengan <a class="b">; jw.org hanya <a> biasa,
     jadi dipakai cadangan: h2 berisi tautan yang bukan judul bagian tetap. */
  const h2b = h2s.find((h) => h.querySelector("a.b"))
    || h2s.find((h) => h.querySelector("a") && !/^(HARTA|BERSEMANGATLAH|KEHIDUPAN)/i.test(bersih(teks(h))));
  if (h2b) alkitab = judulKasus(bersih(teks(h2b.querySelector("a") || h2b)));

  const bagian = {};
  const baris = [];
  const semua = Array.from(art.querySelectorAll("h1,h2,h3,p,li,div.gen-field"));
  const sudah = new Set();
  let item = null, nomor = 0;

  semua.forEach((el) => {
    if (sudah.has(el)) return;
    const tag = el.tagName.toLowerCase();
    if (tag === "h1") return;
    if (tag === "h2") {
      const t = bersih(teks(el)).toUpperCase();
      if (/^(HARTA DALAM FIRMAN ALLAH|BERSEMANGATLAH DALAM PELAYANAN|KEHIDUPAN KRISTEN)/.test(t)) {
        item = null;
        baris.push({ jenis: "seksi", judul: t });
      }
      return;
    }
    if (tag === "h3") {
      const isi = bersih(teks(el));
      if (/Nyanyian\s+\d+/i.test(isi) || /^Bagian (Pembuka|Penutup)/i.test(isi)) {
        const mNy = isi.match(/Nyanyian\s+(\d+)/i);
        const menit = (isi.match(/\((\d+)\s*men\.\)/) || [])[1] || "";
        if (mNy) baris.push({ jenis: "lagu", teks: "Nyanyian " + mNy[1] });
        if (/Bagian Pembuka/i.test(isi)) baris.push({ jenis: "lagu", teks: "Bagian Pembuka", menit: menit || "1" });
        if (/Bagian Penutup/i.test(isi)) baris.push({ jenis: "lagu", teks: "Bagian Penutup", menit: menit || "3" });
        item = null;
        return;
      }
      const mi = isi.match(/^(\d{1,2})\.\s*(.+)$/);
      if (mi) {
        nomor = parseInt(mi[1], 10);
        item = { jd: bersih(mi[2]), m: "", isi: [] };
        bagian[String(nomor)] = item;
        baris.push({ jenis: "bagian", nomor: nomor + ".", teks: item.jd, menit: "" });
      }
      return;
    }
    if (!item) return;
    if (tag === "div" && el.classList.contains("gen-field")) { item.isi.push({ t: "jwb" }); return; }
    if (tag === "li") {
      const p = el.querySelector("p");
      if (p) { sudah.add(p); item.isi.push({ t: "li", s: segmenDari(p, urls, counter) }); }
      el.querySelectorAll("div.gen-field").forEach((g) => sudah.add(g));
      item.isi.push({ t: "jwb" });
      return;
    }
    if (tag === "p") {
      if (el.closest("li") || el.closest(".gen-field")) return;
      const t = bersih(teks(el));
      if (/^\(\d+\s*men\.\)$/.test(t)) {
        item.m = (t.match(/\d+/) || [""])[0];
        baris[baris.length - 1].menit = item.m;
        return;
      }
      const mm = t.match(/^\((\d+)\s*men\.\)\s*(.*)$/);
      if (mm && !item.m) {
        item.m = mm[1];
        baris[baris.length - 1].menit = mm[1];
        let sisa = segmenDari(el, urls, counter);
        if (sisa.length && sisa[0].t !== undefined) sisa[0].t = sisa[0].t.replace(/^\(\d+\s*men\.\)\s*/, "");
        sisa = sisa.filter((x) => (x.t === undefined || x.t !== ""));
        if (sisa.length) item.isi.push({ t: "p", s: rapikan(sisa) });
        return;
      }
      item.isi.push({ t: "p", s: segmenDari(el, urls, counter) });
    }
  });

  return { pekan, tanggal, label, alkitab, bagian, baris, tahun: tahunAwal };
}

/* ---------- isi referensi (ayat / publikasi) ---------- */
async function isiReferensi(url, teksTautan) {
  let target = url;
  const r0 = await ambil(url);
  if (r0.location) target = kePenuh(r0.location);
  const [dasar, fragmen = ""] = target.split("#");
  const r1 = await ambil(dasar);
  if (!r1.html) throw new Error("kosong " + dasar);
  const doc = new JSDOM(r1.html).window.document;
  const art = doc.querySelector("#article") || doc.body;

  if (/\/wol\/b\//.test(dasar) && !/\/wol\/bc\//.test(dasar)) {
    const judulKitab = bersih(teks(art.querySelector("h1"))) || "";
    const ayat = new Map();
    art.querySelectorAll("span.v").forEach((sp) => {
      const mv = (sp.id || "").match(/^v(\d+)-(\d+)-(\d+)-(\d+)$/);
      if (!mv) return;
      const klon = sp.cloneNode(true);
      klon.querySelectorAll("a.vl, a.vx, a.vp, a.fn, a.b, a.cl, sup, span.fn").forEach((a) => a.remove());
      const isiAyat = bersih(teks(klon));
      if (!isiAyat) return;
      const k = `${+mv[1]}-${+mv[2]}-${+mv[3]}`;
      ayat.set(k, (ayat.get(k) || "") + (ayat.get(k) ? " " : "") + isiAyat);
    });
    let daftar = Array.from(ayat.entries()).map(([k, v]) => {
      const [b, c, vv] = k.split("-").map(Number);
      return { v: vv, t: v, urut: b * 1e6 + c * 1e3 + vv };
    });
    const mf = fragmen.match(/v=([\d:-]+)/);
    if (mf) {
      const ke = (x) => { const p = x.split(":").map(Number); return p[0] * 1e6 + p[1] * 1e3 + (p[2] || 0); };
      const bagian = mf[1].split("-");
      const a = ke(bagian[0]), b = bagian[1] ? ke(bagian[1]) : a;
      const disaring = daftar.filter((d) => d.urut >= a && d.urut <= b);
      if (disaring.length) daftar = disaring;
    }
    daftar.sort((x, y) => x.urut - y.urut);
    return { j: "a", jd: judulKitab, sub: teksTautan.replace(/[,;]$/, "").trim(), url: dasar, isi: daftar.map((d) => [d.v, d.t]) };
  }

  const judul = bersih(teks(art.querySelector("h1") || doc.querySelector("title")))
    .replace(/\s*[—|-]\s*Saksi-Saksi Yehuwa.*/i, "");
  const mh = fragmen.match(/h=(\d+):\d+-(\d+):\d+/);
  const dari = mh ? +mh[1] : 0, sampai = mh ? +mh[2] : 0;
  const paragraf = [];
  art.querySelectorAll("[data-pid]").forEach((el) => {
    if (!el.matches("p, h1, h2, h3")) return;
    const pid = +(el.getAttribute("data-pid") || 0);
    if (mh && (pid < dari || pid > sampai)) return;
    const t = bersih(teks(el));
    if (!t) return;
    paragraf.push([/^h[1-3]$/i.test(el.tagName) ? "h" : "p", t]);
  });
  if (!paragraf.length) art.querySelectorAll("p").forEach((el) => {
    const t = bersih(teks(el));
    if (t) paragraf.push(["p", t]);
  });
  return { j: "p", jd: judul.slice(0, 90), sub: teksTautan, url: dasar, isi: paragraf.slice(0, 60) };
}

/* ---------- lirik nyanyian ---------- */
async function ambilLagu(no) {
  const id = "11020168" + String(no).padStart(2, "0");
  const { html } = await ambil(`${DASAR_WOL}${JALUR}/d/r25/lp-in/${id}`);
  const doc = new JSDOM(html).window.document;
  const art = doc.querySelector("#article") || doc.body;
  const h1 = art.querySelector("h1");
  const judul = bersih(teks(h1)).replace(/^\d+\.\s*/, "");
  const ay = bersih(teks(art.querySelector(".themeScrp"))).replace(/[()]/g, "");
  const bait = [];
  art.querySelectorAll("#article ol, #article .chorus, #article div[data-pid]").forEach(() => {});
  const blok = Array.from(art.querySelectorAll("ol"));
  if (blok.length) {
    blok[0].querySelectorAll(":scope > li").forEach((li) => {
      const baris = [];
      li.querySelectorAll("p").forEach((p) => {
        const k = (p.className.match(/\b(sl|sz|sp|se)\b/) || [])[1] || "sz";
        const t = bersih(teks(p));
        if (t) baris.push([k, t]);
      });
      if (baris.length) bait.push(baris);
    });
  }
  return { jd: judul, ay, isi: bait };
}

/* ---------- pekan di jw.org: nomor lagu ditulis "Lagu NN" ----------
   Parser mengenali "Nyanyian NN" + "Bagian Pembuka/Penutup", jadi baris lagu
   dirapikan di sini supaya bentuknya sama dengan hasil sync wol.jw.org. */
function rapikanLagu(baris, html){
  const nomor = Array.from(String(html).matchAll(/Lagu\s+(\d+)/g)).map((m) => +m[1]);
  if (!nomor.length) return baris;
  const buka = nomor[0], tutup = nomor[nomor.length - 1];
  const tengah = nomor.length >= 3 ? nomor[1] : null;
  const hasil = [{ jenis: "lagu", teks: "Nyanyian " + buka },
                 { jenis: "lagu", teks: "Bagian Pembuka", menit: "1" }].concat(baris);
  if (tengah){
    const i = hasil.findIndex((b) => b.jenis === "seksi" && /KEHIDUPAN KRISTEN/.test(b.judul || ""));
    if (i >= 0) hasil.splice(i + 1, 0, { jenis: "lagu", teks: "Nyanyian " + tengah });
  }
  hasil.push({ jenis: "lagu", teks: "Nyanyian " + tutup });
  return hasil;
}

/* ---------- utama ---------- */
const indeks = await ambil(DASAR + INDEKS);
let edisi = Array.from(new Set(Array.from(indeks.html.matchAll(
  /href="(\/id\/perpustakaan\/jw-lembar-pelajaran\/(mwb-[a-z-]+-\d{4})\/)"/g
)).map((m) => m[2])));
if (edisiDiminta.length) edisi = edisi.filter((e) => edisiDiminta.includes(e));
else if (!arg.includes("--semua")) edisi = edisi.slice(0, 2);         /* dua edisi terbaru */
console.log("edisi:", edisi.join(", ") || "(tidak ada)");

const urls = {};
const counter = { n: 1 };
const pekan = [];
const sudah = new Set();
for (const ed of edisi){
  const halEdisi = await ambil(`${DASAR}${INDEKS}${ed}/`);
  const minggu = Array.from(new Set(Array.from(halEdisi.html.matchAll(
    new RegExp('href="(/id/perpustakaan/jw-lembar-pelajaran/' + ed + '/Jadwal-Perhimpunan[^"]+)"', "g")
  )).map((m) => m[1])));
  console.log(`\n${ed}: ${minggu.length} pekan`);
  for (const jalur of minggu){
    const { html } = await ambil(DASAR + jalur);
    let p;
    try { p = parsePekan(html, urls, counter); } catch (e) { console.warn("  gagal baca", jalur, e.message); continue; }
    if (!p || !p.pekan) continue;
    if (sudah.has(p.tanggal)){ console.log(`  lewat (sudah ada): ${p.pekan}`); continue; }
    sudah.add(p.tanggal);
    p.baris = rapikanLagu(p.baris || [], html);
    console.log(`  ${p.label} — ${p.pekan} — ${p.alkitab}`);
    pekan.push(p);
  }
}

/* id referensi dari tiap edisi mulai dari r1 lagi — geser supaya tidak
   bertabrakan dengan id yang sudah ada di wol.json */
let lamaAwal = { pekan: [], ref: {}, lagu: {} };
try { lamaAwal = JSON.parse(await fs.readFile(berkas, "utf8")); } catch (e) { /* belum ada */ }
const geser = Math.max(0, ...Object.keys(lamaAwal.ref || {})
  .map((k) => { const m = k.match(/^r(\d+)$/); return m ? +m[1] : 0; }));
if (tanpaRef && !geser){
  /* tanpa teks rujukan: buang id r dari pekan baru supaya tidak menunjuk
     ke rujukan lama yang isinya lain */
  pekan.forEach((p) => Object.values(p.bagian || {}).forEach((b) => (b.isi || []).forEach((it) => {
    (it.s || []).forEach((sg) => { if (sg) delete sg.r; });
  })));
  Object.keys(urls).forEach((k) => delete urls[k]);
}
if (geser){
  const peta = new Map();
  Object.keys(urls).forEach((k) => {
    const m = k.match(/^r(\d+)$/);
    if (m) peta.set(k, "r" + (+m[1] + geser));
  });
  const pindah = {};
  Object.keys(urls).forEach((k) => { pindah[peta.get(k) || k] = urls[k]; });
  Object.keys(urls).forEach((k) => delete urls[k]);
  Object.assign(urls, pindah);
  pekan.forEach((p) => Object.values(p.bagian || {}).forEach((b) => (b.isi || []).forEach((it) => {
    (it.s || []).forEach((sg) => { if (sg && sg.r && peta.has(sg.r)) sg.r = peta.get(sg.r); });
  })));
  console.log(`id referensi digeser +${geser}`);
}

/* isi semua referensi (bisa dilewati dengan --tanpa-ref) */
const ref = {};
if (!tanpaRef){
  const daftarUrl = Object.entries(urls);
  let n = 0;
  for (const [id, info] of daftarUrl){
    try { ref[id] = await isiReferensi(info.url, info.teks); }
    catch (e) {
      ref[id] = { j: "v", jd: "Buka di jw.org", sub: info.teks, url: info.url, isi: [] };
    }
    if (++n % 20 === 0) console.log(`  referensi ${n}/${daftarUrl.length}`);
  }
}

/* lirik semua nyanyian yang dipakai */
const nomorLagu = new Set();
pekan.forEach((p) => (p.baris || []).forEach((b) => {
  const m = (b.teks || "").match(/(?:Nyanyian|Lagu)\s+(\d+)/i);
  if (m) nomorLagu.add(m[1]);
}));
const lagu = {};
for (const no of Array.from(nomorLagu).sort((a, b) => a - b)){
  try { lagu[no] = await ambilLagu(no); } catch (e) { console.warn("  gagal lagu", no); }
}

/* gabung dengan wol.json yang sudah ada */
const lama = lamaAwal;
const petaLama = new Map((lama.pekan || []).map((p) => [p.pekan || p.label, p]));
pekan.forEach((p) => petaLama.set(p.pekan || p.label, p));
const semua = Array.from(petaLama.values()).sort((a, b) => {
  const t = (x) => { const m = String(x.tanggal || "").match(/(\d+)\s+(\w+)/); return m ? (BULAN.indexOf(m[2]) + 1) * 100 + +m[1] : 0; };
  return t(a) - t(b);
});

const hasil = {
  dibuat: new Date().toISOString(),
  kode: lama.kode || "",
  edisi: lama.edisi || "",
  sumber: "jw.org",
  pekan: semua,
  ref: Object.assign({}, lama.ref || {}, ref),
  lagu: Object.assign({}, lama.lagu || {}, lagu)
};
await fs.writeFile(berkas, JSON.stringify(hasil));
console.log(`\nselesai: ${pekan.length} pekan baru, ${semua.length} pekan di berkas, `
  + `${Object.keys(ref).length} referensi baru, ${Object.keys(lagu).length} nyanyian → ${berkas}`);
