import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { generationMemory, getMemorySettings, setMemorySettings, MEMORY_STATE_EVENT } from '../services/generationMemory'

export default function GenerationMemorySettingsSection() {
  const { language } = useI18n()
  const jp = language === 'jp' || language === 'ja'
  const [settings, setSettings] = useState(getMemorySettings)
  const [status, setStatus] = useState(generationMemory.status)
  const [busy, setBusy] = useState(false)
  const text = (ja, en) => jp ? ja : en
  useEffect(() => {
    const handler = event => setStatus(event.detail.status)
    window.addEventListener(MEMORY_STATE_EVENT, handler)
    return () => window.removeEventListener(MEMORY_STATE_EVENT, handler)
  }, [])
  const update = (key, value) => setSettings(setMemorySettings({ ...settings, [key]: value }))
  const labels = {
    idle: text('待機中', 'Idle'), releasing: text('解放要求中', 'Requesting cleanup'),
    released: text('解放要求済み・GPU使用量安定', 'Cleanup requested; GPU usage stable'),
    requested: text('解放要求済み・完了未確認', 'Cleanup requested; completion unverified'),
    sleeping: text('生成プロセス停止中', 'Generation process sleeping'), waking: text('再起動中', 'Resuming'),
    unavailable: text('解放APIに接続できません', 'Cleanup API unavailable'),
  }
  return <section className="rounded-xl border border-sf-border p-4 space-y-4">
    <h4 className="font-medium text-sf-text-primary">{text('生成メモリ管理', 'Generation memory management')}</h4>
    <p className="text-sm text-sf-text-secondary">{text('Generate・CANVAS・Director共通。モデル切替と待機時に、未使用モデルとキャッシュを解放します。再読込に時間がかかる場合があります。', 'Shared by Generate, CANVAS and Director. Release unused models and caches between models and while idle. Reloading models can take time.')}</p>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={settings.enabled} onChange={e => update('enabled', e.target.checked)} />{text('自動メモリ管理', 'Automatic memory management')}</label>
    {[
      ['idleSeconds', text('待機後の解放（秒）', 'Idle cleanup (seconds)'), 10, 3600],
      ['everyN', text('生成回数による解放（0＝無効）', 'Cleanup every N prompts (0 disables)'), 0, 1000],
      ['minFreeRamGB', text('システムRAMの空き目安（GB）', 'Free system RAM target (GB)'), 0, 64],
      ['minFreeVramGB', text('GPUメモリの空き目安（GB）', 'Free GPU memory target (GB)'), 0, 32],
      ['deepIdleMinutes', text('長時間待機でプロセス停止（分・0＝無効）', 'Stop process after idle (minutes; 0 disables)'), 0, 240],
    ].map(([key, label, min, max]) => <label key={key} className="flex items-center justify-between gap-4 text-sm">
      <span>{label}</span><input className="w-24 rounded bg-sf-bg-secondary border border-sf-border px-2 py-1" type="number" min={min} max={max} value={settings[key]} onChange={e => update(key, Number(e.target.value))} />
    </label>)}
    <p className="text-xs text-sf-text-secondary">{text('空き目安は保証値ではありません。実行中・待ち行列がある場合は解放を延期します。プロセス停止はLumeweftが起動したComfyUIだけが対象です。次回利用時に自動再起動します。設定は即時保存されます。', 'Targets are not guarantees. Cleanup is deferred while prompts are running or queued. Only ComfyUI launched by Lumeweft can sleep; it resumes on next use. Settings save immediately.')}</p>
    <div className="flex items-center gap-3 text-sm" role="status"><span>{labels[status] || status}</span>
      <button className="rounded border border-sf-border px-3 py-1" disabled={busy} onClick={async () => {
        setBusy(true)
        try { const released = await generationMemory.tick(true); if (!released) setStatus('deferred') } catch { setStatus('unavailable') } finally { setBusy(false) }
      }}>{text('今すぐ解放', 'Release now')}</button>
      {status === 'deferred' && <span>{text('実行待ち、または未接続', 'Deferred or disconnected')}</span>}
    </div>
  </section>
}
