import { useEffect, useMemo, useRef, useState } from 'react'
import { AudioLines, FolderOpen, Loader2, Mic2, RefreshCw, Upload, Volume2 } from 'lucide-react'
import { useI18n } from '../../i18n/I18nContext'

const EMOJI_CUES = Object.freeze([
  ['🫶', '優しく'], ['😊', '楽しげに・嬉しそうに'], ['😌', '安堵・満足げに'], ['😎', '得意げに・自信ありげに'],
  ['😏', 'からかうように・甘えるように'], ['🥺', '声を震わせて・自信なさげに'], ['😭', '泣き声・悲しみ'], ['😠', '怒り・不満げに'],
  ['😲', '驚き・感嘆'], ['😱', '悲鳴・叫び'], ['😟', '心配そうに'], ['😰', '慌てて・緊張して'],
  ['🫣', '恥ずかしそうに'], ['🙄', '呆れたように'], ['😪', '眠そうに・気だるげに'], ['🥴', '酔っ払って'],
  ['💪', '力強く'], ['💥', '勢いよく'], ['⏩', '早口で'], ['🐢', 'ゆっくりと'],
  ['📖', 'ナレーション・独白'], ['📞', '電話・スピーカー越し'], ['📢', 'エコー・リバーブ'], ['🎵', '鼻歌'],
  ['👂', '囁き・耳元の音'], ['😮‍💨', '吐息・溜息・寝息'], ['🌬️', '息切れ・荒い息遣い'], ['😮', '息をのむ'],
  ['⏸️', '間・沈黙'], ['🤭', '笑い・含み笑い'], ['👌', '相槌・頷く音'], ['🙏', '懇願するように'],
  ['🤔', '疑問の声'], ['🤧', '咳・鼻すすり・くしゃみ'], ['🥱', 'あくび'], ['😴', '寝言・いびき'],
  ['😖', '苦しげに'], ['😒', '舌打ち'], ['🥤', '飲み込む音'], ['👃', '匂いを嗅ぐ音'],
  ['💋', 'リップノイズ'], ['👅', '舐める音・咀嚼音・水音'], ['🤐', '口を塞がれて'], ['🥵', '喘ぎ・うめき・唸り声'],
])

const VOICE_DESIGN_PART_GROUPS = Object.freeze([
  {
    id: 'speaker',
    labelKey: 'speaker',
    options: [
      ['youngFemale', '若い女性が'], ['adultFemale', '大人の女性が'], ['youngMale', '若い男性が'],
      ['adultMale', '大人の男性が'], ['neutral', '中性的な話者が'],
    ],
  },
  {
    id: 'pitch',
    labelKey: 'pitch',
    options: [
      ['high', '高めの声で'], ['slightlyHigh', 'やや高めの声で'], ['middle', '自然な中音域の声で'],
      ['slightlyLow', 'やや低めの声で'], ['low', '低い声で'],
    ],
  },
  {
    id: 'delivery',
    labelKey: 'delivery',
    options: [
      ['calm', '落ち着いて'], ['articulate', '言葉をはっきり区切りながら'], ['gentle', 'やさしく'],
      ['whisper', '囁くように'], ['narration', '自然なナレーション調で'], ['confident', '自信を感じる調子で'],
    ],
  },
  {
    id: 'pace',
    labelKey: 'pace',
    options: [['slow', 'ゆっくり'], ['normal', '標準的な速さで'], ['brisk', 'テンポよく']],
  },
  {
    id: 'mood',
    labelKey: 'mood',
    options: [
      ['peaceful', '穏やかに話している'], ['bright', '明るく話している'], ['friendly', '親しげに話している'],
      ['restrained', '感情を抑えて話している'], ['serious', '真剣な調子で話している'],
    ],
  },
  {
    id: 'sound',
    labelKey: 'sound',
    options: [['clear', 'クリアな音質'], ['close', '近接感のある声'], ['soft', '柔らかな響き']],
  },
])

const VOICE_DESIGN_PRESETS = Object.freeze([
  { id: 'calm-female', labelKey: 'calmFemale', selections: { speaker: 'adultFemale', pitch: 'slightlyLow', delivery: 'calm', pace: 'slow', mood: 'peaceful', sound: 'clear' } },
  { id: 'articulate-male', labelKey: 'articulateMale', selections: { speaker: 'adultMale', pitch: 'middle', delivery: 'articulate', pace: 'brisk', mood: 'bright', sound: 'clear' } },
  { id: 'gentle-narrator', labelKey: 'gentleNarrator', selections: { speaker: 'adultFemale', pitch: 'middle', delivery: 'narration', pace: 'normal', mood: 'friendly', sound: 'soft' } },
  { id: 'bright-young-female', labelKey: 'brightYoungFemale', selections: { speaker: 'youngFemale', pitch: 'high', delivery: 'articulate', pace: 'brisk', mood: 'bright', sound: 'clear' } },
  { id: 'warm-low-male', labelKey: 'warmLowMale', selections: { speaker: 'adultMale', pitch: 'low', delivery: 'gentle', pace: 'slow', mood: 'peaceful', sound: 'soft' } },
  { id: 'neutral-announcer', labelKey: 'neutralAnnouncer', selections: { speaker: 'neutral', pitch: 'middle', delivery: 'narration', pace: 'normal', mood: 'restrained', sound: 'clear' } },
])

function buildVoiceDesignCaption(selections = {}) {
  const parts = VOICE_DESIGN_PART_GROUPS.map((group) => group.options.find(([id]) => id === selections[group.id])?.[1]).filter(Boolean)
  return parts.length > 0 ? `${parts.join('、')}。` : ''
}

const DEFAULT_VOICE_DESIGN_PRESET = VOICE_DESIGN_PRESETS[0]

const BUSY_JOB_STATUSES = new Set(['queued', 'paused', 'uploading', 'configuring', 'queuing', 'running', 'generating', 'saving'])

function getAssetUrl(asset) {
  return asset?.url || asset?.proxyUrl || asset?.path || asset?.absolutePath || ''
}

export default function IrodoriVoiceCloneCreator({
  assets = [],
  generationQueue = [],
  onQueue,
  onImportReferenceAudio,
  onOpenAssetBrowser,
  referenceAudioAssetId = '',
  onReferenceAudioAssetChange,
  onVoiceModeChange,
  referenceAudioImporting = false,
  dependencyChecking = false,
}) {
  const { t } = useI18n()
  const textareaRef = useRef(null)
  const [text, setText] = useState('')
  const [normalizeReference, setNormalizeReference] = useState(false)
  const [maxReferenceSeconds, setMaxReferenceSeconds] = useState(30)
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1000000000))
  const [numSteps, setNumSteps] = useState(30)
  const [cfgSpeaker, setCfgSpeaker] = useState(5)
  const [cfgCaption, setCfgCaption] = useState(3)
  const [voiceMode, setVoiceMode] = useState('standard')
  const [voiceDesignSelections, setVoiceDesignSelections] = useState(DEFAULT_VOICE_DESIGN_PRESET.selections)
  const [voiceDesignCaption, setVoiceDesignCaption] = useState(() => buildVoiceDesignCaption(DEFAULT_VOICE_DESIGN_PRESET.selections))
  const [voicePresetId, setVoicePresetId] = useState(DEFAULT_VOICE_DESIGN_PRESET.id)
  const [status, setStatus] = useState('')
  const [selectedResultId, setSelectedResultId] = useState('')

  useEffect(() => {
    onVoiceModeChange?.(voiceMode)
  }, [onVoiceModeChange, voiceMode])

  const audioAssets = useMemo(() => assets.filter((asset) => asset?.type === 'audio'), [assets])
  const referenceAsset = audioAssets.find((asset) => asset?.id === referenceAudioAssetId) || null
  const referenceUrl = getAssetUrl(referenceAsset)
  const resultAssets = useMemo(() => {
    const rows = assets.filter((asset) => {
      const meta = asset?.yolo || asset?.settings?.yolo
      return asset?.type === 'audio' && (meta?.stage === 'irodori-voice-clone' || meta?.stage === 'irodori-voice-design' || meta?.stage === 'irodori-voice-standard')
    })
    return rows.sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime())
  }, [assets])
  const resultSignature = resultAssets.map((asset) => asset?.id || getAssetUrl(asset)).join('|')
  useEffect(() => {
    if (resultAssets.length > 0) setSelectedResultId(resultAssets[0]?.id || '')
  }, [resultSignature])
  const selectedResult = resultAssets.find((asset) => asset?.id === selectedResultId) || resultAssets[0] || null
  const selectedResultUrl = getAssetUrl(selectedResult)
  const activeJob = [...generationQueue].reverse().find((job) => (job?.yolo?.stage === 'irodori-voice-clone' || job?.yolo?.stage === 'irodori-voice-design' || job?.yolo?.stage === 'irodori-voice-standard') && BUSY_JOB_STATUSES.has(job?.status))
  const isBusy = Boolean(activeJob)
  const isVoiceCloneMode = Boolean(referenceAsset)
  const isVoiceDesignMode = !isVoiceCloneMode && voiceMode === 'design'

  const changeVoiceMode = (nextMode) => {
    setVoiceMode(nextMode)
  }

  const applyVoicePreset = (preset) => {
    changeVoiceMode('design')
    setVoicePresetId(preset.id)
    setVoiceDesignSelections(preset.selections)
    setVoiceDesignCaption(buildVoiceDesignCaption(preset.selections))
  }

  const selectVoicePart = (groupId, optionId) => {
    changeVoiceMode('design')
    setVoicePresetId('custom')
    setVoiceDesignSelections((current) => {
      const next = { ...current, [groupId]: optionId }
      setVoiceDesignCaption(buildVoiceDesignCaption(next))
      return next
    })
  }

  const insertEmoji = (emoji) => {
    const field = textareaRef.current
    const start = Number.isInteger(field?.selectionStart) ? field.selectionStart : text.length
    const end = Number.isInteger(field?.selectionEnd) ? field.selectionEnd : start
    const next = `${text.slice(0, start)}${emoji}${text.slice(end)}`
    setText(next)
    requestAnimationFrame(() => {
      field?.focus()
      field?.setSelectionRange(start + emoji.length, start + emoji.length)
    })
  }

  const handleImport = async () => {
    const asset = await onImportReferenceAudio?.()
    if (asset?.id) onReferenceAudioAssetChange?.(asset)
  }

  const handleGenerate = async () => {
    const cleanText = text.trim()
    if (!cleanText) {
      setStatus(t('generate.director.irodoriClone.messages.enterText', {}, '読み上げる台詞を入力してください。'))
      return
    }
    if (isVoiceDesignMode && !voiceDesignCaption.trim()) {
      setStatus(t('generate.director.irodoriClone.messages.enterVoicePrompt', {}, '参照音声がない場合は声質プロンプトを入力してください。'))
      return
    }
    setStatus(t('generate.director.irodoriClone.messages.queueing', {}, '音声生成をキューへ追加しています…'))
    try {
      const result = await onQueue?.({
        text: cleanText,
        referenceAudioAssetId: referenceAsset?.id || '',
        voiceMode: isVoiceDesignMode ? 'design' : 'standard',
        voiceDesignCaption: isVoiceDesignMode ? voiceDesignCaption.trim() : '',
        normalizeReference,
        maxReferenceSeconds,
        seed,
        numSteps,
        cfgSpeaker,
        cfgCaption,
      })
      setStatus(result?.queued
        ? t('generate.director.irodoriClone.messages.queued', {}, 'キューへ追加しました。完了すると下の生成結果へ自動表示されます。')
        : (result?.message || t('generate.director.irodoriClone.messages.notQueued', {}, 'ジョブを追加できませんでした。')))
    } catch (error) {
      setStatus(error?.message || t('generate.director.irodoriClone.messages.failed', {}, '音声生成を開始できませんでした。'))
    }
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-sf-dark-700 bg-sf-dark-900/80">
        <div className="border-b border-sf-dark-700 bg-gradient-to-r from-fuchsia-500/15 via-sf-dark-900 to-sky-500/10 px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-fuchsia-300">{t('generate.director.irodoriClone.kicker', {}, 'Local Voice Studio')}</div>
              <h1 className="mt-1 text-2xl font-semibold text-sf-text-primary">{t('generate.director.irodoriClone.title', {}, 'Irodori ボイススタジオ')}</h1>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-sf-text-muted">
                {t('generate.director.irodoriClone.description', {}, '参照音声があれば声をクローンし、なければ声質プロンプトから日本語音声をデザインします。')}
              </p>
            </div>
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold text-emerald-200">Irodori-TTS Voice Studio · Local</span>
          </div>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
          <div className="space-y-4">
            <div className="rounded-xl border border-sf-dark-700 bg-sf-dark-800/50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-sf-text-primary"><Mic2 className="h-4 w-4 text-fuchsia-300" />{t('generate.director.irodoriClone.dialogue.title', {}, '喋らせたい台詞')}</div>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={8}
                placeholder={t('generate.director.irodoriClone.dialogue.placeholder', {}, '例：😊こんにちは。⏸️今日は新しい機能をご紹介します。')}
                className="mt-3 w-full resize-y rounded-xl border border-sf-dark-600 bg-sf-dark-950 px-3 py-3 text-sm leading-7 text-sf-text-primary outline-none placeholder:text-sf-text-muted focus:border-fuchsia-400"
              />
              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-wider text-sf-text-muted">{t('generate.director.irodoriClone.dialogue.emojiPicker', {}, '表情・演技 Emoji Picker')}</div>
                <div className="mt-2 flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-sf-dark-700 bg-sf-dark-950/70 p-2">
                  {EMOJI_CUES.map(([emoji, label]) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      title={label}
                      aria-label={`${emoji} ${label}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-sf-dark-600 bg-sf-dark-800 p-0 text-lg transition-colors hover:border-fuchsia-400 hover:bg-fuchsia-500/10 focus-visible:border-fuchsia-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/40"
                    >
                      <span aria-hidden="true">{emoji}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-sf-text-muted">{t('generate.director.irodoriClone.dialogue.emojiHelp', {}, 'カーソル位置へ挿入されます。複数の絵文字と⏸️の間を組み合わせられます。')}</p>
              </div>
            </div>

            <div className={`rounded-xl border p-4 ${isVoiceDesignMode ? 'border-fuchsia-500/30 bg-fuchsia-500/5' : 'border-sf-dark-700 bg-sf-dark-800/30'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-sf-text-primary">{t('generate.director.irodoriClone.voiceDesign.title', {}, '声質プロンプトビルダー')}</div>
                  <p className="mt-1 text-[10px] leading-relaxed text-sf-text-muted">{t('generate.director.irodoriClone.voiceDesign.help', {}, 'プリセット、話者、声の高さ、話し方、速度、感情、音質をクリックして声質プロンプトを組み立てます。')}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${isVoiceDesignMode ? 'bg-fuchsia-500/15 text-fuchsia-200' : 'bg-sky-500/15 text-sky-200'}`}>
                  {isVoiceCloneMode
                    ? t('generate.director.irodoriClone.voiceDesign.cloneMode', {}, '参照音声クローン')
                    : isVoiceDesignMode
                      ? t('generate.director.irodoriClone.voiceDesign.designMode', {}, '声質デザイン')
                      : t('generate.director.irodoriClone.voiceDesign.standardMode', {}, '参照なし・標準TTS')}
                </span>
              </div>
              {!isVoiceCloneMode && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => changeVoiceMode('standard')} className={`rounded-lg border px-3 py-2 text-left text-[11px] transition-colors ${!isVoiceDesignMode ? 'border-sky-400 bg-sky-500/15 text-sky-100' : 'border-sf-dark-600 bg-sf-dark-950 text-sf-text-muted hover:border-sky-400/60'}`}>
                    <span className="block font-semibold">{t('generate.director.irodoriClone.voiceDesign.enableStandard', {}, '標準音声')}</span>
                    <span className="mt-0.5 block text-[10px] opacity-75">{t('generate.director.irodoriClone.voiceDesign.standardHelp', {}, '既存のIrodori v3で、台詞をそのまま読み上げます。')}</span>
                  </button>
                  <button type="button" onClick={() => changeVoiceMode('design')} className={`rounded-lg border px-3 py-2 text-left text-[11px] transition-colors ${isVoiceDesignMode ? 'border-fuchsia-400 bg-fuchsia-500/15 text-fuchsia-100' : 'border-sf-dark-600 bg-sf-dark-950 text-sf-text-muted hover:border-fuchsia-400/60'}`}>
                    <span className="block font-semibold">{t('generate.director.irodoriClone.voiceDesign.enableDesign', {}, '声質をデザイン')}</span>
                    <span className="mt-0.5 block text-[10px] opacity-75">{t('generate.director.irodoriClone.voiceDesign.designHelp', {}, 'プリセットと声質パーツをVoiceDesignへ反映します。')}</span>
                  </button>
                </div>
              )}
              {isVoiceCloneMode && <div className="mt-3 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-[10px] text-sky-200">{t('generate.director.irodoriClone.voiceDesign.disabledByReference', {}, '参照音声が選択されているため、声質は参照音声を優先します。参照なしに戻すとVoiceDesignが有効になります。')}</div>}
              {!isVoiceCloneMode && !isVoiceDesignMode && <div className="mt-3 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-[10px] text-sky-200">{t('generate.director.irodoriClone.voiceDesign.disabledByStandard', {}, '現在は標準音声です。「声質をデザイン」を選ぶとVoiceDesignへ切り替わります。')}</div>}
              <div className={`mt-3 space-y-3 ${!isVoiceDesignMode ? 'pointer-events-none opacity-45' : ''}`} aria-disabled={!isVoiceDesignMode}>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-sf-text-muted">{t('generate.director.irodoriClone.voiceDesign.presets', {}, '声質プリセット')}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {VOICE_DESIGN_PRESETS.map((preset) => (
                      <button key={preset.id} type="button" onClick={() => applyVoicePreset(preset)} className={`rounded-full border px-2.5 py-1.5 text-[10px] transition-colors ${voicePresetId === preset.id ? 'border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-100' : 'border-sf-dark-600 bg-sf-dark-900 text-sf-text-secondary hover:border-fuchsia-400/60'}`}>
                        {t(`generate.director.irodoriClone.voiceDesign.presetNames.${preset.labelKey}`)}
                      </button>
                    ))}
                  </div>
                </div>
                {VOICE_DESIGN_PART_GROUPS.map((group) => (
                  <div key={group.id}>
                    <div className="text-[10px] text-sf-text-muted">{t(`generate.director.irodoriClone.voiceDesign.groups.${group.labelKey}`)}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {group.options.map(([optionId]) => (
                        <button key={optionId} type="button" onClick={() => selectVoicePart(group.id, optionId)} className={`rounded-lg border px-2 py-1 text-[10px] transition-colors ${voiceDesignSelections[group.id] === optionId ? 'border-fuchsia-400/80 bg-fuchsia-500/15 text-fuchsia-100' : 'border-sf-dark-600 bg-sf-dark-950 text-sf-text-muted hover:text-sf-text-primary'}`}>
                          {t(`generate.director.irodoriClone.voiceDesign.parts.${optionId}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <label className="block text-[10px] text-sf-text-muted">
                  {t('generate.director.irodoriClone.voiceDesign.prompt', {}, '完成した声質プロンプト')}
                  <textarea value={voiceDesignCaption} onChange={(event) => { setVoicePresetId('custom'); setVoiceDesignCaption(event.target.value) }} rows={3} className="mt-1.5 w-full resize-y rounded-lg border border-sf-dark-600 bg-sf-dark-950 px-3 py-2 text-xs leading-relaxed text-sf-text-primary outline-none focus:border-fuchsia-400" />
                </label>
                <p className="text-[10px] text-sf-text-muted">{t('generate.director.irodoriClone.voiceDesign.promptHelp', {}, 'この文章がVoiceDesignのcaptionへそのまま渡されます。台詞内の絵文字による演技指定も併用できます。')}</p>
              </div>
            </div>

            <div className="rounded-xl border border-sf-dark-700 bg-sf-dark-800/50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-sf-text-primary"><Volume2 className="h-4 w-4 text-sky-300" />{t('generate.director.irodoriClone.reference.title', {}, 'リファレンスオーディオ（任意）')}</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <select value={referenceAudioAssetId} onChange={(event) => onReferenceAudioAssetChange?.(audioAssets.find((asset) => asset.id === event.target.value) || null)} className="min-w-0 rounded-lg border border-sf-dark-600 bg-sf-dark-950 px-3 py-2 text-xs text-sf-text-primary outline-none focus:border-sky-400">
                  <option value="">{t('generate.director.irodoriClone.reference.none', {}, '参照なし')}</option>
                  {audioAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name || asset.id}</option>)}
                </select>
                <button type="button" onClick={onOpenAssetBrowser} className="inline-flex items-center justify-center gap-2 rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-2 text-xs font-semibold text-fuchsia-100 hover:bg-fuchsia-500/20">
                  <FolderOpen className="h-4 w-4" />
                  {t('generate.director.irodoriClone.reference.chooseFromBrowser', {}, 'アセットブラウザから選択')}
                </button>
                <button type="button" onClick={handleImport} disabled={referenceAudioImporting} className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/20 disabled:opacity-50">
                  {referenceAudioImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {t('generate.director.irodoriClone.reference.upload', {}, '音声をアップロード')}
                </button>
              </div>
              {referenceUrl ? <audio key={referenceUrl} src={referenceUrl} controls className="mt-3 w-full" /> : <div className="mt-3 rounded-lg border border-dashed border-fuchsia-500/25 bg-fuchsia-500/5 px-3 py-5 text-center text-[11px] text-fuchsia-200">{isVoiceDesignMode ? t('generate.director.irodoriClone.reference.empty', {}, '参照なしでは、上の声質プロンプトを使って新しい声を生成します。') : t('generate.director.irodoriClone.reference.emptyStandard', {}, '参照なしの標準音声として、台詞をそのまま読み上げます。')}</div>}
              <div className={`mt-3 grid gap-3 sm:grid-cols-2 ${isVoiceCloneMode ? '' : 'pointer-events-none opacity-40'}`}>
                <label className="flex items-center gap-2 text-[11px] text-sf-text-secondary"><input type="checkbox" checked={normalizeReference} onChange={(event) => setNormalizeReference(event.target.checked)} className="accent-sky-400" />{t('generate.director.irodoriClone.reference.normalize', {}, '参照音声を正規化（-16 dB）')}</label>
                <label className="text-[11px] text-sf-text-secondary">{t('generate.director.irodoriClone.reference.maxSeconds', {}, '参照に使う最大秒数')}<input type="number" min="1" max="120" value={maxReferenceSeconds} onChange={(event) => setMaxReferenceSeconds(Number(event.target.value) || 30)} className="ml-2 w-20 rounded border border-sf-dark-600 bg-sf-dark-950 px-2 py-1 text-xs" /></label>
              </div>
            </div>

            <details className="rounded-xl border border-sf-dark-700 bg-sf-dark-800/30 p-4">
              <summary className="cursor-pointer text-xs font-semibold text-sf-text-secondary">{t('generate.director.irodoriClone.advanced.title', {}, '詳細設定')}</summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-[10px] text-sf-text-muted">Seed<input type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value) || 0)} className="mt-1 w-full rounded border border-sf-dark-600 bg-sf-dark-950 px-2 py-1.5 text-xs text-sf-text-primary" /></label>
                <label className="text-[10px] text-sf-text-muted">Steps<input type="number" min="1" max="120" value={numSteps} onChange={(event) => setNumSteps(Number(event.target.value) || 30)} className="mt-1 w-full rounded border border-sf-dark-600 bg-sf-dark-950 px-2 py-1.5 text-xs text-sf-text-primary" /></label>
                <label className="text-[10px] text-sf-text-muted">Speaker CFG<input type="number" min="0" max="10" step="0.1" value={cfgSpeaker} onChange={(event) => setCfgSpeaker(Number(event.target.value) || 5)} className="mt-1 w-full rounded border border-sf-dark-600 bg-sf-dark-950 px-2 py-1.5 text-xs text-sf-text-primary" /></label>
                <label className="text-[10px] text-sf-text-muted">Caption CFG<input type="number" min="0" max="10" step="0.1" value={cfgCaption} onChange={(event) => setCfgCaption(Number(event.target.value) || 3)} className="mt-1 w-full rounded border border-sf-dark-600 bg-sf-dark-950 px-2 py-1.5 text-xs text-sf-text-primary" /></label>
              </div>
              <button type="button" onClick={() => setSeed(Math.floor(Math.random() * 1000000000))} className="mt-3 inline-flex items-center gap-1.5 text-[10px] text-sf-text-muted hover:text-sf-text-primary"><RefreshCw className="h-3 w-3" />{t('generate.director.irodoriClone.advanced.randomSeed', {}, 'Seedをランダム化')}</button>
            </details>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={handleGenerate} disabled={isBusy || dependencyChecking || !text.trim() || (isVoiceDesignMode && !voiceDesignCaption.trim())} className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-950/30 hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50">
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <AudioLines className="h-4 w-4" />}
                {isBusy ? t('generate.director.irodoriClone.actions.generating', {}, '生成中…') : t('generate.director.irodoriClone.actions.generate', {}, '音声を生成')}
              </button>
              {status && <span className="text-[11px] text-sf-text-muted">{status}</span>}
            </div>
          </div>

          <aside className="rounded-xl border border-sf-dark-700 bg-sf-dark-950/50 p-4">
            <div className="flex items-center justify-between gap-2"><div className="text-sm font-semibold text-sf-text-primary">{t('generate.director.irodoriClone.results.title', {}, '生成結果')}</div><span className="rounded-full border border-sf-dark-600 px-2 py-1 text-[10px] text-sf-text-muted">{resultAssets.length}</span></div>
            {selectedResultUrl ? (
              <>
                <div className="mt-4 rounded-xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 to-sky-500/5 p-4">
                  <AudioLines className="h-10 w-10 text-fuchsia-300" />
                  <div className="mt-3 truncate text-sm font-semibold text-sf-text-primary">{selectedResult?.name || t('generate.director.irodoriClone.results.untitled', {}, 'Irodori Voice Studio')}</div>
                  <audio key={selectedResultUrl} src={selectedResultUrl} controls className="mt-4 w-full" />
                  <div className="mt-2 text-[10px] text-emerald-200">{t('generate.director.irodoriClone.results.saved', {}, 'プロジェクト素材に保存済み')}</div>
                </div>
                {resultAssets.length > 1 && <div className="mt-3 space-y-2">{resultAssets.slice(0, 8).map((asset, index) => <button key={asset.id || index} type="button" onClick={() => setSelectedResultId(asset.id)} className={`w-full rounded-lg border px-3 py-2 text-left text-[11px] ${asset === selectedResult ? 'border-fuchsia-400 bg-fuchsia-500/10 text-fuchsia-100' : 'border-sf-dark-700 text-sf-text-secondary hover:border-sf-dark-500'}`}>{asset.name || `${t('generate.director.irodoriClone.results.take', {}, 'テイク')} ${index + 1}`}</button>)}</div>}
              </>
            ) : (
              <div className="mt-4 flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-sf-dark-600 px-5 text-center"><AudioLines className="h-9 w-9 text-sf-text-muted" /><div className="mt-3 text-xs font-medium text-sf-text-secondary">{t('generate.director.irodoriClone.results.empty', {}, '生成音声はまだありません')}</div><p className="mt-1 text-[10px] leading-relaxed text-sf-text-muted">{t('generate.director.irodoriClone.results.emptyHelp', {}, 'ジョブが完了すると、ここに音声プレイヤーが自動表示されます。')}</p></div>
            )}
          </aside>
        </div>
      </section>
    </div>
  )
}
