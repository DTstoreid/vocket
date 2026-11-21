# vocket

PWA mobile-first untuk monitor dan tracking belajar kosakata Inggris - Indonesia dengan TTS pronunciation, Speech Recognition Lab, Audio Flashcard, 5-tipe Quiz (termasuk Cloze Test, Remedial, dan Cumulative Review), penyimpanan lokal offline **IndexedDB (Dexie)**, serta sinkronisasi cloud opsional ke **Cloudflare Workers + D1**.

## Arsitektur

- **Frontend**: Vite + React + TypeScript + Tailwind CSS + `vite-plugin-pwa`
- **Local DB**: IndexedDB via `dexie` (menyimpan 3.000 kata, sinonim, word family, progress harian, antrean prioritas, skor pelafalan, dan riwayat kuis)
- **Dataset**: `public/dataset/` (`index.json`, `words_L01.json`..`words_L20.json`, `game_scramble.json`, `CREDITS.md`)
- **Backend Sync**: Cloudflare Workers + Cloudflare D1 (`worker/`)

## Menjalankan Lokal

```bash
npm install
npm run dev
```

Build produksi:

```bash
npm run build
npm run preview
```

## Deploy ke GitHub + Cloudflare Pages

1. Push seluruh isi folder `vocket` ke repositori GitHub.
2. Di Cloudflare Dashboard -> **Workers & Pages** -> **Create** -> **Pages** -> **Connect to Git**.
3. Pilih repositori GitHub tersebut:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Tambahkan Environment Variable (opsional):
   - `VITE_API_BASE_URL`: URL Worker setelah deploy (contoh: `https://vocket-api.<subdomain>.workers.dev`)
   - `VITE_DATASET_BASE_URL`: kosongkan untuk memuat dari `/dataset` di Pages, atau isi URL raw GitHub `https://raw.githubusercontent.com/<user>/<repo>/main/public/dataset`

## Deploy Backend Cloudflare Workers + D1

```bash
cd worker
npm install
npx wrangler login
npx wrangler d1 create vocket-db
```

Salin `database_id` yang muncul ke `worker/wrangler.toml`, lalu jalankan migrasi dan deploy:

```bash
npm run db:migrate:remote
npm run deploy
```

Setelah deploy, masukkan URL Worker tersebut di tombol **Sync** pada aplikasi Vocket (atau via `VITE_API_BASE_URL` di Cloudflare Pages).
