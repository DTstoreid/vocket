import { useEffect, useState } from 'react';
import { Cloud, Copy, Check, RefreshCw, X } from 'lucide-react';
import { getMeta, setMeta } from '../db/vocketDb';
import { getApiBaseUrl, getOrCreateSyncKey, syncWithCloudflareD1 } from '../services/syncService';
import type { Accent } from '../services/ttsService';

interface Props {
  open: boolean;
  onClose: () => void;
  accent: Accent;
  onAccentChange: (accent: Accent) => void;
  onReloadDataset: () => void;
  onSynced: () => void;
}

export function SyncSheet({
  open,
  onClose,
  accent,
  onAccentChange,
  onReloadDataset,
  onSynced
}: Props) {
  const [syncKey, setSyncKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [datasetUrl, setDatasetUrl] = useState('');
  const [lastSynced, setLastSynced] = useState('');
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [key, api, ds, last] = await Promise.all([
        getOrCreateSyncKey(),
        getApiBaseUrl(),
        getMeta('datasetBaseUrl', ''),
        getMeta('lastSyncedAt', '')
      ]);
      setSyncKey(key);
      setApiUrl(api);
      setDatasetUrl(ds);
      setLastSynced(last);
      setStatusMsg(null);
    })();
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    await Promise.all([
      setMeta('syncKey', syncKey.trim() || (await getOrCreateSyncKey())),
      setMeta('apiBaseUrl', apiUrl.trim()),
      setMeta('datasetBaseUrl', datasetUrl.trim())
    ]);
    setStatusMsg({ type: 'ok', text: 'Pengaturan disimpan.' });
  };

  const handleSync = async () => {
    await handleSave();
    setSyncing(true);
    setStatusMsg(null);
    try {
      const res = await syncWithCloudflareD1();
      setLastSynced(res.syncedAt);
      setStatusMsg({
        type: 'ok',
        text: `Sinkron selesai (${res.pulledAssigned} kata, ${res.pulledHistory} kuis).`
      });
      onSynced();
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Sinkronisasi gagal.'
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(syncKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end justify-center">
      <div className="w-full max-w-[430px] rounded-t-3xl bg-white p-5 safe-bottom shadow-xl max-h-[88dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-900">Sync & Setup</h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Aksen TTS
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100">
              {(['us', 'uk'] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => onAccentChange(a)}
                  className={`h-8 rounded-lg text-xs font-semibold uppercase transition ${
                    accent === a ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {a === 'us' ? 'US English' : 'UK English'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Sync Key (D1)
            </label>
            <div className="flex gap-2">
              <input
                value={syncKey}
                onChange={(e) => setSyncKey(e.target.value.toUpperCase())}
                className="flex-1 h-10 rounded-xl border border-slate-200 px-3 font-mono text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                placeholder="VCK-XXXX-XXXX"
              />
              <button
                onClick={handleCopyKey}
                className="h-10 w-10 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 flex items-center justify-center"
                aria-label="Copy"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Worker API URL
            </label>
            <input
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
              placeholder="https://vocket-api.user.workers.dev"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              GitHub Dataset URL (Opsional)
            </label>
            <input
              value={datasetUrl}
              onChange={(e) => setDatasetUrl(e.target.value)}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
              placeholder="Kosong = /dataset lokal"
            />
          </div>

          {lastSynced && (
            <p className="text-[11px] text-slate-400">
              Terakhir sinkron: {new Date(lastSynced).toLocaleString('id-ID')}
            </p>
          )}

          {statusMsg && (
            <div
              className={`rounded-xl px-3.5 py-2.5 text-xs ${
                statusMsg.type === 'ok'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {statusMsg.text}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleSave}
              className="h-11 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold active:scale-[0.98] transition"
            >
              Save
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="h-11 rounded-xl bg-slate-900 text-white text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              Sync D1
            </button>
          </div>

          <button
            onClick={() => {
              onClose();
              onReloadDataset();
            }}
            className="w-full h-10 rounded-xl bg-slate-100 text-slate-600 text-xs font-medium active:scale-[0.98] transition"
          >
            Muat Ulang Dataset ke IndexedDB
          </button>
        </div>
      </div>
    </div>
  );
}
