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
