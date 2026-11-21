import { useEffect, useState } from 'react';
import { Check, Cloud, Copy, RefreshCw, X } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 bg-[#18221F]/45 backdrop-blur-sm flex items-end justify-center p-2.5">
      <div className="w-full max-w-[420px] rounded-[30px] bg-white border border-[#E6E4DD] p-5 safe-bottom shadow-float max-h-[88dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-teal-700" />
            <h2 className="text-sm font-bold text-[#18221F]">Sync & Setup</h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-[#F6F5F1] text-[#64706B] flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8681] mb-1.5">
              Aksen TTS
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-[#ECEAE3]">
              {(['us', 'uk'] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => onAccentChange(a)}
                  className={`h-8 rounded-full text-xs font-semibold uppercase transition ${
                    accent === a ? 'bg-white text-[#18221F] shadow-sm' : 'text-[#5C6863]'
                  }`}
                >
                  {a === 'us' ? 'US English' : 'UK English'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8681] mb-1.5">
              Sync Key (D1)
            </label>
            <div className="flex gap-2">
              <input
                value={syncKey}
                onChange={(e) => setSyncKey(e.target.value.toUpperCase())}
                className="flex-1 h-10 rounded-full border border-[#E6E4DD] bg-[#F6F5F1] px-4 font-mono text-xs text-[#18221F] focus:outline-none focus:border-teal-700"
                placeholder="VCK-XXXX-XXXX"
              />
              <button
                onClick={handleCopyKey}
                className="h-10 w-10 rounded-full border border-[#E6E4DD] bg-[#F6F5F1] text-[#4E5B56] flex items-center justify-center"
                aria-label="Copy"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8681] mb-1.5">
              Worker API URL
            </label>
            <input
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="w-full h-10 rounded-full border border-[#E6E4DD] bg-[#F6F5F1] px-4 text-xs text-[#18221F] focus:outline-none focus:border-teal-700"
              placeholder="https://vocket-api.user.workers.dev"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8681] mb-1.5">
              GitHub Dataset URL (Opsional)
            </label>
            <input
              value={datasetUrl}
              onChange={(e) => setDatasetUrl(e.target.value)}
              className="w-full h-10 rounded-full border border-[#E6E4DD] bg-[#F6F5F1] px-4 text-xs text-[#18221F] focus:outline-none focus:border-teal-700"
              placeholder="Kosong = /dataset lokal"
            />
          </div>

          {lastSynced && (
            <p className="text-[11px] text-[#7B8681]">
              Terakhir sinkron: {new Date(lastSynced).toLocaleString('id-ID')}
            </p>
          )}

          {statusMsg && (
            <div
              className={`rounded-2xl px-3.5 py-2.5 text-xs ${
                statusMsg.type === 'ok'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {statusMsg.text}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleSave}
              className="h-11 rounded-full border border-[#E6E4DD] bg-white text-[#18221F] text-xs font-bold active:scale-[0.98] transition"
            >
              Save
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="h-11 rounded-full bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-fab active:scale-[0.98] transition disabled:opacity-50"
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
            className="w-full h-10 rounded-full bg-[#F2F1EC] text-[#4E5B56] text-xs font-semibold active:scale-[0.98] transition"
          >
            Muat Ulang Dataset ke IndexedDB
          </button>

          <p className="pt-1 text-center font-mono text-[11px] text-[#8A948F]">
            vocket v{__APP_VERSION__}
          </p>
        </div>
      </div>
    </div>
  );
}
