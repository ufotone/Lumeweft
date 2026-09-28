import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, GripVertical, Pause, Play, Scissors, Trash2 } from 'lucide-react'
import useTimelineStore from '../stores/timelineStore'
import useAssetsStore from '../stores/assetsStore'
import useProjectStore from '../stores/projectStore'
import {
  buildReferenceCutPlan,
  getLinkedReferenceAudioClips,
  getReferenceCutOutputDirectory,
  getReferenceOutputPreset,
  REFERENCE_SIZE_PRESETS,
} from '../services/referenceCut'
import { getSpriteFramePosition } from '../services/thumbnailSprites'

const MAX_DURATION_CHOICES = [5, 10, 15]

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const formatTime = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0)
  const minutes = Math.floor(safe / 60)
  const remainder = safe - minutes * 60
  return `${String(minutes).padStart(2, '0')}:${remainder.toFixed(3).padStart(6, '0')}`
}

const OUTPUT_PRESET_LABELS = {
  landscape: '横長',
  portrait: '縦長',
  square: '正方形',
  source: '元の形',
}

function FilmstripFrame({ sprite, time, posterUrl }) {
  const frame = sprite?.url ? getSpriteFramePosition(sprite, time) : null
  if (frame) {
    const scale = 68 / Math.max(1, frame.height)
    return (
      <div
        className="h-full min-w-0 flex-1 bg-black bg-no-repeat bg-center"
        style={{
          backgroundImage: `url(${sprite.url})`,
          backgroundSize: `${sprite.width * scale}px ${sprite.height * scale}px`,
          backgroundPosition: `${-frame.x * scale}px ${-frame.y * scale}px`,
        }}
      />
    )
  }
  return (
    <div
      className="h-full min-w-0 flex-1 bg-sf-dark-700 bg-cover bg-center"
      style={posterUrl ? { backgroundImage: `url(${posterUrl})` } : undefined}
    />
  )
}

function ReferenceCut() {
  const videoRef = useRef(null)
  const filmstripRef = useRef(null)
  const rangeDragRef = useRef(null)
  const spriteAttemptedRef = useRef(new Set())
  const timelineState = useTimelineStore()
  const assets = useAssetsStore((state) => state.assets)
  const addAsset = useAssetsStore((state) => state.addAsset)
  const generateAssetSprite = useAssetsStore((state) => state.generateAssetSprite)
  const projectHandle = useProjectStore((state) => state.currentProjectHandle)
  const saveProject = useProjectStore((state) => state.saveProject)
  const [targetClipId, setTargetClipId] = useState('')
  const [sourceTime, setSourceTime] = useState(0)
  const [rangeStart, setRangeStart] = useState(0)
  const [rangeEnd, setRangeEnd] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [presetId, setPresetId] = useState('landscape')
  const [fit, setFit] = useState('cover')
  const [maxDuration, setMaxDuration] = useState(5)
  const [fallbackFrameUrl, setFallbackFrameUrl] = useState('')
  const [ffmpegFrames, setFfmpegFrames] = useState([])
  const [renderState, setRenderState] = useState({ phase: 'idle', message: '' })

  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets])
  const videoClips = useMemo(() => (
    timelineState.clips
      .filter((clip) => clip?.type === 'video' && assetById.has(clip.assetId))
      .sort((a, b) => a.startTime - b.startTime)
  ), [timelineState.clips, assetById])

  useEffect(() => {
    const selectedVideo = timelineState.selectedClipIds
      .map((id) => videoClips.find((clip) => clip.id === id))
      .find(Boolean)
    if (selectedVideo) setTargetClipId(selectedVideo.id)
    else if (!videoClips.some((clip) => clip.id === targetClipId)) setTargetClipId(videoClips[0]?.id || '')
  }, [timelineState.selectedClipIds, targetClipId, videoClips])

  const clip = videoClips.find((entry) => entry.id === targetClipId) || null
  const asset = clip ? assetById.get(clip.assetId) : null
  const linkedAudioClips = useMemo(
    () => getLinkedReferenceAudioClips(timelineState.clips, clip),
    [clip, timelineState.clips]
  )
  const sourceDuration = Math.max(0, Number(clip?.sourceDuration || asset?.duration || asset?.settings?.duration) || 0)
  const clipStart = clamp(Number(clip?.trimStart) || 0, 0, sourceDuration)
  const clipEnd = clamp(Number(clip?.trimEnd) || sourceDuration, clipStart, sourceDuration)
  const savedCut = clip?.metadata?.referenceCut || null
  const markers = Array.isArray(savedCut?.markers) ? savedCut.markers : []
  const visibleSourceSpan = Math.max(0.001, clipEnd - clipStart)
  const toFilmstripPercent = (time) => ((time - clipStart) / visibleSourceSpan) * 100
  const selectionLeft = toFilmstripPercent(rangeStart)
  const selectionWidth = ((rangeEnd - rangeStart) / visibleSourceSpan) * 100
  const filmstripPosterUrl = asset?.poster?.url || asset?.thumbnail || fallbackFrameUrl
  const spriteSourceUrl = asset?.playbackCacheUrl || asset?.proxyUrl || asset?.url
  const getExtractedFrameUrl = useCallback((time) => {
    if (ffmpegFrames.length === 0) return ''
    return ffmpegFrames.reduce((closest, frame) => (
      Math.abs(frame.time - time) < Math.abs(closest.time - time) ? frame : closest
    ), ffmpegFrames[0]).url
  }, [ffmpegFrames])

  useEffect(() => {
    const attemptKey = asset?.id && spriteSourceUrl ? `${asset.id}:${spriteSourceUrl}` : ''
    if (!attemptKey || asset.sprite || asset.spriteGenerating || spriteAttemptedRef.current.has(attemptKey)) return
    spriteAttemptedRef.current.add(attemptKey)
    generateAssetSprite(asset.id, projectHandle).catch(() => {})
  }, [asset?.id, asset?.sprite, asset?.spriteGenerating, generateAssetSprite, projectHandle, spriteSourceUrl])

  useEffect(() => {
    let cancelled = false
    setFfmpegFrames([])
    if (!asset?.id || !projectHandle || !window.electronAPI?.extractVideoPoster) return () => { cancelled = true }

    const extractFrames = async () => {
      const sourcePath = asset.absolutePath
        || (asset.path ? await window.electronAPI.pathJoin(projectHandle, ...String(asset.path).split('/')) : '')
      if (!sourcePath) return

      const outputDir = await window.electronAPI.pathJoin(projectHandle, 'thumbnails', 'reference-cut')
      await window.electronAPI.createDirectory(outputDir, { recursive: true })
      const safeAssetId = String(asset.id).replace(/[^a-zA-Z0-9_-]/g, '_')
      const rangeKey = `${Math.round(clipStart * 1000)}-${Math.round(clipEnd * 1000)}`
      const sampleCount = 12
      const sampleTimes = Array.from({ length: sampleCount }, (_, index) => (
        clipStart + (visibleSourceSpan * index) / sampleCount
      ))
      const extracted = []

      for (let offset = 0; offset < sampleCount; offset += 3) {
        const batch = sampleTimes.slice(offset, offset + 3)
        const results = await Promise.all(batch.map(async (time, batchIndex) => {
          const index = offset + batchIndex
          const outputPath = await window.electronAPI.pathJoin(outputDir, `${safeAssetId}_${rangeKey}_${String(index).padStart(2, '0')}.jpg`)
          const exists = await window.electronAPI.exists(outputPath)
          if (!exists) {
            const result = await window.electronAPI.extractVideoPoster(sourcePath, outputPath, {
              seekSeconds: time,
              width: 360,
              quality: 4,
            })
            if (!result?.success) return null
          }
          return { time, url: await window.electronAPI.getFileUrlDirect(outputPath) }
        }))
        extracted.push(...results.filter(Boolean))
        if (cancelled) return
        setFfmpegFrames([...extracted])
      }
    }

    extractFrames().catch((error) => {
      console.warn('[ReferenceCut] FFmpeg filmstrip extraction failed:', error)
    })
    return () => { cancelled = true }
  }, [asset?.absolutePath, asset?.id, asset?.path, clipEnd, clipStart, projectHandle, visibleSourceSpan])

  useEffect(() => {
    if (!clip) return
    const nextStart = clamp(Number(savedCut?.rangeStart ?? clipStart), clipStart, clipEnd)
    const nextEnd = clamp(Number(savedCut?.rangeEnd ?? clipEnd), nextStart, clipEnd)
    setRangeStart(nextStart)
    setRangeEnd(nextEnd)
    setSourceTime(nextStart)
    setPresetId(savedCut?.presetId || 'landscape')
    setFit(savedCut?.fit === 'contain' ? 'contain' : 'cover')
    setMaxDuration(MAX_DURATION_CHOICES.includes(Number(savedCut?.maxDuration)) ? Number(savedCut.maxDuration) : 5)
    setFallbackFrameUrl('')
    setFfmpegFrames([])
    setRenderState({ phase: 'idle', message: '' })
  }, [clip?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const captureFallbackFrame = useCallback((video) => {
    if (!video?.videoWidth || !video?.videoHeight || fallbackFrameUrl) return
    try {
      const canvas = document.createElement('canvas')
      const width = Math.min(480, video.videoWidth)
      canvas.width = width
      canvas.height = Math.max(1, Math.round(width * video.videoHeight / video.videoWidth))
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
      const url = canvas.toDataURL('image/jpeg', 0.76)
      if (url && url !== 'data:,') setFallbackFrameUrl(url)
    } catch {
      // Some local media URLs cannot be copied to canvas. The generated sprite remains the primary source.
    }
  }, [fallbackFrameUrl])

  const persistCut = useCallback((updates, saveHistory = true) => {
    if (!clip) return
    timelineState.updateClipReferenceCut(clip.id, {
      ...(savedCut || {}),
      rangeStart,
      rangeEnd,
      markers,
      presetId,
      fit,
      maxDuration,
      ...updates,
    }, saveHistory)
  }, [clip, fit, markers, maxDuration, presetId, rangeEnd, rangeStart, savedCut, timelineState])

  const cutPlan = useMemo(() => buildReferenceCutPlan({
    start: rangeStart,
    end: rangeEnd,
    markers,
    maxDuration,
  }), [markers, maxDuration, rangeEnd, rangeStart])
  const segments = cutPlan.segments
  const excludedRanges = cutPlan.excludedRanges
  const totalDuration = segments.reduce((sum, segment) => sum + segment.duration, 0)
  const h3Warnings = [
    segments.some((segment) => segment.tooShort) ? '2秒未満のカットがあります' : '',
    segments.length > 3 ? 'H3の参照動画上限（3本）を超えます' : '',
    totalDuration > 15.001 ? 'H3の合計尺上限（15秒）を超えます' : '',
  ].filter(Boolean)

  const seek = useCallback((time) => {
    const next = clamp(Number(time) || 0, rangeStart, rangeEnd)
    setSourceTime(next)
    if (videoRef.current) videoRef.current.currentTime = next
  }, [rangeEnd, rangeStart])

  const togglePlayback = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      if (video.currentTime < rangeStart || video.currentTime >= rangeEnd - 0.01 || sourceTime >= rangeEnd - 0.01) {
        video.currentTime = rangeStart
        setSourceTime(rangeStart)
      }
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }

  const addMarker = () => {
    if (!clip || sourceTime <= rangeStart + 0.01 || sourceTime >= rangeEnd - 0.01) return
    const nextMarkers = [...markers, { id: `cut-${Date.now()}`, time: sourceTime }]
      .sort((a, b) => a.time - b.time)
    persistCut({ markers: nextMarkers })
  }

  const removeMarker = (markerId) => {
    persistCut({ markers: markers.filter((marker) => marker.id !== markerId) })
  }

  const clearMarkers = () => {
    if (markers.length === 0) return
    persistCut({ markers: [] })
  }

  const changeRange = (edge, rawValue, saveHistory = true) => {
    const value = Number(rawValue)
    if (!Number.isFinite(value)) return null
    if (edge === 'start') {
      const next = clamp(value, clipStart, Math.max(clipStart, rangeEnd - 0.04))
      setRangeStart(next)
      setSourceTime(next)
      if (videoRef.current) videoRef.current.currentTime = next
      persistCut({ rangeStart: next }, saveHistory)
      return next
    } else {
      const next = clamp(value, Math.min(clipEnd, rangeStart + 0.04), clipEnd)
      setRangeEnd(next)
      persistCut({ rangeEnd: next }, saveHistory)
      return next
    }
  }

  const getFilmstripTime = (clientX) => {
    const rect = filmstripRef.current?.getBoundingClientRect()
    if (!rect?.width) return clipStart
    return clipStart + clamp((clientX - rect.left) / rect.width, 0, 1) * visibleSourceSpan
  }

  const startRangeDrag = (event, edge) => {
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    rangeDragRef.current = { edge, pointerId: event.pointerId }
    timelineState.saveToHistory()
  }

  const moveRangeDrag = (event) => {
    if (!rangeDragRef.current) return
    changeRange(rangeDragRef.current.edge, getFilmstripTime(event.clientX), false)
  }

  const finishRangeDrag = (event) => {
    if (!rangeDragRef.current) return
    try { event.currentTarget.releasePointerCapture?.(rangeDragRef.current.pointerId) } catch { /* already released */ }
    rangeDragRef.current = null
  }

  const applyTrimToTimelineClip = () => {
    if (!clip || rangeEnd <= rangeStart) return
    const oldSourceSpan = Math.max(0.001, clipEnd - clipStart)
    const timelinePerSourceSecond = Math.max(0.0001, Number(clip.duration) || oldSourceSpan) / oldSourceSpan
    const nextDuration = (rangeEnd - rangeStart) * timelinePerSourceSecond
    timelineState.saveToHistory()
    timelineState.updateClipsTrim([
      {
        id: clip.id,
        updates: { trimStart: rangeStart, trimEnd: rangeEnd, duration: nextDuration },
      },
      ...linkedAudioClips.map((audioClip) => ({
        id: audioClip.id,
        updates: { trimStart: rangeStart, trimEnd: rangeEnd, duration: nextDuration },
      })),
    ])
    setRenderState({
      phase: 'done',
      message: linkedAudioClips.length > 0
        ? `映像と連動オーディオ${linkedAudioClips.length}本へ同じIn/Outを反映しました。`
        : 'タイムライン上のクリップへIn/Outを反映しました。',
    })
  }

  const renderCuts = async () => {
    if (!clip || !asset || !projectHandle || segments.length === 0) return
    if (!window.electronAPI?.renderReferenceCuts) {
      setRenderState({ phase: 'error', message: '参照動画の書き出しはElectron版で利用できます。' })
      return
    }
    setRenderState({ phase: 'rendering', message: `${segments.length}本を書き出しています…` })
    try {
      const inputPath = asset.absolutePath
        || (asset.path ? await window.electronAPI.pathJoin(projectHandle, ...String(asset.path).split('/')) : '')
      if (!inputPath) throw new Error('元動画のローカルパスを確認できません。')
      const outputLocation = getReferenceCutOutputDirectory(asset.path)
      const outputDir = await window.electronAPI.pathJoin(projectHandle, ...outputLocation.parts)
      const preset = getReferenceOutputPreset(presetId)
      const result = await window.electronAPI.renderReferenceCuts({
        inputPath,
        outputDir,
        baseName: asset.name || clip.name || 'reference',
        width: preset.width,
        height: preset.height,
        fit,
        segments,
      })
      if (!result?.success) throw new Error(result?.error || '参照動画を書き出せませんでした。')

      for (const output of result.outputs || []) {
        const url = await window.electronAPI.getFileUrlDirect(output.outputPath)
        addAsset({
          name: output.outputName,
          type: 'video',
          path: `${outputLocation.relativePath}/${output.outputName}`,
          absolutePath: output.outputPath,
          url,
          folderId: asset.folderId || null,
          duration: output.duration,
          width: output.width,
          height: output.height,
          fps: output.fps,
          size: output.size,
          mimeType: 'video/mp4',
          isImported: true,
          hasAudio: output.hasAudio !== false,
          audioEnabled: output.hasAudio !== false,
          imported: new Date().toISOString(),
          settings: {
            referenceCut: true,
            sourceAssetId: asset.id,
            sourceClipId: clip.id,
            sourceStart: output.start,
            fit,
            presetId,
          },
        })
      }
      await saveProject?.()
      setRenderState({ phase: 'done', message: `${result.outputs?.length || 0}本を元素材と同じフォルダへ追加しました。` })
    } catch (error) {
      setRenderState({ phase: 'error', message: error?.message || String(error) })
    }
  }

  if (!clip || !asset) {
    return (
      <div className="h-full flex items-center justify-center bg-sf-dark-950 text-sf-text-muted">
        <div className="text-center">
          <Scissors className="mx-auto mb-2 h-6 w-6 opacity-60" />
          <p className="text-sm">Timelineで動画クリップを選択してください。</p>
          <p className="mt-1 text-[11px]">Cutには対象クリップだけが表示されます。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 bg-sf-dark-950 text-sf-text-primary flex">
      <section className="min-w-0 flex-1 flex flex-col border-r border-sf-dark-700">
        <div className="h-9 px-3 flex items-center gap-2 border-b border-sf-dark-700 bg-sf-dark-900">
          <Scissors className="h-3.5 w-3.5 text-sf-accent" />
          <select
            value={clip.id}
            onChange={(event) => setTargetClipId(event.target.value)}
            className="min-w-0 max-w-[360px] bg-sf-dark-800 border border-sf-dark-600 rounded px-2 py-1 text-[11px]"
            title="対象クリップ"
          >
            {videoClips.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.name} · {formatTime(entry.startTime)}</option>
            ))}
          </select>
          <span className="ml-auto text-[10px] text-sf-text-muted">Source {formatTime(sourceTime)}</span>
        </div>

        <div className="min-h-0 flex-1 flex items-center justify-center bg-black/80 p-2">
          <video
            ref={videoRef}
            key={asset.id}
            src={asset.playbackCacheUrl || asset.proxyUrl || asset.url}
            className="h-full w-full object-contain"
            onLoadedMetadata={(event) => { event.currentTarget.currentTime = rangeStart }}
            onLoadedData={(event) => captureFallbackFrame(event.currentTarget)}
            onSeeked={(event) => captureFallbackFrame(event.currentTarget)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={(event) => {
              const time = event.currentTarget.currentTime
              if (time >= rangeEnd - 0.01) {
                event.currentTarget.pause()
                // Hold the visible last frame. Rewinding here caused a one-frame
                // flash of the range start that looked like unintended looping.
                setSourceTime(rangeEnd)
              } else {
                setSourceTime(time)
              }
            }}
            onEnded={(event) => {
              event.currentTarget.pause()
              setSourceTime(rangeEnd)
            }}
          />
        </div>

        <div className="px-3 py-2 border-t border-sf-dark-700 bg-sf-dark-900">
          <div className="min-w-0 flex items-center gap-2">
            <button onClick={togglePlayback} className="h-7 w-7 flex-shrink-0 rounded bg-sf-dark-700 hover:bg-sf-dark-600 grid place-items-center" title="再生 / 停止">
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
            <input
              type="range"
              min={rangeStart}
              max={rangeEnd}
              step="0.001"
              value={clamp(sourceTime, rangeStart, rangeEnd)}
              onChange={(event) => seek(event.target.value)}
              className="min-w-0 flex-1 accent-sf-accent"
            />
            <button onClick={addMarker} className="h-7 flex-shrink-0 px-2 rounded bg-sf-accent/15 text-sf-accent hover:bg-sf-accent/25 flex items-center gap-1 text-[11px]" title="再生ヘッドの位置に分割マーカーをセット">
              <Scissors className="h-3.5 w-3.5" /> 分割マーカーをセット
            </button>
            <button
              onClick={clearMarkers}
              disabled={markers.length === 0}
              className="h-7 w-7 flex-shrink-0 rounded border border-sf-dark-600 bg-sf-dark-800 text-sf-text-muted hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40 grid place-items-center"
              title="すべての分割マーカーをクリア"
              aria-label="すべての分割マーカーをクリア"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="sr-only">マーカーをクリア</span>
            </button>
          </div>
          <div
            ref={filmstripRef}
            className="relative mt-2 h-[72px] rounded-md bg-sf-dark-800 border border-sf-dark-600 cursor-crosshair overflow-hidden select-none touch-none"
            onClick={(event) => {
              if (rangeDragRef.current) return
              seek(getFilmstripTime(event.clientX))
            }}
            onPointerMove={moveRangeDrag}
            onPointerUp={finishRangeDrag}
            onPointerCancel={finishRangeDrag}
          >
            <div
              className="absolute inset-y-1 overflow-hidden rounded-[3px] border-2 border-fuchsia-400 bg-black shadow-[0_0_0_1px_rgba(0,0,0,0.55)] pointer-events-none"
              style={{ left: `${selectionLeft}%`, width: `${selectionWidth}%` }}
            >
              <div className="absolute inset-0 flex overflow-hidden opacity-95">
                {Array.from({ length: 12 }).map((_, index) => (
                  (() => {
                    const time = rangeStart + ((rangeEnd - rangeStart) * index) / 11
                    const extractedFrameUrl = getExtractedFrameUrl(time)
                    return (
                      <FilmstripFrame
                        key={index}
                        sprite={extractedFrameUrl ? null : asset.sprite}
                        posterUrl={extractedFrameUrl || filmstripPosterUrl}
                        time={time}
                      />
                    )
                  })()
                ))}
              </div>
              {!asset.sprite?.url && ffmpegFrames.length === 0 && !filmstripPosterUrl && (
                <div className="absolute inset-0 grid place-items-center bg-sf-dark-800 text-[10px] text-sf-text-muted">
                  サムネイルを準備中…
                </div>
              )}
            </div>
            {excludedRanges.map((excludedRange) => (
              <div
                key={excludedRange.id}
                className="absolute inset-y-1 z-[5] pointer-events-none bg-black/75 shadow-[-2px_0_5px_rgba(0,0,0,0.8)]"
                style={{
                  left: `${toFilmstripPercent(excludedRange.start)}%`,
                  width: `${(excludedRange.duration / visibleSourceSpan) * 100}%`,
                }}
                title={`${maxDuration}秒の上限を超えるため書き出されない範囲`}
              />
            ))}
            {segments.map((segment, index) => (
              <div
                key={segment.id}
                className={`absolute top-1 bottom-1 border-r ${segment.tooShort ? 'bg-amber-500/20 border-amber-300' : index % 2 ? 'bg-fuchsia-400/10 border-fuchsia-300/70' : 'border-fuchsia-300/70'}`}
                style={{ left: `${toFilmstripPercent(segment.start)}%`, width: `${(segment.duration / visibleSourceSpan) * 100}%` }}
                title={`Cut ${index + 1}: ${formatTime(segment.start)} – ${formatTime(segment.end)}`}
              />
            ))}
            {markers.map((marker) => (
              <button
                key={marker.id}
                onClick={(event) => { event.stopPropagation(); seek(marker.time) }}
                className="absolute top-1 bottom-1 w-0.5 bg-amber-300 z-10"
                style={{ left: `${toFilmstripPercent(marker.time)}%` }}
                title={formatTime(marker.time)}
              />
            ))}
            <button
              type="button"
              onPointerDown={(event) => startRangeDrag(event, 'start')}
              className="absolute inset-y-0 z-30 w-4 -translate-x-1/2 cursor-ew-resize bg-fuchsia-500 hover:bg-fuchsia-400 active:bg-fuchsia-300 active:scale-[0.97] shadow-lg flex items-center justify-center transition-[background-color,transform] duration-150 ease-out"
              style={{ left: `${toFilmstripPercent(rangeStart)}%` }}
              title="左へドラッグして開始位置を変更"
            >
              <GripVertical className="h-4 w-4 text-white" />
            </button>
            <button
              type="button"
              onPointerDown={(event) => startRangeDrag(event, 'end')}
              className="absolute inset-y-0 z-30 w-4 -translate-x-1/2 cursor-ew-resize bg-fuchsia-500 hover:bg-fuchsia-400 active:bg-fuchsia-300 active:scale-[0.97] shadow-lg flex items-center justify-center transition-[background-color,transform] duration-150 ease-out"
              style={{ left: `${toFilmstripPercent(rangeEnd)}%` }}
              title="左右へドラッグして終了位置を変更"
            >
              <GripVertical className="h-4 w-4 text-white" />
            </button>
            <div className="absolute inset-y-0 w-0.5 bg-white z-20 pointer-events-none shadow-[0_0_4px_black]" style={{ left: `${toFilmstripPercent(clamp(sourceTime, clipStart, clipEnd))}%` }} />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-sf-text-muted">
            <span>左右の紫ハンドルをドラッグしてトリム</span>
            <span>選択 {Math.max(0, rangeEnd - rangeStart).toFixed(2)}秒</span>
          </div>
        </div>
      </section>

      <aside className="w-[310px] flex-shrink-0 overflow-y-auto bg-sf-dark-900 p-3 text-[11px]">
        <h3 className="text-xs font-semibold">リファレンス用カット</h3>
        <p className="mt-1 text-sf-text-muted leading-relaxed">マーカーで分割し、H3向けの短い動画としてProject Assetsへ書き出します。</p>

        <div className="mt-3 rounded-md border border-sf-dark-600 bg-sf-dark-800 p-2">
          <div className="flex items-center justify-between">
            <span className="text-sf-text-muted">選択範囲</span>
            <span className="font-medium text-fuchsia-300">{Math.max(0, rangeEnd - rangeStart).toFixed(2)}秒</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-sf-text-muted">
            <span>{formatTime(rangeStart)}</span>
            <span>→</span>
            <span>{formatTime(rangeEnd)}</span>
          </div>
          <div className="mt-2 text-[10px] leading-relaxed text-sf-text-muted">
            フィルムストリップの紫ハンドルを掴んで、必要な部分だけ残します。
          </div>
        </div>
        <button onClick={applyTrimToTimelineClip} className="mt-2 w-full rounded border border-sf-dark-600 bg-sf-dark-800 py-1.5 hover:bg-sf-dark-700">この範囲を映像・音声へ反映</button>

        <div className="mt-4">
          <div className="text-sf-text-muted">1本あたりの最大尺</div>
          <div className="mt-1 flex gap-1">
            {MAX_DURATION_CHOICES.map((duration) => (
              <button key={duration} onClick={() => { setMaxDuration(duration); persistCut({ maxDuration: duration }) }} className={`flex-1 rounded py-1.5 ${maxDuration === duration ? 'bg-sf-accent text-white' : 'bg-sf-dark-800 hover:bg-sf-dark-700'}`}>{duration}秒</button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="text-sf-text-muted">出力サイズ / 形</div>
          <div className="mt-1 grid grid-cols-4 gap-1">
            {Object.values(REFERENCE_SIZE_PRESETS).map((preset) => (
              <button key={preset.id} onClick={() => { setPresetId(preset.id); persistCut({ presetId: preset.id }) }} className={`rounded py-2 flex flex-col items-center gap-1 ${presetId === preset.id ? 'bg-sf-accent text-white' : 'bg-sf-dark-800 hover:bg-sf-dark-700'}`}>
                <span className={`block border border-current rounded-sm ${preset.id === 'portrait' ? 'h-5 w-3' : preset.id === 'square' ? 'h-4 w-4' : preset.id === 'source' ? 'h-4 w-5 border-dashed' : 'h-3 w-5'}`} />
                <span className="text-[9px]">{OUTPUT_PRESET_LABELS[preset.id]}</span>
              </button>
            ))}
          </div>
          {presetId !== 'source' && (
            <div className="mt-1 grid grid-cols-2 gap-1">
              <button onClick={() => { setFit('cover'); persistCut({ fit: 'cover' }) }} className={`rounded py-1.5 ${fit === 'cover' ? 'bg-sf-dark-600' : 'bg-sf-dark-800'}`}>画面いっぱい</button>
              <button onClick={() => { setFit('contain'); persistCut({ fit: 'contain' }) }} className={`rounded py-1.5 ${fit === 'contain' ? 'bg-sf-dark-600' : 'bg-sf-dark-800'}`}>全体を収める</button>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sf-text-muted">Cuts</span>
          <span>{segments.length}本 / {totalDuration.toFixed(2)}秒</span>
        </div>
        <div className="mt-1 max-h-32 space-y-1 overflow-y-auto">
          {segments.map((segment, index) => (
            <button key={segment.id} onClick={() => seek(segment.start)} className={`w-full flex items-center justify-between rounded px-2 py-1 text-left ${segment.tooShort ? 'bg-amber-500/15 text-amber-200' : 'bg-sf-dark-800'}`}>
              <span>Cut {String(index + 1).padStart(2, '0')}</span>
              <span>{formatTime(segment.start)} · {segment.duration.toFixed(2)}s</span>
            </button>
          ))}
        </div>
        {markers.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {markers.map((marker, index) => (
              <button key={marker.id} onClick={() => removeMarker(marker.id)} className="rounded bg-amber-500/15 px-2 py-1 text-amber-200 flex items-center gap-1" title="マーカーを削除">
                M{index + 1} {formatTime(marker.time)} <Trash2 className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}
        {h3Warnings.length > 0 && <p className="mt-2 rounded bg-amber-500/10 px-2 py-1.5 text-amber-200">{h3Warnings.join(' / ')}</p>}

        <button
          onClick={renderCuts}
          disabled={renderState.phase === 'rendering' || !projectHandle}
          className="mt-4 w-full rounded bg-sf-accent py-2 font-medium text-white hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          {renderState.phase === 'rendering' ? 'Rendering…' : `マーカーごとに${segments.length}本を書き出す`}
        </button>
        {!projectHandle && <p className="mt-1 text-amber-300">先にプロジェクトを保存してください。</p>}
        {renderState.message && <p className={`mt-2 ${renderState.phase === 'error' ? 'text-red-300' : 'text-sf-text-muted'}`}>{renderState.message}</p>}
      </aside>
    </div>
  )
}

export default ReferenceCut
