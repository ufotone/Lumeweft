import { useState, useEffect, useMemo, useRef } from 'react'
import {
  X, Server, FolderOpen, Palette, Monitor, Save,
  HardDrive, Film, Keyboard, Wrench, Power,
  KeyRound, CheckCircle2, ExternalLink, Loader2, RefreshCcw,
  Volume2, Play, Bot, Copy, Globe2, Cloud,
} from 'lucide-react'
import useProjectStore, { RESOLUTION_PRESETS, FPS_PRESETS } from '../stores/projectStore'
import useTimelineStore from '../stores/timelineStore'
import useAssetsStore from '../stores/assetsStore'
import { THEMES, getStoredThemeId, applyTheme } from '../config/themes'
import { getPexelsApiKey, setPexelsApiKey } from '../services/pexelsSettings'
import WorkflowSetupSection from './WorkflowSetupSection'
import ComfyLauncherSettingsSection from './ComfyLauncherSettingsSection'
import ComfyLauncherLogViewer from './ComfyLauncherLogViewer'
import ApiKeyDialog from './ApiKeyDialog'
import {
  COMFY_PARTNER_KEY_CHANGED_EVENT,
  COMFY_PARTNER_WORKFLOWS,
  getComfyPartnerApiKey,
  openComfyPartnerDashboard,
} from '../services/comfyPartnerAuth'
import {
  DEFAULT_EDITOR_HOTKEYS,
  EDITOR_HOTKEY_DEFINITIONS,
  EDITOR_HOTKEY_PRESETS,
  formatEditorHotkey,
  getEditorHotkeys,
  getEditorHotkeyPresetMatch,
  hotkeyEventToBinding,
  isReservedEditorHotkeyBinding,
  setEditorHotkeys,
} from '../services/editorHotkeys'
import {
  DEFAULT_COMFY_PORT,
  checkLocalComfyConnection,
  getLocalComfyConnectionSync,
  hydrateLocalComfyConnection,
  parseLocalComfyPortInput,
  saveLocalComfyConnectionPort,
} from '../services/localComfyConnection'
import {
  generatePlaybackCachesForAllVideos,
  hasUsablePlaybackCache,
  isPlaybackCacheableVideoAsset,
} from '../services/playbackCache'
import {
  GENERATION_COMPLETION_SOUND_CHANGED_EVENT,
  GENERATION_COMPLETION_SOUND_OPTIONS,
  getGenerationCompletionSoundSettings,
  playGenerationCompletionSound,
  setGenerationCompletionSoundSettings,
} from '../services/generationCompletionSoundSettings'
import { useI18n } from '../i18n/I18nContext'
import {
  getShowCloudCreditBalance,
  setShowCloudCreditBalance,
} from '../services/cloudCreditDisplaySettings'
import {
  LOCAL_COMFY_RUNTIME_ID,
  getCloudRuntimeSettings,
  saveCloudRuntimeCredential,
  setImportedWorkflowRuntime,
  testCloudRuntime,
} from '../services/cloudRuntimes'

const AUTO_IMPORT_KEY = 'comfystudio-auto-import-comfy-outputs'
const OUTPUT_DIRECTORY_SETTING_KEY = 'outputDirectory'
const WORKFLOWS_DIRECTORY_SETTING_KEY = 'workflowsDirectory'
const ANIMA_LORA_FACTORY_ROOT_SETTING_KEY = 'animaLoraFactoryRootPath'
const SDXL_LORA_FACTORY_ROOT_SETTING_KEY = 'sdxlLoraFactoryRootPath'
const OUTPUT_DIRECTORY_PLACEHOLDER = 'C:\\Users\\...\\Lumeweft\\outputs'
const WORKFLOWS_DIRECTORY_PLACEHOLDER = 'C:\\Users\\...\\ComfyUI\\workflow_API'
const HOTKEY_CATEGORY_KEY = {
  'Timeline selection': 'selection',
  'Timeline editing': 'editing',
  'Timeline clip state': 'clipState',
  'Timeline navigation': 'navigation',
  'Precision editing': 'precision',
  'Timeline text': 'text',
  'Timeline transitions': 'transitions',
  'Timeline linking': 'linking',
}

const SETTINGS_SECTIONS = [
  {
    id: 'storage',
    title: 'Projects & Storage',
    icon: HardDrive,
    description: 'Choose where projects live and control auto-save behavior.',
  },
  {
    id: 'stock',
    title: 'Stock (Pexels)',
    icon: Film,
    description: 'Manage stock-media search credentials.',
  },
  {
    id: 'connection',
    title: 'Connections & Runtimes',
    icon: Server,
    description: 'Configure local ComfyUI, cloud providers, credentials, routing, and credit display.',
  },
  {
    id: 'agents',
    title: 'Agents (MCP)',
    icon: Bot,
    description: 'Connect Claude, Codex, Cursor, or other MCP clients to the open project.',
  },
  {
    id: 'launcher',
    title: 'ComfyUI Launcher',
    icon: Power,
    description: 'Let Lumeweft start, stop, and restart your local ComfyUI process.',
  },
  {
    id: 'paths',
    title: 'File Paths',
    icon: FolderOpen,
    description: 'Review output and workflow path settings.',
  },
  {
    id: 'workflow-setup',
    title: 'Workflow Setup',
    icon: Wrench,
    description: 'Scan workflows, review missing dependencies, and install curated models or node packs.',
  },
  {
    id: 'language',
    title: 'Language',
    icon: Globe2,
    description: 'Choose the language used in the Lumeweft interface.',
  },
  {
    id: 'appearance',
    title: 'Appearance',
    icon: Palette,
    description: 'Pick the editor theme that best fits your workspace.',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    icon: Volume2,
    description: 'Control completion sounds and lightweight app alerts.',
  },
  {
    id: 'hotkeys',
    title: 'Hotkeys',
    icon: Keyboard,
    description: 'Customize editor shortcuts and apply familiar keymap presets.',
  },
  {
    id: 'project',
    title: 'New Project Defaults',
    icon: Monitor,
    description: 'Set default resolution and frame rate for new projects.',
  },
]

function isValidSection(sectionId) {
  return SETTINGS_SECTIONS.some((section) => section.id === sectionId)
}

function resolveInitialSection(sectionId) {
  return isValidSection(sectionId) ? sectionId : SETTINGS_SECTIONS[0].id
}

function SettingsRailItem({ section, isActive, onSelect }) {
  const Icon = section.icon

  return (
    <button
      type="button"
      onClick={() => onSelect(section.id)}
      className={`settings-rail-item w-full rounded-xl border px-3 py-3 text-left transition-colors ${
        isActive
          ? 'border-sf-accent/40 bg-sf-accent/10 text-sf-text-primary'
          : 'border-transparent text-sf-text-secondary hover:border-sf-dark-700 hover:bg-sf-dark-800/70 hover:text-sf-text-primary'
      }`}
      aria-current={isActive ? 'page' : undefined}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
          isActive ? 'bg-sf-accent/15 text-sf-accent' : 'bg-sf-dark-800 text-sf-text-muted'
        }`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium">{section.title}</div>
        </div>
      </div>
    </button>
  )
}

function GeneralTab({ initialSection = null, initialFocusTarget = '', workflowSetupFocusIds = [] }) {
  const { language, languages, setLanguage, t } = useI18n()
  const initialComfyConnection = getLocalComfyConnectionSync()
  const [comfyPortInput, setComfyPortInput] = useState(String(initialComfyConnection.port || DEFAULT_COMFY_PORT))
  const [comfyConnectionState, setComfyConnectionState] = useState({
    status: 'idle',
    messageKey: 'settings.connection.status.endpoint',
    values: { endpoint: initialComfyConnection.httpBase },
  })
  const [outputPath, setOutputPath] = useState('')
  const [workflowPath, setWorkflowPath] = useState('')
  const [animaLoraFactoryRootPath, setAnimaLoraFactoryRootPath] = useState('')
  const [sdxlLoraFactoryRootPath, setSdxlLoraFactoryRootPath] = useState('')
  const [loraFactoryPathStatus, setLoraFactoryPathStatus] = useState({ anima: null, sdxl: null })
  const [hardwareExportFfmpegPath, setHardwareExportFfmpegPathState] = useState('')
  const [hardwareExportFfmpegStatus, setHardwareExportFfmpegStatus] = useState(null)
  const [hardwareExportFfmpegTest, setHardwareExportFfmpegTest] = useState(null)
  const [hardwareExportFfmpegBusy, setHardwareExportFfmpegBusy] = useState('')
  const [hardwareExportFfmpegMessage, setHardwareExportFfmpegMessage] = useState('')
  const hardwareExportFfmpegInputDirtyRef = useRef(false)
  const hardwareExportFfmpegStatusGenerationRef = useRef(0)
  const [activeThemeId, setActiveThemeId] = useState(() => getStoredThemeId())
  const [generationCompletionSoundSettings, setGenerationCompletionSoundSettingsState] = useState(() => (
    getGenerationCompletionSoundSettings()
  ))
  const [showCloudCreditBalance, setShowCloudCreditBalanceState] = useState(() => getShowCloudCreditBalance())
  const [pexelsApiKey, setPexelsApiKeyLocal] = useState('')
  const [comfyOrgApiKey, setComfyOrgApiKey] = useState('')
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false)
  const [cloudRuntimeSettings, setCloudRuntimeSettings] = useState({ providers: [], routing: { importedApiWorkflows: LOCAL_COMFY_RUNTIME_ID } })
  const [cloudCredentialInputs, setCloudCredentialInputs] = useState({})
  const [cloudRuntimeStatus, setCloudRuntimeStatus] = useState({ providerId: '', status: 'idle', message: '' })
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [activeSection, setActiveSection] = useState(() => resolveInitialSection(initialSection))
  const [editorHotkeys, setEditorHotkeysState] = useState(DEFAULT_EDITOR_HOTKEYS)
  const [recordingHotkeyId, setRecordingHotkeyId] = useState(null)
  const [hotkeysError, setHotkeysError] = useState('')
  const [logViewerOpen, setLogViewerOpen] = useState(false)
  const [playbackCacheConfirmOpen, setPlaybackCacheConfirmOpen] = useState(false)
  const [playbackCacheBusy, setPlaybackCacheBusy] = useState(false)
  const [playbackCacheProgress, setPlaybackCacheProgress] = useState({ completed: 0, total: 0, currentName: '' })
  const [playbackCacheMessage, setPlaybackCacheMessage] = useState('')
  const [mcpStatus, setMcpStatus] = useState(null)
  const [mcpCopied, setMcpCopied] = useState('')
  const currentHotkeyPresetId = useMemo(
    () => getEditorHotkeyPresetMatch(editorHotkeys),
    [editorHotkeys]
  )
  const assets = useAssetsStore((state) => state.assets)

  const [autoImportComfyOutputs, setAutoImportComfyOutputs] = useState(() => {
    try {
      const stored = localStorage.getItem(AUTO_IMPORT_KEY)
      if (stored === null) return true // default ON
      return stored === 'true'
    } catch {
      return true
    }
  })

  const {
    defaultProjectsLocation,
    selectDefaultProjectsLocation,
    autoSaveEnabled,
    setAutoSaveEnabled,
    reopenLastProjectOnStartup,
    setReopenLastProjectOnStartup,
    showHeroBackground,
    setShowHeroBackground,
    currentProject,
    currentProjectHandle,
    closeProject,
    defaultResolution,
    defaultFps,
    setDefaultProjectSettings,
  } = useProjectStore()
  const showTimelineClipThumbnails = useTimelineStore((state) => state.showTimelineClipThumbnails)
  const setShowTimelineClipThumbnails = useTimelineStore((state) => state.setShowTimelineClipThumbnails)

  useEffect(() => {
    getPexelsApiKey().then((key) => setPexelsApiKeyLocal(key || ''))
    ;(async () => {
      const hardwareFfmpegStatusGeneration = hardwareExportFfmpegStatusGenerationRef.current
      try {
        const [storedOutputPath, storedWorkflowPath, storedAnimaFactoryPath, storedSdxlFactoryPath, hardwareFfmpegStatus] = await Promise.all([
          window.electronAPI?.getSetting?.(OUTPUT_DIRECTORY_SETTING_KEY),
          window.electronAPI?.getSetting?.(WORKFLOWS_DIRECTORY_SETTING_KEY),
          window.electronAPI?.getSetting?.(ANIMA_LORA_FACTORY_ROOT_SETTING_KEY),
          window.electronAPI?.getSetting?.(SDXL_LORA_FACTORY_ROOT_SETTING_KEY),
          window.electronAPI?.getHardwareExportFfmpegStatus?.(),
        ])
        setOutputPath(String(storedOutputPath || ''))
        setWorkflowPath(String(storedWorkflowPath || ''))
        setAnimaLoraFactoryRootPath(String(storedAnimaFactoryPath || ''))
        setSdxlLoraFactoryRootPath(String(storedSdxlFactoryPath || ''))
        if (window.electronAPI?.validateLoraFactoryRoot) {
          const [animaStatus, sdxlStatus] = await Promise.all([
            storedAnimaFactoryPath ? window.electronAPI.validateLoraFactoryRoot(storedAnimaFactoryPath) : null,
            storedSdxlFactoryPath ? window.electronAPI.validateLoraFactoryRoot(storedSdxlFactoryPath) : null,
          ])
          setLoraFactoryPathStatus({ anima: animaStatus, sdxl: sdxlStatus })
        }
        if (
          hardwareFfmpegStatus
          && hardwareFfmpegStatusGeneration === hardwareExportFfmpegStatusGenerationRef.current
        ) {
          if (!hardwareExportFfmpegInputDirtyRef.current) {
            setHardwareExportFfmpegPathState(String(hardwareFfmpegStatus.settingPath || ''))
          }
          setHardwareExportFfmpegStatus(hardwareFfmpegStatus)
        }
      } catch {
        setOutputPath('')
        setWorkflowPath('')
        setAnimaLoraFactoryRootPath('')
        setSdxlLoraFactoryRootPath('')
        setLoraFactoryPathStatus({ anima: null, sdxl: null })
        if (hardwareFfmpegStatusGeneration === hardwareExportFfmpegStatusGenerationRef.current) {
          setHardwareExportFfmpegStatus(null)
        }
      }

      try {
        setEditorHotkeysState(await getEditorHotkeys())
      } catch {
        setEditorHotkeysState(DEFAULT_EDITOR_HOTKEYS)
      }

      try {
        const next = await getComfyPartnerApiKey()
        setComfyOrgApiKey(next)
      } catch {
        setComfyOrgApiKey('')
      }

      try {
        setCloudRuntimeSettings(await getCloudRuntimeSettings())
      } catch (error) {
        setCloudRuntimeStatus({ providerId: '', status: 'error', message: error?.message || t('settings.cloudRuntimes.loadFailed') })
      }

      try {
        const connection = await hydrateLocalComfyConnection()
        setComfyPortInput(String(connection.port || DEFAULT_COMFY_PORT))
        setComfyConnectionState({
          status: 'idle',
          messageKey: 'settings.connection.status.endpoint',
          values: { endpoint: connection.httpBase },
        })
      } catch {
        setComfyConnectionState({
          status: 'error',
          messageKey: 'settings.connection.status.loadFailed',
          values: { port: DEFAULT_COMFY_PORT },
        })
      }
    })()
  }, [])

  const handleSaveCloudCredential = async (providerId) => {
    const apiKey = String(cloudCredentialInputs[providerId] || '').trim()
    if (!apiKey) return
    setCloudRuntimeStatus({ providerId, status: 'busy', message: t('settings.cloudRuntimes.saving') })
    try {
      await saveCloudRuntimeCredential(providerId, apiKey)
      setCloudCredentialInputs((current) => ({ ...current, [providerId]: '' }))
      setCloudRuntimeSettings(await getCloudRuntimeSettings())
      setCloudRuntimeStatus({ providerId, status: 'success', message: t('settings.cloudRuntimes.saved') })
    } catch (error) {
      setCloudRuntimeStatus({ providerId, status: 'error', message: error?.message || t('settings.cloudRuntimes.saveFailed') })
    }
  }

  const handleRemoveCloudCredential = async (providerId) => {
    try {
      await saveCloudRuntimeCredential(providerId, '')
      setCloudRuntimeSettings(await getCloudRuntimeSettings())
      setCloudRuntimeStatus({ providerId, status: 'idle', message: t('settings.cloudRuntimes.removed') })
    } catch (error) {
      setCloudRuntimeStatus({ providerId, status: 'error', message: error?.message || t('settings.cloudRuntimes.removeFailed') })
    }
  }

  const handleTestCloudRuntime = async (providerId) => {
    setCloudRuntimeStatus({ providerId, status: 'busy', message: t('settings.cloudRuntimes.testing') })
    try {
      await testCloudRuntime(providerId)
      setCloudRuntimeStatus({ providerId, status: 'success', message: t('settings.cloudRuntimes.connected') })
    } catch (error) {
      setCloudRuntimeStatus({ providerId, status: 'error', message: error?.message || t('settings.cloudRuntimes.testFailed') })
    }
  }

  const handleCloudRuntimeRouting = async (runtimeId) => {
    const previous = cloudRuntimeSettings.routing?.importedApiWorkflows || LOCAL_COMFY_RUNTIME_ID
    setCloudRuntimeSettings((current) => ({ ...current, routing: { ...current.routing, importedApiWorkflows: runtimeId } }))
    try {
      await setImportedWorkflowRuntime(runtimeId)
    } catch (error) {
      setCloudRuntimeSettings((current) => ({ ...current, routing: { ...current.routing, importedApiWorkflows: previous } }))
      setCloudRuntimeStatus({ providerId: runtimeId, status: 'error', message: error?.message || t('settings.cloudRuntimes.routeFailed') })
    }
  }

  useEffect(() => {
    if (!recordingHotkeyId) return

    const handleKeyDown = (e) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        setRecordingHotkeyId(null)
        setHotkeysError('')
        return
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        setEditorHotkeysState((prev) => ({ ...prev, [recordingHotkeyId]: '' }))
        setRecordingHotkeyId(null)
        setHotkeysError('')
        return
      }

      const binding = hotkeyEventToBinding(e)
      if (!binding) return

      if (isReservedEditorHotkeyBinding(binding)) {
        setHotkeysError(`${formatEditorHotkey(binding)} is reserved for fixed shortcuts like play, step, undo, or delete.`)
        return
      }

      setEditorHotkeysState((prev) => {
        const next = { ...prev }
        for (const definition of EDITOR_HOTKEY_DEFINITIONS) {
          if (definition.id !== recordingHotkeyId && next[definition.id] === binding) {
            next[definition.id] = ''
          }
        }
        next[recordingHotkeyId] = binding
        return next
      })
      setRecordingHotkeyId(null)
      setHotkeysError('')
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [recordingHotkeyId, editorHotkeys])

  useEffect(() => {
    if (!initialSection) return
    setActiveSection(resolveInitialSection(initialSection))
  }, [initialSection])

  useEffect(() => {
    if (activeSection !== 'paths' || initialFocusTarget !== 'lora-factories') return undefined
    const timer = window.setTimeout(() => {
      document.getElementById('settings-lora-factories')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
    return () => window.clearTimeout(timer)
  }, [activeSection, initialFocusTarget])

  useEffect(() => {
    if (activeSection !== 'agents') return undefined
    let cancelled = false
    const refreshStatus = () => {
      if (!window.electronAPI?.mcp?.getStatus) {
        setMcpStatus({
          running: false,
          url: 'http://127.0.0.1:19790/mcp',
          error: 'MCP server is only available in the desktop app.',
          hasProject: false,
        })
        return
      }
      window.electronAPI.mcp.getStatus()
        .then((status) => {
          if (!cancelled) setMcpStatus(status)
        })
        .catch((error) => {
          if (!cancelled) {
            setMcpStatus({
              running: false,
              url: 'http://127.0.0.1:19790/mcp',
              error: error?.message || 'Could not read MCP status.',
              hasProject: false,
            })
          }
        })
    }
    refreshStatus()
    const timer = setInterval(refreshStatus, 2500)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [activeSection])

  useEffect(() => {
    const handler = (event) => {
      setGenerationCompletionSoundSettingsState(event?.detail || getGenerationCompletionSoundSettings())
    }
    window.addEventListener(GENERATION_COMPLETION_SOUND_CHANGED_EVENT, handler)
    return () => window.removeEventListener(GENERATION_COMPLETION_SOUND_CHANGED_EVENT, handler)
  }, [])

  // Keep the Settings view in sync if the key is saved/cleared from any
  // other surface (Onboarding, Workflow Setup gallery, Generate tab).
  useEffect(() => {
    const handler = () => {
      getComfyPartnerApiKey().then((value) => setComfyOrgApiKey(value || '')).catch(() => {})
    }
    window.addEventListener(COMFY_PARTNER_KEY_CHANGED_EVENT, handler)
    return () => window.removeEventListener(COMFY_PARTNER_KEY_CHANGED_EVENT, handler)
  }, [])

  const handleToggleAutoImportComfyOutputs = () => {
    const next = !autoImportComfyOutputs
    setAutoImportComfyOutputs(next)
    try {
      localStorage.setItem(AUTO_IMPORT_KEY, String(next))
    } catch (_) {}
  }

  const handleGenerationCompletionSoundChange = (updates) => {
    const next = setGenerationCompletionSoundSettings({
      ...generationCompletionSoundSettings,
      ...updates,
    })
    setGenerationCompletionSoundSettingsState(next)
  }

  const handleToggleCloudCreditBalance = () => {
    const next = setShowCloudCreditBalance(!showCloudCreditBalance)
    setShowCloudCreditBalanceState(next)
  }

  const handleCopyMcpText = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text)
      setMcpCopied(id)
      setTimeout(() => setMcpCopied((current) => (current === id ? '' : current)), 1800)
    } catch (error) {
      console.warn('Could not copy MCP text:', error)
    }
  }

  const handleSavePexelsKey = () => {
    setPexelsApiKey(pexelsApiKey.trim()).catch(console.error)
  }

  const handleSaveComfyConnection = async () => {
    const result = await saveLocalComfyConnectionPort(comfyPortInput)
    if (!result.success) {
      setComfyConnectionState({
        status: 'error',
        messageKey: 'settings.connection.status.invalidConfiguration',
      })
      return false
    }

    setComfyPortInput(String(result.config.port))
    setComfyConnectionState({
      status: 'idle',
      messageKey: 'settings.connection.status.savedEndpoint',
      values: { endpoint: result.config.httpBase },
    })
    return true
  }

  const handleTestComfyConnection = async () => {
    const parsed = parseLocalComfyPortInput(comfyPortInput)
    if (!parsed.success) {
      setComfyConnectionState({
        status: 'error',
        messageKey: 'settings.connection.status.invalidPort',
      })
      return
    }

    setComfyConnectionState({
      status: 'testing',
      messageKey: 'settings.connection.status.testing',
      values: { endpoint: `localhost:${parsed.port}` },
    })

    const testResult = await checkLocalComfyConnection({ port: parsed.port })
    if (testResult.ok) {
      setComfyConnectionState({
        status: 'success',
        messageKey: 'settings.connection.status.connected',
        values: { endpoint: testResult.httpBase },
      })
      return
    }

    setComfyConnectionState({
      status: 'error',
      messageKey: testResult.status === 403
        ? 'settings.connection.status.http403'
        : testResult.status
          ? 'settings.connection.status.httpError'
          : 'settings.connection.status.connectFailed',
      values: {
        endpoint: testResult.httpBase || `http://127.0.0.1:${parsed.port}`,
        status: testResult.status,
      },
    })
  }

  const handleResetComfyConnection = async () => {
    setComfyPortInput(String(DEFAULT_COMFY_PORT))
    const result = await saveLocalComfyConnectionPort(DEFAULT_COMFY_PORT)
    if (!result.success) {
      setComfyConnectionState({
        status: 'error',
        messageKey: 'settings.connection.status.resetFailed',
      })
      return
    }
    setComfyConnectionState({
      status: 'idle',
      messageKey: 'settings.connection.status.resetEndpoint',
      values: { endpoint: result.config.httpBase },
    })
  }

  const handleChooseDirectory = async ({ title, currentPath, onSelect }) => {
    if (!window.electronAPI?.selectDirectory) {
      console.warn('Directory picker is not available in this environment.')
      return
    }

    try {
      const selectedPath = await window.electronAPI.selectDirectory({
        title,
        defaultPath: currentPath || undefined,
      })
      if (selectedPath) onSelect(selectedPath)
    } catch (error) {
      console.error('Could not open directory picker:', error)
    }
  }

  const handleChooseLoraFactoryRoot = async (factoryType) => {
    const isAnima = factoryType === 'anima'
    const currentPath = isAnima ? animaLoraFactoryRootPath : sdxlLoraFactoryRootPath
    await handleChooseDirectory({
      title: t(isAnima ? 'settings.paths.selectAnimaFactory' : 'settings.paths.selectSdxlFactory'),
      currentPath,
      onSelect: async (selectedPath) => {
        if (isAnima) setAnimaLoraFactoryRootPath(selectedPath)
        else setSdxlLoraFactoryRootPath(selectedPath)
        const status = await window.electronAPI?.validateLoraFactoryRoot?.(selectedPath)
        setLoraFactoryPathStatus((previous) => ({ ...previous, [factoryType]: status || null }))
      },
    })
  }

  const handleChooseHardwareExportFfmpeg = async () => {
    if (!window.electronAPI?.selectFile) {
      setHardwareExportFfmpegMessage(t('settings.paths.hardwareFfmpeg.filePickerUnavailable'))
      return
    }
    try {
      const selectedPath = await window.electronAPI.selectFile({
        title: t('settings.paths.hardwareFfmpeg.selectTitle'),
        defaultPath: hardwareExportFfmpegPath || hardwareExportFfmpegStatus?.activePath || undefined,
        filters: [{ name: t('settings.paths.hardwareFfmpeg.executable'), extensions: ['*'] }],
      })
      if (selectedPath) {
        hardwareExportFfmpegInputDirtyRef.current = true
        setHardwareExportFfmpegPathState(String(selectedPath))
        setHardwareExportFfmpegTest(null)
        setHardwareExportFfmpegMessage(t('settings.paths.hardwareFfmpeg.pathSelected'))
      }
    } catch (error) {
      setHardwareExportFfmpegMessage(error?.message || t('settings.paths.hardwareFfmpeg.chooseFailed'))
    }
  }

  const handleSaveHardwareExportFfmpeg = async () => {
    const selectedPath = hardwareExportFfmpegPath.trim()
    if (!selectedPath) {
      setHardwareExportFfmpegMessage(t('settings.paths.hardwareFfmpeg.chooseOrBundled'))
      return
    }
    if (!window.electronAPI?.setHardwareExportFfmpegPath) {
      setHardwareExportFfmpegMessage(t('settings.paths.hardwareFfmpeg.settingsUnavailable'))
      return
    }

    hardwareExportFfmpegStatusGenerationRef.current += 1
    setHardwareExportFfmpegBusy('saving')
    setHardwareExportFfmpegTest(null)
    setHardwareExportFfmpegMessage(t('settings.paths.hardwareFfmpeg.validating'))
    try {
      const result = await window.electronAPI.setHardwareExportFfmpegPath(selectedPath)
      if (!result?.success) {
        setHardwareExportFfmpegMessage(result?.error || t('settings.paths.hardwareFfmpeg.saveFailed'))
        return
      }
      setHardwareExportFfmpegStatus(result.status || null)
      setHardwareExportFfmpegPathState(String(result.status?.settingPath || selectedPath))
      hardwareExportFfmpegInputDirtyRef.current = false
      setHardwareExportFfmpegMessage(
        result.status?.source === 'environment'
          ? t('settings.paths.hardwareFfmpeg.savedEnvironmentPriority')
          : t('settings.paths.hardwareFfmpeg.savedReady')
      )
    } catch (error) {
      setHardwareExportFfmpegMessage(error?.message || t('settings.paths.hardwareFfmpeg.savePathFailed'))
    } finally {
      setHardwareExportFfmpegBusy('')
    }
  }

  const handleResetHardwareExportFfmpeg = async () => {
    if (!window.electronAPI?.resetHardwareExportFfmpegPath) return
    hardwareExportFfmpegStatusGenerationRef.current += 1
    setHardwareExportFfmpegBusy('resetting')
    setHardwareExportFfmpegTest(null)
    try {
      const result = await window.electronAPI.resetHardwareExportFfmpegPath()
      if (!result?.success) {
        setHardwareExportFfmpegMessage(result?.error || t('settings.paths.hardwareFfmpeg.restoreFailed'))
        return
      }
      setHardwareExportFfmpegPathState('')
      hardwareExportFfmpegInputDirtyRef.current = false
      setHardwareExportFfmpegStatus(result.status || null)
      setHardwareExportFfmpegMessage(
        result.status?.source === 'environment'
          ? t('settings.paths.hardwareFfmpeg.clearedEnvironmentActive')
          : t('settings.paths.hardwareFfmpeg.bundledRestored')
      )
    } catch (error) {
      setHardwareExportFfmpegMessage(error?.message || t('settings.paths.hardwareFfmpeg.restoreFailed'))
    } finally {
      setHardwareExportFfmpegBusy('')
    }
  }

  const handleTestHardwareExportFfmpeg = async () => {
    if (!window.electronAPI?.checkNvenc) return
    hardwareExportFfmpegStatusGenerationRef.current += 1
    setHardwareExportFfmpegBusy('testing')
    setHardwareExportFfmpegMessage(t('settings.paths.hardwareFfmpeg.testing'))
    try {
      const result = await window.electronAPI.checkNvenc({ forceRefresh: true })
      setHardwareExportFfmpegTest(result)
      const status = await window.electronAPI.getHardwareExportFfmpegStatus?.()
      if (status) setHardwareExportFfmpegStatus(status)
      if (result?.available) {
        const codecs = [result.h264 ? 'H.264' : '', result.h265 ? 'H.265' : ''].filter(Boolean).join(' / ')
        setHardwareExportFfmpegMessage(t('settings.paths.hardwareFfmpeg.encodingReady', { codecs }))
      } else {
        setHardwareExportFfmpegMessage(result?.error || t('settings.paths.hardwareFfmpeg.encoderUnavailable'))
      }
    } catch (error) {
      setHardwareExportFfmpegTest(null)
      setHardwareExportFfmpegMessage(error?.message || t('settings.paths.hardwareFfmpeg.testFailed'))
    } finally {
      setHardwareExportFfmpegBusy('')
    }
  }

  const handleSaveFilePathSettings = async () => {
    try {
      const normalizedAnimaFactoryPath = animaLoraFactoryRootPath.trim()
      const normalizedSdxlFactoryPath = sdxlLoraFactoryRootPath.trim()
      const [animaStatus, sdxlStatus] = await Promise.all([
        normalizedAnimaFactoryPath ? window.electronAPI?.validateLoraFactoryRoot?.(normalizedAnimaFactoryPath) : null,
        normalizedSdxlFactoryPath ? window.electronAPI?.validateLoraFactoryRoot?.(normalizedSdxlFactoryPath) : null,
      ])
      setLoraFactoryPathStatus({ anima: animaStatus, sdxl: sdxlStatus })
      if ((normalizedAnimaFactoryPath && !animaStatus?.isValid) || (normalizedSdxlFactoryPath && !sdxlStatus?.isValid)) {
        return false
      }
      const [outputResult, workflowResult, animaFactoryResult, sdxlFactoryResult] = await Promise.all([
        window.electronAPI?.setSetting?.(OUTPUT_DIRECTORY_SETTING_KEY, outputPath.trim()),
        window.electronAPI?.setSetting?.(WORKFLOWS_DIRECTORY_SETTING_KEY, workflowPath.trim()),
        window.electronAPI?.setSetting?.(ANIMA_LORA_FACTORY_ROOT_SETTING_KEY, normalizedAnimaFactoryPath),
        window.electronAPI?.setSetting?.(SDXL_LORA_FACTORY_ROOT_SETTING_KEY, normalizedSdxlFactoryPath),
      ])

      return outputResult?.success !== false
        && workflowResult?.success !== false
        && animaFactoryResult?.success !== false
        && sdxlFactoryResult?.success !== false
    } catch (error) {
      console.error('Could not save file path settings:', error)
      return false
    }
  }

  const handleSaveAllSettings = async () => {
    await setPexelsApiKey(pexelsApiKey.trim())
    await setEditorHotkeys(editorHotkeys)
    const [connectionSaved, filePathsSaved] = await Promise.all([
      handleSaveComfyConnection(),
      handleSaveFilePathSettings(),
    ])
    if (connectionSaved && filePathsSaved) {
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2000)
    } else {
      setSettingsSaved(false)
    }
  }

  const playbackCacheCoverage = useMemo(() => {
    const videoAssets = (assets || []).filter((asset) => asset?.type === 'video')
    const cacheableAssets = videoAssets.filter(isPlaybackCacheableVideoAsset)
    const ready = videoAssets.filter(hasUsablePlaybackCache).length
    const encoding = videoAssets.filter((asset) => asset?.playbackCacheStatus === 'encoding').length
    const failed = cacheableAssets.filter((asset) => asset?.playbackCacheStatus === 'failed').length
    return {
      total: videoAssets.length,
      cacheable: cacheableAssets.length,
      rebuildable: cacheableAssets.filter((asset) => asset?.playbackCacheStatus !== 'encoding').length,
      ready,
      encoding,
      failed,
      unavailable: videoAssets.length - cacheableAssets.length,
    }
  }, [assets])

  const handleRebuildVideoPlaybackCache = async () => {
    if (!currentProjectHandle || playbackCacheBusy || playbackCacheCoverage.rebuildable <= 0) return

    const expectedTotal = (useAssetsStore.getState().assets || [])
      .filter((asset) => isPlaybackCacheableVideoAsset(asset) && asset?.playbackCacheStatus !== 'encoding')
      .length
    if (expectedTotal <= 0) return

    setPlaybackCacheConfirmOpen(false)
    setPlaybackCacheBusy(true)
    setPlaybackCacheMessage('')
    setPlaybackCacheProgress({ completed: 0, total: expectedTotal, currentName: '' })

    try {
      let completed = 0
      let currentName = ''
      const summary = await generatePlaybackCachesForAllVideos(currentProjectHandle, {
        force: true,
        onStart: (asset) => {
          currentName = asset?.name || asset?.id || 'Video'
          setPlaybackCacheProgress((prev) => ({
            ...prev,
            currentName,
          }))
        },
        onFinish: (asset) => {
          completed += 1
          setPlaybackCacheProgress({
            completed,
            total: expectedTotal,
            currentName: asset?.name || currentName,
          })
        },
      })

      setPlaybackCacheMessage(
        summary?.success
          ? t(summary.encoded === 1 ? 'settings.storage.cache.rebuildCompleteOne' : 'settings.storage.cache.rebuildCompleteMany', {
              encoded: summary.encoded,
              failed: summary.failed
                ? t('settings.storage.cache.failedSuffix', { count: summary.failed })
                : '',
            })
          : (summary?.error || t('settings.storage.cache.rebuildFailed'))
      )
    } catch (error) {
      setPlaybackCacheMessage(error?.message || t('settings.storage.cache.rebuildFailed'))
    } finally {
      setPlaybackCacheBusy(false)
      setPlaybackCacheProgress({ completed: 0, total: 0, currentName: '' })
    }
  }

  const localizedSections = useMemo(() => SETTINGS_SECTIONS.map((section) => ({
    ...section,
    title: t(`settings.sections.${section.id}.title`, undefined, section.title),
    description: t(`settings.sections.${section.id}.description`, undefined, section.description),
  })), [t])
  const activeSectionMeta = useMemo(
    () => localizedSections.find((section) => section.id === activeSection) || localizedSections[0],
    [activeSection, localizedSections]
  )
  const isWorkflowSetupActive = activeSection === 'workflow-setup'

  let activeSectionContent = null

  switch (activeSection) {
    case 'storage':
      activeSectionContent = (
        <div className="space-y-5">
          <div>
            <label className="block text-xs text-sf-text-muted mb-1">{t('settings.storage.projectsLocation')}</label>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0 bg-sf-dark-800 border border-sf-dark-600 rounded px-3 py-2 text-xs text-sf-text-primary truncate">
                {defaultProjectsLocation || t('common.notSet')}
              </div>
              <button
                onClick={selectDefaultProjectsLocation}
                className="px-3 py-2 bg-sf-dark-700 hover:bg-sf-dark-600 rounded text-xs text-sf-text-secondary transition-colors flex-shrink-0"
              >
                {t('common.change')}
              </button>
            </div>
            <p className="text-[10px] text-sf-text-muted mt-1">{t('settings.storage.projectsLocationHelp')}</p>
          </div>

          {currentProject && (
            <div>
              <label className="block text-xs text-sf-text-muted mb-1">{t('settings.storage.currentProject')}</label>
              <div className="bg-sf-dark-800 border border-sf-dark-600 rounded px-3 py-2">
                <p className="text-sm text-sf-text-primary truncate">{currentProject.name}</p>
                <p className="text-[10px] text-sf-text-muted mt-0.5">
                  {t('settings.storage.projectSummary', {
                    width: currentProject.settings?.width,
                    height: currentProject.settings?.height,
                    fps: currentProject.settings?.fps,
                  })}
                </p>
              </div>
              <button
                onClick={closeProject}
                className="mt-2 w-full px-3 py-2 bg-sf-dark-700 hover:bg-sf-dark-600 rounded text-xs text-sf-text-secondary transition-colors"
              >
                {t('settings.storage.closeProject')}
              </button>
            </div>
          )}

          <div className="rounded-lg border border-sf-dark-700 bg-sf-dark-900/60 px-3 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <label className="text-sm text-sf-text-primary">{t('settings.storage.cache.title')}</label>
                <p className="mt-1 text-[10px] text-sf-text-muted">
                  {t('settings.storage.cache.description')}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                  <span className="rounded bg-sf-dark-800 px-2 py-1 text-sf-text-secondary">
                    {t('settings.storage.cache.ready', {
                      ready: playbackCacheCoverage.ready,
                      total: playbackCacheCoverage.total,
                    })}
                  </span>
                  {playbackCacheCoverage.encoding > 0 && (
                    <span className="rounded bg-blue-900/40 px-2 py-1 text-blue-200">
                      {t('settings.storage.cache.encoding', { count: playbackCacheCoverage.encoding })}
                    </span>
                  )}
                  {playbackCacheCoverage.failed > 0 && (
                    <span className="rounded bg-amber-900/40 px-2 py-1 text-amber-200">
                      {t('settings.storage.cache.failed', { count: playbackCacheCoverage.failed })}
                    </span>
                  )}
                  {playbackCacheCoverage.unavailable > 0 && (
                    <span className="rounded bg-sf-dark-800 px-2 py-1 text-sf-text-muted">
                      {t('settings.storage.cache.unavailable', { count: playbackCacheCoverage.unavailable })}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPlaybackCacheMessage('')
                  setPlaybackCacheConfirmOpen(true)
                }}
                disabled={playbackCacheBusy || !currentProjectHandle || playbackCacheCoverage.rebuildable <= 0}
                className="inline-flex flex-shrink-0 items-center gap-2 rounded bg-sf-dark-700 px-3 py-2 text-xs text-sf-text-secondary transition-colors hover:bg-sf-dark-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {playbackCacheBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCcw className="h-3.5 w-3.5" />
                )}
                {playbackCacheBusy ? t('settings.storage.cache.rebuilding') : t('settings.storage.cache.rebuild')}
              </button>
            </div>

            {playbackCacheConfirmOpen && !playbackCacheBusy && (
              <div className="mt-3 rounded border border-amber-700/40 bg-amber-950/30 px-3 py-3">
                <p className="text-xs text-amber-100">
                  {t(
                    playbackCacheCoverage.rebuildable === 1
                      ? 'settings.storage.cache.confirmOne'
                      : 'settings.storage.cache.confirmMany',
                    { count: playbackCacheCoverage.rebuildable }
                  )}
                </p>
                <p className="mt-1 text-[10px] text-amber-200/80">
                  {t('settings.storage.cache.confirmHelp')}
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPlaybackCacheConfirmOpen(false)}
                    className="rounded bg-sf-dark-800 px-3 py-1.5 text-xs text-sf-text-secondary hover:bg-sf-dark-700"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { void handleRebuildVideoPlaybackCache() }}
                    className="rounded bg-sf-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-sf-accent-hover"
                  >
                    {t('settings.storage.cache.startRebuild')}
                  </button>
                </div>
              </div>
            )}

            {playbackCacheBusy && (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between gap-3 text-[10px] text-sf-text-muted">
                  <span className="truncate">
                    {playbackCacheProgress.currentName || t('settings.storage.cache.preparing')}
                  </span>
                  <span className="flex-shrink-0">
                    {playbackCacheProgress.completed}/{playbackCacheProgress.total || playbackCacheCoverage.rebuildable}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-sf-dark-800">
                  <div
                    className="h-full rounded-full bg-sf-accent transition-all"
                    style={{
                      width: `${Math.min(100, Math.round((playbackCacheProgress.completed / Math.max(1, playbackCacheProgress.total || playbackCacheCoverage.rebuildable)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {playbackCacheMessage && !playbackCacheBusy && (
              <p className="mt-3 text-[10px] text-sf-text-muted">{playbackCacheMessage}</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-sf-dark-700 bg-sf-dark-900/60 px-3 py-3">
            <div>
              <label className="text-sm text-sf-text-primary">{t('settings.storage.autoSave')}</label>
              <p className="text-[10px] text-sf-text-muted">{t('settings.storage.autoSaveHelp')}</p>
            </div>
            <button
              onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
              className={`w-10 h-5 rounded-full transition-colors ${autoSaveEnabled ? 'bg-sf-accent' : 'bg-sf-dark-600'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${autoSaveEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-sf-dark-700 bg-sf-dark-900/60 px-3 py-3">
            <div>
              <label className="text-sm text-sf-text-primary">{t('settings.storage.reopenLastProject')}</label>
              <p className="text-[10px] text-sf-text-muted">{t('settings.storage.reopenLastProjectHelp')}</p>
            </div>
            <button
              onClick={() => setReopenLastProjectOnStartup(!reopenLastProjectOnStartup)}
              className={`w-10 h-5 rounded-full transition-colors ${reopenLastProjectOnStartup ? 'bg-sf-accent' : 'bg-sf-dark-600'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${reopenLastProjectOnStartup ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-sf-dark-700 bg-sf-dark-900/60 px-3 py-3">
            <div>
              <label className="text-sm text-sf-text-primary">{t('settings.storage.showHero')}</label>
              <p className="text-[10px] text-sf-text-muted">{t('settings.storage.showHeroHelp')}</p>
            </div>
            <button
              onClick={() => setShowHeroBackground(!showHeroBackground)}
              className={`w-10 h-5 rounded-full transition-colors ${showHeroBackground ? 'bg-sf-accent' : 'bg-sf-dark-600'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${showHeroBackground ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      )
      break
    case 'stock':
      activeSectionContent = (
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-sf-text-muted mb-1">API Key</label>
            <input
              type="password"
              value={pexelsApiKey}
              onChange={(e) => setPexelsApiKeyLocal(e.target.value)}
              onBlur={handleSavePexelsKey}
              placeholder="Your Pexels API key"
              className="w-full bg-sf-dark-800 border border-sf-dark-600 rounded px-3 py-2 text-sm text-sf-text-primary placeholder-sf-text-muted focus:outline-none focus:border-sf-accent"
            />
            <p className="text-[10px] text-sf-text-muted mt-1">
              Free at{' '}
              <a href="https://www.pexels.com/api/" target="_blank" rel="noopener noreferrer" className="text-sf-accent hover:underline">
                pexels.com/api
              </a>
              . Used by the Stock tab to search photos and videos.
            </p>
          </div>
        </div>
      )
      break
    case 'connection':
      activeSectionContent = (
        <section className="overflow-hidden rounded-xl border border-sf-dark-700 bg-sf-dark-900/35">
          <div className="flex items-start gap-2.5 px-4 py-3.5">
            <div className="rounded-md bg-sf-dark-800 p-2"><Server className="h-4 w-4 text-sf-accent" /></div>
            <div>
              <div className="text-sm font-medium text-sf-text-primary">{t('settings.connection.localGroupTitle')}</div>
              <p className="mt-1 text-[11px] text-sf-text-muted">{t('settings.connection.localGroupHelp')}</p>
            </div>
          </div>
          <div className="space-y-3 border-t border-sf-dark-700 px-4 py-4">
            <div>
              <label className="mb-1 block text-xs text-sf-text-muted">{t('settings.connection.localPort')}</label>
              <input
                type="number"
                min={1}
                max={65535}
                step={1}
                value={comfyPortInput}
                onChange={(e) => setComfyPortInput(e.target.value)}
                onBlur={() => { void handleSaveComfyConnection() }}
                placeholder={String(DEFAULT_COMFY_PORT)}
                className="w-full rounded border border-sf-dark-600 bg-sf-dark-800 px-3 py-2 text-sm text-sf-text-primary focus:border-sf-accent focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-sf-text-muted">{t('settings.connection.localOnlyHelp')}</p>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-sf-dark-700 bg-sf-dark-900/60 px-3 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${
                  comfyConnectionState.status === 'success'
                    ? 'bg-sf-success'
                    : comfyConnectionState.status === 'error'
                      ? 'bg-red-500'
                      : comfyConnectionState.status === 'testing'
                        ? 'animate-pulse bg-yellow-400'
                        : 'bg-sf-dark-500'
                }`} />
                <span className="truncate text-xs text-sf-text-muted">
                  {t(comfyConnectionState.messageKey, comfyConnectionState.values)}
                </span>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1.5">
                <button type="button" onClick={() => { void handleResetComfyConnection() }} className="rounded bg-sf-dark-700 px-3 py-1.5 text-xs text-sf-text-secondary transition-colors hover:bg-sf-dark-600">
                  {t('settings.connection.reset')}
                </button>
                <button type="button" onClick={() => { void handleTestComfyConnection() }} className="rounded bg-sf-dark-700 px-3 py-1.5 text-xs text-sf-text-secondary transition-colors hover:bg-sf-dark-600">
                  {t('settings.connection.test')}
                </button>
              </div>
            </div>
          </div>
        </section>
      )
      // Compose provider credentials/routing into the same connection page.
      // The legacy case label keeps old deep links harmless during migration.
    case 'cloud-runtimes': {
      const connectionContent = activeSectionContent
      activeSectionContent = (
        <div className="space-y-5">
          {connectionContent}

          <section className="overflow-hidden rounded-xl border border-sf-dark-700 bg-sf-dark-900/35">
            <div className="flex items-start gap-2.5 px-4 py-3.5">
              <div className="rounded-md bg-sf-dark-800 p-2"><Cloud className="h-4 w-4 text-sf-accent" /></div>
              <div>
                <div className="text-sm font-medium text-sf-text-primary">{t('settings.cloudRuntimes.title')}</div>
                <p className="mt-1 text-[11px] text-sf-text-muted">{t('settings.cloudRuntimes.intro')}</p>
              </div>
            </div>

            <div className="space-y-4 border-t border-sf-dark-700 px-4 py-4">
              <div className="rounded-lg border border-sf-dark-700 bg-sf-dark-900/60 p-3">
                <label className="mb-1 block text-xs font-medium text-sf-text-secondary">{t('settings.cloudRuntimes.importedWorkflowRuntime')}</label>
                <select
                  value={cloudRuntimeSettings.routing?.importedApiWorkflows || LOCAL_COMFY_RUNTIME_ID}
                  onChange={(event) => { void handleCloudRuntimeRouting(event.target.value) }}
                  className="w-full rounded border border-sf-dark-600 bg-sf-dark-800 px-3 py-2 text-sm text-sf-text-primary focus:border-sf-accent focus:outline-none"
                >
                  <option value={LOCAL_COMFY_RUNTIME_ID}>{t('settings.cloudRuntimes.localComfy')}</option>
                  {cloudRuntimeSettings.providers.map((provider) => (
                    <option key={provider.id} value={provider.id} disabled={!provider.hasCredential}>{provider.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-sf-text-muted">{t('settings.cloudRuntimes.routingHelp')}</p>
              </div>

              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-sf-text-muted">{t('settings.cloudRuntimes.credentialsTitle')}</div>
                <div className="rounded-lg border border-sf-dark-700 bg-sf-dark-900/60 px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="flex-shrink-0 rounded-md bg-sf-dark-800 p-2">
                        <KeyRound className="h-4 w-4 text-sf-accent" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-sf-text-primary">{t('settings.connection.cloudKeyTitle')}</div>
                        <div className="mt-0.5 text-[11px] text-sf-text-muted">
                          {t('settings.connection.cloudKeyHelp', { count: COMFY_PARTNER_WORKFLOWS.length })}
                        </div>
                        <div className="mt-1.5 text-[11px]">
                          {comfyOrgApiKey ? (
                            <span className="inline-flex items-center gap-1 text-green-400">
                              <CheckCircle2 className="h-3 w-3" />
                              {t('settings.connection.keyReady')}
                            </span>
                          ) : (
                            <span className="text-yellow-300">{t('settings.connection.noKey')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                      <button type="button" onClick={() => setApiKeyDialogOpen(true)} className="rounded bg-sf-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sf-accent/90">
                        {comfyOrgApiKey ? t('settings.connection.changeKey') : t('settings.connection.addKey')}
                      </button>
                      <button type="button" onClick={() => { void openComfyPartnerDashboard() }} className="inline-flex items-center gap-1 text-[11px] text-sf-text-muted hover:text-sf-text-primary">
                        <ExternalLink className="h-3 w-3" />
                        {t('settings.connection.getKey')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {cloudRuntimeSettings.providers.map((provider) => {
            const providerBusy = cloudRuntimeStatus.providerId === provider.id && cloudRuntimeStatus.status === 'busy'
            return (
              <div key={provider.id} className="space-y-3 rounded-lg border border-sf-dark-700 bg-sf-dark-900/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-sf-text-primary">{provider.name}</div>
                    <p className="mt-1 text-[11px] text-sf-text-muted">{t(`settings.cloudRuntimes.providers.${provider.id}.description`, undefined, provider.description)}</p>
                  </div>
                  <span className={`text-[10px] ${provider.hasCredential ? 'text-green-400' : 'text-yellow-300'}`}>
                    {provider.credentialFromEnvironment
                      ? t('settings.cloudRuntimes.environmentCredential', { key: provider.environmentKey })
                      : provider.hasCredential ? t('settings.cloudRuntimes.credentialReady') : t('settings.cloudRuntimes.noCredential')}
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={cloudCredentialInputs[provider.id] || ''}
                    onChange={(event) => setCloudCredentialInputs((current) => ({ ...current, [provider.id]: event.target.value }))}
                    placeholder={provider.hasCredential ? t('settings.cloudRuntimes.credentialSaved') : t('settings.cloudRuntimes.credentialPlaceholder', { provider: provider.name })}
                    disabled={provider.credentialFromEnvironment}
                    className="min-w-0 flex-1 rounded border border-sf-dark-600 bg-sf-dark-800 px-3 py-2 text-sm text-sf-text-primary placeholder-sf-text-muted focus:border-sf-accent focus:outline-none disabled:opacity-60"
                  />
                  <button type="button" onClick={() => { void handleSaveCloudCredential(provider.id) }} disabled={!String(cloudCredentialInputs[provider.id] || '').trim() || provider.credentialFromEnvironment || providerBusy} className="rounded bg-sf-accent px-3 py-2 text-xs font-medium text-white disabled:opacity-50">
                    {t('settings.cloudRuntimes.save')}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex gap-3 text-[11px]">
                    <a href={provider.dashboardUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sf-accent hover:underline"><ExternalLink className="h-3 w-3" />{t('settings.cloudRuntimes.dashboard')}</a>
                    <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sf-text-muted hover:text-sf-text-primary"><ExternalLink className="h-3 w-3" />{t('settings.cloudRuntimes.docs')}</a>
                  </div>
                  <div className="flex items-center gap-2">
                    {provider.hasCredential && !provider.credentialFromEnvironment && <button type="button" onClick={() => { void handleRemoveCloudCredential(provider.id) }} className="text-[11px] text-sf-text-muted hover:text-red-300">{t('settings.cloudRuntimes.remove')}</button>}
                    <button type="button" onClick={() => { void handleTestCloudRuntime(provider.id) }} disabled={!provider.hasCredential || providerBusy} className="rounded bg-sf-dark-700 px-3 py-1.5 text-xs text-sf-text-secondary hover:bg-sf-dark-600 disabled:opacity-50">
                      {providerBusy ? t('settings.cloudRuntimes.checking') : t('settings.cloudRuntimes.test')}
                    </button>
                  </div>
                </div>
                {cloudRuntimeStatus.providerId === provider.id && cloudRuntimeStatus.message && (
                  <div className={`rounded border px-3 py-2 text-xs ${cloudRuntimeStatus.status === 'error' ? 'border-red-800/60 bg-red-950/30 text-red-300' : cloudRuntimeStatus.status === 'success' ? 'border-green-800/60 bg-green-950/30 text-green-300' : 'border-sf-dark-700 text-sf-text-muted'}`}>
                    {cloudRuntimeStatus.message}
                  </div>
                )}
              </div>
            )
              })}

              <div className="flex items-center justify-between rounded-lg border border-sf-dark-700 bg-sf-dark-900/60 px-3 py-3">
                <div className="pr-4">
                  <label className="text-sm text-sf-text-primary">{t('settings.cloudRuntimes.showBalance')}</label>
                  <p className="text-[10px] text-sf-text-muted">{t('settings.cloudRuntimes.showBalanceHelp')}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showCloudCreditBalance}
                  onClick={handleToggleCloudCreditBalance}
                  className={`relative h-5 w-10 flex-shrink-0 rounded-full transition-colors ${showCloudCreditBalance ? 'bg-sf-accent' : 'bg-sf-dark-600'}`}
                  title={showCloudCreditBalance ? t('settings.cloudRuntimes.hideBalance') : t('settings.cloudRuntimes.showBalance')}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${showCloudCreditBalance ? 'left-[calc(100%-1.25rem)]' : 'left-0.5'}`} aria-hidden />
                </button>
              </div>
              <p className="text-[10px] text-amber-300/80">{t('settings.cloudRuntimes.costNotice')}</p>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-sf-dark-700 bg-sf-dark-900/35">
            <div className="flex items-start gap-2.5 px-4 py-3.5">
              <div className="rounded-md bg-sf-dark-800 p-2"><FolderOpen className="h-4 w-4 text-sf-accent" /></div>
              <div>
                <div className="text-sm font-medium text-sf-text-primary">{t('settings.connection.importGroupTitle')}</div>
                <p className="mt-1 text-[11px] text-sf-text-muted">{t('settings.connection.importGroupHelp')}</p>
              </div>
            </div>
            <div className="border-t border-sf-dark-700 px-4 py-4">
              <div className="flex items-center justify-between rounded-lg border border-sf-dark-700 bg-sf-dark-900/60 px-3 py-3">
                <div className="pr-4">
                  <label className="text-sm text-sf-text-primary">{t('settings.connection.autoImport')}</label>
                  <p className="text-[10px] text-sf-text-muted">
                    {t('settings.connection.autoImportHelpBefore')} <span className="text-sf-text-secondary">Imported from ComfyUI/</span> {t('settings.connection.autoImportHelpAfter')}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoImportComfyOutputs}
                  onClick={handleToggleAutoImportComfyOutputs}
                  className={`relative h-5 w-10 flex-shrink-0 rounded-full transition-colors ${autoImportComfyOutputs ? 'bg-sf-accent' : 'bg-sf-dark-600'}`}
                  title={autoImportComfyOutputs ? t('settings.connection.disableAutoImport') : t('settings.connection.enableAutoImport')}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${autoImportComfyOutputs ? 'left-[calc(100%-1.25rem)]' : 'left-0.5'}`} aria-hidden />
                </button>
              </div>
            </div>
          </section>
        </div>
      )
      break
    }
    case 'agents': {
      const mcpUrl = mcpStatus?.url || 'http://127.0.0.1:19790/mcp'
      const codexCommand = `codex mcp add velorn --url ${mcpUrl}`
      const claudeCommand = `claude mcp add --transport http velorn ${mcpUrl}`
      activeSectionContent = (
        <div className="space-y-4">
          <div className="rounded-lg border border-sf-dark-700 bg-sf-dark-900/60 px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-sf-text-primary">MCP server</div>
                <p className="mt-1 text-[11px] text-sf-text-muted">
                  {t('settings.agents.serverDescription')}
                </p>
              </div>
              <span className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded px-2 py-1 text-[10px] font-medium ${
                mcpStatus?.running
                  ? 'bg-green-900/30 text-green-300'
                  : 'bg-red-900/30 text-red-300'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${mcpStatus?.running ? 'bg-green-300' : 'bg-red-300'}`} />
                {mcpStatus?.running ? 'Running' : 'Stopped'}
              </span>
            </div>

            <div className="mt-3 rounded border border-sf-dark-700 bg-black/30 px-3 py-2">
              <div className="mb-1 text-[10px] uppercase text-sf-text-muted">Local endpoint</div>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate text-xs text-sf-text-primary">{mcpUrl}</code>
                <button
                  type="button"
                  onClick={() => { void handleCopyMcpText('url', mcpUrl) }}
                  className="inline-flex flex-shrink-0 items-center gap-1 rounded bg-sf-dark-700 px-2 py-1 text-[11px] text-sf-text-secondary hover:bg-sf-dark-600"
                >
                  <Copy className="h-3 w-3" />
                  {mcpCopied === 'url' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {mcpStatus?.error && (
              <p className="mt-2 text-[11px] text-red-300">{mcpStatus.error}</p>
            )}
            <p className="mt-2 text-[11px] text-sf-text-muted">
              Snapshot: {mcpStatus?.lastSnapshotAt ? new Date(mcpStatus.lastSnapshotAt).toLocaleTimeString() : 'Waiting for app state'}
              {' '}• Project: {mcpStatus?.hasProject ? 'Open' : 'None open'}
              {' '}• Tools: {mcpStatus?.toolCount ?? 0}
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-sf-dark-700 bg-sf-dark-900/60 px-3 py-3">
              <div className="mb-2 text-xs font-semibold text-sf-text-primary">Codex</div>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-black/30 px-2 py-1.5 text-[11px] text-sf-text-secondary">{codexCommand}</code>
                <button
                  type="button"
                  onClick={() => { void handleCopyMcpText('codex', codexCommand) }}
                  className="inline-flex flex-shrink-0 items-center gap-1 rounded bg-sf-dark-700 px-2 py-1.5 text-[11px] text-sf-text-secondary hover:bg-sf-dark-600"
                >
                  <Copy className="h-3 w-3" />
                  {mcpCopied === 'codex' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-sf-dark-700 bg-sf-dark-900/60 px-3 py-3">
              <div className="mb-2 text-xs font-semibold text-sf-text-primary">Claude Code</div>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-black/30 px-2 py-1.5 text-[11px] text-sf-text-secondary">{claudeCommand}</code>
                <button
                  type="button"
                  onClick={() => { void handleCopyMcpText('claude', claudeCommand) }}
                  className="inline-flex flex-shrink-0 items-center gap-1 rounded bg-sf-dark-700 px-2 py-1.5 text-[11px] text-sf-text-secondary hover:bg-sf-dark-600"
                >
                  <Copy className="h-3 w-3" />
                  {mcpCopied === 'claude' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-sf-dark-700 bg-sf-dark-900/60 px-3 py-3">
            <div className="text-xs font-semibold text-sf-text-primary">Available tools</div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-sf-text-secondary">
              {['get_project', 'create_project', 'duplicate_project', 'get_timeline', 'get_assets', 'get_ai_review_passes', 'get_mcp_recipes', 'find_timeline_items', 'check_media_health', 'inspect_export_file', 'guide_comfyui_setup', 'diagnose_comfyui_connection', 'set_comfyui_connection', 'repair_comfyui_connection', 'control_comfyui_launcher', 'get_comfyui_launcher_logs', 'validate_comfyui_nodes', 'list_velorn_workflows', 'inspect_velorn_workflow', 'check_export_readiness', 'inspect_clip', 'inspect_timeline_frame', 'prepare_generation_from_timeline_context', 'queue_prepared_generation', 'queue_timeline_generation_batch', 'queue_h3_reference_video', 'get_generation_queue_status', 'queue_prompt_generation_batch', 'inspect_timeline_range', 'inspect_visible_shots', 'get_generation_status', 'get_music_video_status', 'get_music_video_plan', 'inspect_music_video_keyframe', 'regenerate_music_video_keyframe', 'inspect_music_video_video', 'regenerate_music_video_video', 'analyze_timeline', 'analyze_music_video_workflow', 'undo', 'redo', 'set_playhead', 'select_clips', 'select_assets', 'create_project_checkpoint', 'restore_project_checkpoint', 'set_in_out_range', 'run_mcp_action_plan', 'import_asset_from_path', 'relink_asset', 'set_clip_style', 'set_clip_label_color', 'set_clips_enabled', 'add_timeline_markers', 'remove_timeline_markers', 'set_timeline_marker_properties', 'create_timeline', 'switch_timeline', 'rename_timeline', 'duplicate_timeline', 'delete_timeline', 'create_asset_folder', 'move_assets_to_folder', 'move_unused_assets_to_folder', 'add_track', 'update_track', 'remove_track', 'add_transition', 'update_transition', 'remove_transitions', 'move_clips', 'trim_clips', 'delete_clips', 'add_asset_to_timeline', 'add_assets_to_timeline', 'replace_clip_with_asset', 'add_solid_color', 'add_adjustment_clip', 'add_text_clip', 'add_shape_clip', 'duplicate_clip', 'update_text_clip', 'update_shape_clip', 'list_glsl_effects', 'add_glsl_effect', 'update_glsl_effect', 'remove_glsl_effect', 'set_clip_keyframes', 'add_dip_to_black', 'export_timeline', 'export_delivery_batch', 'export_fcpxml'].map((tool) => (
                <span key={tool} className="rounded bg-sf-dark-800 px-2 py-1">{tool}</span>
              ))}
            </div>
          </div>
        </div>
      )
      break
    }
    case 'paths':
      activeSectionContent = (
        <div className="space-y-5">
          <div>
            <label className="block text-xs text-sf-text-muted mb-1">{t('settings.paths.outputDirectory')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={outputPath}
                onChange={(e) => setOutputPath(e.target.value)}
                placeholder={OUTPUT_DIRECTORY_PLACEHOLDER}
                className="flex-1 min-w-0 bg-sf-dark-800 border border-sf-dark-600 rounded px-3 py-2 text-xs text-sf-text-primary focus:outline-none focus:border-sf-accent truncate"
              />
              <button
                type="button"
                onClick={() => {
                  void handleChooseDirectory({
                    title: t('settings.paths.selectOutputDirectory'),
                    currentPath: outputPath,
                    onSelect: setOutputPath,
                  })
                }}
                className="px-3 py-2 bg-sf-dark-700 hover:bg-sf-dark-600 rounded text-xs text-sf-text-secondary transition-colors flex-shrink-0"
              >
                ...
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-sf-text-muted mb-1">{t('settings.paths.workflowsDirectory')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={workflowPath}
                onChange={(e) => setWorkflowPath(e.target.value)}
                placeholder={WORKFLOWS_DIRECTORY_PLACEHOLDER}
                className="flex-1 min-w-0 bg-sf-dark-800 border border-sf-dark-600 rounded px-3 py-2 text-xs text-sf-text-primary focus:outline-none focus:border-sf-accent truncate"
              />
              <button
                type="button"
                onClick={() => {
                  void handleChooseDirectory({
                    title: t('settings.paths.selectWorkflowsDirectory'),
                    currentPath: workflowPath,
                    onSelect: setWorkflowPath,
                  })
                }}
                className="px-3 py-2 bg-sf-dark-700 hover:bg-sf-dark-600 rounded text-xs text-sf-text-secondary transition-colors flex-shrink-0"
              >
                ...
              </button>
            </div>
          </div>

          <div
            id="settings-lora-factories"
            className={`rounded-lg border bg-sf-dark-900/60 px-3 py-3 transition-shadow ${
              initialFocusTarget === 'lora-factories'
                ? 'border-sf-accent/70 shadow-[0_0_0_2px_rgba(124,92,255,0.2)]'
                : 'border-sf-dark-700'
            }`}
          >
            <div className="text-sm font-medium text-sf-text-primary">{t('settings.paths.loraFactories')}</div>
            <p className="mt-1 text-[10px] text-sf-text-muted">{t('settings.paths.loraFactoriesHelp')}</p>
            {[
              {
                type: 'anima',
                label: t('settings.paths.animaFactory'),
                value: animaLoraFactoryRootPath,
                setValue: setAnimaLoraFactoryRootPath,
              },
              {
                type: 'sdxl',
                label: t('settings.paths.sdxlFactory'),
                value: sdxlLoraFactoryRootPath,
                setValue: setSdxlLoraFactoryRootPath,
              },
            ].map((factory) => {
              const status = loraFactoryPathStatus[factory.type]
              return (
                <div key={factory.type} className="mt-3">
                  <label className="mb-1 block text-xs text-sf-text-muted">{factory.label}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={factory.value}
                      onChange={(event) => {
                        factory.setValue(event.target.value)
                        setLoraFactoryPathStatus((previous) => ({ ...previous, [factory.type]: null }))
                      }}
                      placeholder={window.electronAPI?.platform === 'win32' ? 'C:\\path\\to\\LoRA-Factory' : '/path/to/LoRA-Factory'}
                      className="min-w-0 flex-1 truncate rounded border border-sf-dark-600 bg-sf-dark-800 px-3 py-2 text-xs text-sf-text-primary focus:border-sf-accent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => { void handleChooseLoraFactoryRoot(factory.type) }}
                      className="flex-shrink-0 rounded bg-sf-dark-700 px-3 py-2 text-xs text-sf-text-secondary transition-colors hover:bg-sf-dark-600"
                    >
                      {t('settings.paths.browse')}
                    </button>
                  </div>
                  {factory.value && status && (
                    <p className={`mt-1.5 text-[10px] ${status.isValid ? 'text-green-300' : 'text-red-300'}`}>
                      {status.isValid ? t('settings.paths.factoryValid') : (status.error || t('settings.paths.factoryInvalid'))}
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <div className="rounded-lg border border-sf-dark-700 bg-sf-dark-900/60 px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-sf-text-primary">{t('settings.paths.hardwareFfmpeg.title')}</div>
                <p className="mt-1 text-[10px] text-sf-text-muted">
                  {t('settings.paths.hardwareFfmpeg.help')}
                </p>
              </div>
              <span className="flex-shrink-0 rounded border border-sf-dark-600 bg-sf-dark-800 px-2 py-1 text-[10px] text-sf-text-secondary">
                {hardwareExportFfmpegStatus?.source === 'environment'
                  ? t('settings.paths.hardwareFfmpeg.sourceEnvironment')
                  : hardwareExportFfmpegStatus?.source === 'setting'
                    ? t('settings.paths.hardwareFfmpeg.sourceCustom')
                    : t('settings.paths.hardwareFfmpeg.sourceBundled')}
              </span>
            </div>

            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={hardwareExportFfmpegPath}
                onChange={(event) => {
                  hardwareExportFfmpegInputDirtyRef.current = true
                  setHardwareExportFfmpegPathState(event.target.value)
                  setHardwareExportFfmpegTest(null)
                  setHardwareExportFfmpegMessage('')
                }}
                placeholder={window.electronAPI?.platform === 'win32' ? 'C:\\path\\to\\ffmpeg.exe' : '/usr/bin/ffmpeg'}
                className="flex-1 min-w-0 bg-sf-dark-800 border border-sf-dark-600 rounded px-3 py-2 text-xs text-sf-text-primary focus:outline-none focus:border-sf-accent truncate"
              />
              <button
                type="button"
                onClick={() => { void handleChooseHardwareExportFfmpeg() }}
                disabled={Boolean(hardwareExportFfmpegBusy)}
                className="px-3 py-2 bg-sf-dark-700 hover:bg-sf-dark-600 rounded text-xs text-sf-text-secondary transition-colors flex-shrink-0 disabled:cursor-wait disabled:opacity-50"
              >
                {t('settings.paths.browse')}
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { void handleSaveHardwareExportFfmpeg() }}
                disabled={Boolean(hardwareExportFfmpegBusy) || !hardwareExportFfmpegPath.trim()}
                className="rounded bg-sf-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sf-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {hardwareExportFfmpegBusy === 'saving' ? t('settings.paths.hardwareFfmpeg.validating') : t('settings.paths.hardwareFfmpeg.savePath')}
              </button>
              <button
                type="button"
                onClick={() => { void handleTestHardwareExportFfmpeg() }}
                disabled={Boolean(hardwareExportFfmpegBusy)}
                className="inline-flex items-center gap-1 rounded bg-sf-dark-700 px-3 py-1.5 text-xs text-sf-text-secondary transition-colors hover:bg-sf-dark-600 disabled:cursor-wait disabled:opacity-50"
              >
                <RefreshCcw className={`h-3 w-3 ${hardwareExportFfmpegBusy === 'testing' ? 'animate-spin' : ''}`} />
                {t('settings.paths.hardwareFfmpeg.testActive')}
              </button>
              <button
                type="button"
                onClick={() => { void handleResetHardwareExportFfmpeg() }}
                disabled={Boolean(hardwareExportFfmpegBusy) || (!hardwareExportFfmpegPath && hardwareExportFfmpegStatus?.source !== 'setting')}
                className="rounded bg-sf-dark-700 px-3 py-1.5 text-xs text-sf-text-secondary transition-colors hover:bg-sf-dark-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {hardwareExportFfmpegStatus?.source === 'environment'
                  ? t('settings.paths.hardwareFfmpeg.clearSavedPath')
                  : t('settings.paths.hardwareFfmpeg.useBundled')}
              </button>
            </div>

            {hardwareExportFfmpegStatus?.activePath && (
              <div className="mt-3 rounded border border-sf-dark-700 bg-black/20 px-2.5 py-2 text-[10px] text-sf-text-muted">
                <div className="flex gap-1">
                  <span className="flex-shrink-0 uppercase tracking-wider">{t('settings.paths.hardwareFfmpeg.active')}:</span>
                  <code className="min-w-0 break-all text-sf-text-secondary">{hardwareExportFfmpegStatus.activePath}</code>
                </div>
                {hardwareExportFfmpegStatus.version && (
                  <div className="mt-1 break-all">{hardwareExportFfmpegStatus.version}</div>
                )}
              </div>
            )}

            {hardwareExportFfmpegStatus?.environmentPath && (
              <p className="mt-2 text-[10px] text-yellow-300">
                {t('settings.paths.hardwareFfmpeg.environmentPriority')}
              </p>
            )}
            {hardwareExportFfmpegStatus?.warning && (
              <p className="mt-2 text-[10px] text-yellow-300">{hardwareExportFfmpegStatus.warning}</p>
            )}
            {hardwareExportFfmpegMessage && (
              <p className={`mt-2 text-[10px] ${hardwareExportFfmpegTest?.available ? 'text-green-300' : 'text-sf-text-muted'}`}>
                {hardwareExportFfmpegMessage}
              </p>
            )}
            {hardwareExportFfmpegTest && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className={`rounded border px-1.5 py-0.5 text-[10px] ${hardwareExportFfmpegTest.h264 ? 'border-green-500/40 bg-green-500/10 text-green-300' : 'border-sf-dark-600 text-sf-text-muted'}`}>
                  H.264 {hardwareExportFfmpegTest.kind === 'videotoolbox' ? 'VideoToolbox' : 'NVENC'}
                </span>
                <span className={`rounded border px-1.5 py-0.5 text-[10px] ${hardwareExportFfmpegTest.h265 ? 'border-green-500/40 bg-green-500/10 text-green-300' : 'border-sf-dark-600 text-sf-text-muted'}`}>
                  H.265 {hardwareExportFfmpegTest.kind === 'videotoolbox' ? 'VideoToolbox' : 'NVENC'}
                </span>
              </div>
            )}
          </div>
        </div>
      )
      break
    case 'workflow-setup':
      activeSectionContent = <WorkflowSetupSection focusWorkflowIds={workflowSetupFocusIds} />
      break
    case 'launcher':
      activeSectionContent = <ComfyLauncherSettingsSection onOpenLogViewer={() => setLogViewerOpen(true)} />
      break
    case 'language':
      activeSectionContent = (
        <div className="space-y-5">
          <div>
            <label htmlFor="velorn-display-language" className="block text-xs text-sf-text-muted mb-1">
              {t('settings.languageLabel')}
            </label>
            <select
              id="velorn-display-language"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="w-full bg-sf-dark-800 border border-sf-dark-600 rounded px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-accent"
            >
              {languages.map((item) => (
                <option key={item.code} value={item.code}>{item.name}</option>
              ))}
            </select>
            <p className="mt-2 text-xs text-sf-text-secondary">{t('settings.languageHelp')}</p>
            <p className="mt-1 text-[10px] text-sf-text-muted">{t('settings.fallbackHelp')}</p>
          </div>
        </div>
      )
      break
    case 'appearance':
      activeSectionContent = (
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-sf-text-muted">{t('settings.appearance.theme')}</label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {THEMES.map((theme) => {
                const isActive = theme.id === activeThemeId
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => {
                      setActiveThemeId(theme.id)
                      applyTheme(theme.id)
                    }}
                    className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? 'border-sf-accent bg-sf-accent/10'
                        : 'border-sf-dark-700 bg-sf-dark-800 hover:bg-sf-dark-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex gap-0.5 flex-shrink-0">
                        <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: theme.preview.bg }} />
                        <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: theme.preview.surface }} />
                        <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: theme.preview.accent }} />
                        <div className="w-4 h-4 rounded-sm border border-white/10" style={{ backgroundColor: theme.preview.text }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-sf-text-primary font-medium">{theme.label}</span>
                          {isActive && (
                            <span className="text-[10px] text-sf-accent font-medium">{t('settings.appearance.active')}</span>
                          )}
                        </div>
                        <p className="text-[10px] text-sf-text-muted truncate">{t(`settings.appearance.themes.${theme.id}`)}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-sf-dark-700 bg-sf-dark-900/60 px-3 py-3">
            <div>
              <label className="text-sm text-sf-text-primary">{t('settings.appearance.timelineThumbnails')}</label>
              <p className="text-[10px] text-sf-text-muted">{t('settings.appearance.timelineThumbnailsHelp')}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowTimelineClipThumbnails(!showTimelineClipThumbnails)}
              className={`w-10 h-5 rounded-full transition-colors ${showTimelineClipThumbnails ? 'bg-sf-accent' : 'bg-sf-dark-600'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${showTimelineClipThumbnails ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      )
      break
    case 'notifications': {
      const soundEnabled = generationCompletionSoundSettings.enabled
      const soundVolume = generationCompletionSoundSettings.volume
      activeSectionContent = (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-sf-dark-700 bg-sf-dark-900/60 px-3 py-3">
            <div>
              <label className="text-sm text-sf-text-primary">{t('settings.notifications.completionSound')}</label>
              <p className="text-[10px] text-sf-text-muted">{t('settings.notifications.completionSoundHelp')}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={soundEnabled}
              onClick={() => handleGenerationCompletionSoundChange({ enabled: !soundEnabled })}
              className={`w-10 h-5 rounded-full transition-colors ${soundEnabled ? 'bg-sf-accent' : 'bg-sf-dark-600'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${soundEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div className={`rounded-lg border border-sf-dark-700 bg-sf-dark-900/60 px-3 py-3 ${soundEnabled ? '' : 'opacity-60'}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="text-sm text-sf-text-primary">{t('settings.notifications.volume')}</label>
                <p className="text-[10px] text-sf-text-muted">{t('settings.notifications.volumeHelp')}</p>
              </div>
              <div className="rounded bg-sf-dark-800 px-2 py-1 text-xs text-sf-text-secondary">
                {soundVolume === 0 ? t('settings.notifications.off') : `${soundVolume}/10`}
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={soundVolume}
              disabled={!soundEnabled}
              onChange={(event) => handleGenerationCompletionSoundChange({ volume: Number(event.target.value) })}
              className="mt-3 w-full accent-sf-accent disabled:cursor-not-allowed"
            />
          </div>

          <div className={`rounded-lg border border-sf-dark-700 bg-sf-dark-900/60 px-3 py-3 ${soundEnabled ? '' : 'opacity-60'}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="text-sm text-sf-text-primary">{t('settings.notifications.sound')}</label>
                <p className="text-[10px] text-sf-text-muted">{t('settings.notifications.soundHelp')}</p>
              </div>
              <button
                type="button"
                disabled={!soundEnabled || soundVolume <= 0}
                onClick={() => playGenerationCompletionSound(generationCompletionSoundSettings)}
                className="inline-flex items-center gap-1.5 rounded bg-sf-dark-700 px-3 py-1.5 text-xs text-sf-text-secondary transition-colors hover:bg-sf-dark-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                {t('settings.notifications.preview')}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
              {GENERATION_COMPLETION_SOUND_OPTIONS.map((option) => {
                const isSelected = option.id === generationCompletionSoundSettings.soundId
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleGenerationCompletionSoundChange({ soundId: option.id })}
                    className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? 'border-sf-accent bg-sf-accent/10'
                        : 'border-sf-dark-700 bg-sf-dark-800 hover:bg-sf-dark-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-sf-text-primary">{t(`settings.notifications.sounds.${option.id}.label`)}</span>
                      {isSelected && (
                        <span className="text-[10px] text-sf-accent">{t('settings.notifications.active')}</span>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-sf-text-muted">{t(`settings.notifications.sounds.${option.id}.description`)}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )
      break
    }
    case 'hotkeys':
      activeSectionContent = (
        <div className="space-y-5">
          <div className="rounded border border-sf-dark-700 bg-sf-dark-800/60 px-3 py-2">
            <p className="text-xs text-sf-text-secondary">
              {t('settings.hotkeys.introBefore')} <code>Space</code>, <code>Arrow Left/Right</code>, <code>Undo/Redo</code>, <code>Delete</code>, {t('settings.hotkeys.introAfter')}
            </p>
            <p className="mt-1 text-[10px] text-sf-text-muted">
              {t('settings.hotkeys.recordHelpBefore')} <code>Delete</code> {t('settings.hotkeys.recordHelpAfter')}
            </p>
          </div>

          <div className="rounded border border-sf-dark-700 bg-sf-dark-800/60 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-sf-text-primary">{t('settings.hotkeys.presets')}</p>
                <p className="text-[10px] text-sf-text-muted">
                  {t('settings.hotkeys.presetsHelp')}
                </p>
              </div>
              <div className="rounded bg-sf-dark-900 px-2 py-1 text-[10px] text-sf-text-secondary">
                {t('settings.hotkeys.currentPreset')}: {currentHotkeyPresetId === 'custom'
                  ? t('settings.hotkeys.custom')
                  : (EDITOR_HOTKEY_PRESETS.find((preset) => preset.id === currentHotkeyPresetId)?.label || t('settings.hotkeys.custom'))}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {EDITOR_HOTKEY_PRESETS.map((preset) => {
                const isActive = preset.id === currentHotkeyPresetId
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setEditorHotkeysState(preset.bindings)
                      setRecordingHotkeyId(null)
                      setHotkeysError('')
                    }}
                    className={`rounded border px-3 py-2 text-left transition-colors ${
                      isActive
                        ? 'border-sf-accent bg-sf-accent/10'
                        : 'border-sf-dark-700 bg-sf-dark-800 hover:bg-sf-dark-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-sf-text-primary">{preset.label}</span>
                      {isActive && (
                        <span className="text-[10px] text-sf-accent">{t('settings.hotkeys.active')}</span>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-sf-text-muted">{t(`settings.hotkeys.presetDescriptions.${preset.id}`)}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            {EDITOR_HOTKEY_DEFINITIONS.map((definition) => (
              <div
                key={definition.id}
                className="flex items-center justify-between gap-3 rounded border border-sf-dark-700 bg-sf-dark-800 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm text-sf-text-primary">{t(`settings.hotkeys.actions.${definition.id}`)}</div>
                  <div className="text-[10px] text-sf-text-muted">{t(`settings.hotkeys.categories.${HOTKEY_CATEGORY_KEY[definition.description]}`)}</div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setRecordingHotkeyId(definition.id)
                      setHotkeysError('')
                    }}
                    className={`min-w-[128px] rounded border px-3 py-1.5 text-xs font-mono transition-colors ${
                      recordingHotkeyId === definition.id
                        ? 'border-sf-accent bg-sf-accent/15 text-sf-accent'
                        : 'border-sf-dark-600 bg-sf-dark-700 text-sf-text-secondary hover:bg-sf-dark-600'
                    }`}
                  >
                    {recordingHotkeyId === definition.id ? t('settings.hotkeys.pressShortcut') : formatEditorHotkey(editorHotkeys[definition.id])}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditorHotkeysState((prev) => ({ ...prev, [definition.id]: definition.defaultBinding || '' }))
                      setHotkeysError('')
                    }}
                    className="rounded bg-sf-dark-700 px-2.5 py-1.5 text-[10px] text-sf-text-muted transition-colors hover:bg-sf-dark-600"
                    title={t('settings.hotkeys.restoreAction')}
                  >
                    {t('settings.hotkeys.default')}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {hotkeysError && (
            <p className="text-xs text-sf-error">{hotkeysError}</p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setEditorHotkeysState(DEFAULT_EDITOR_HOTKEYS)
                setRecordingHotkeyId(null)
                setHotkeysError('')
              }}
              className="rounded bg-sf-dark-700 px-3 py-1.5 text-xs text-sf-text-secondary transition-colors hover:bg-sf-dark-600"
            >
              {t('settings.hotkeys.restoreAll')}
            </button>
          </div>
        </div>
      )
      break
    case 'project':
      activeSectionContent = (
        <div className="space-y-5">
          <div>
            <label className="block text-xs text-sf-text-muted mb-1">{t('settings.projectDefaults.resolution')}</label>
            <select
              value={defaultResolution || 'HD 1080p'}
              onChange={(e) => setDefaultProjectSettings(e.target.value, defaultFps)}
              className="w-full bg-sf-dark-800 border border-sf-dark-600 rounded px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-accent"
            >
              {RESOLUTION_PRESETS.map((preset) => (
                <option key={preset.name} value={preset.name}>
                  {preset.name} ({preset.width}x{preset.height})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-sf-text-muted mb-1">{t('settings.projectDefaults.frameRate')}</label>
            <select
              value={defaultFps ?? 24}
              onChange={(e) => setDefaultProjectSettings(defaultResolution, Number(e.target.value))}
              className="w-full bg-sf-dark-800 border border-sf-dark-600 rounded px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-accent"
            >
              {FPS_PRESETS.map((fps) => (
                <option key={fps.value} value={fps.value}>
                  {fps.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )
      break
    default:
      activeSectionContent = null
  }

  const ActiveSectionIcon = activeSectionMeta.icon

  return (
    <div className="settings-layout flex h-full min-h-0 flex-col">
      <div className="settings-body flex flex-1 min-h-0 overflow-hidden">
        <aside className="settings-rail flex min-h-0 w-[250px] flex-shrink-0 flex-col border-r border-sf-dark-700 bg-sf-dark-950/60">
          <div className="settings-rail-heading flex-shrink-0 border-b border-sf-dark-700 px-4 py-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-sf-text-muted">{t('settings.categories')}</div>
            <p className="mt-1 text-xs text-sf-text-secondary">{t('settings.pickArea')}</p>
          </div>
          <div className="settings-rail-list min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            <div className="space-y-1">
              {localizedSections.map((section) => (
                <SettingsRailItem
                  key={section.id}
                  section={section}
                  isActive={section.id === activeSection}
                  onSelect={setActiveSection}
                />
              ))}
            </div>
          </div>
        </aside>

        <section className="flex flex-1 min-w-0 min-h-0 flex-col">
          <div className="settings-section-heading flex-shrink-0 border-b border-sf-dark-700 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sf-dark-800 text-sf-text-secondary">
                <ActiveSectionIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-medium text-sf-text-primary">{activeSectionMeta.title}</h3>
                <p className="mt-1 text-sm text-sf-text-secondary">{activeSectionMeta.description}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
            <div className="max-w-4xl">
              {activeSectionContent}
            </div>
          </div>
        </section>
      </div>

      <ComfyLauncherLogViewer open={logViewerOpen} onClose={() => setLogViewerOpen(false)} />
      <ApiKeyDialog
        open={apiKeyDialogOpen}
        onClose={() => setApiKeyDialogOpen(false)}
        onSaved={(value) => setComfyOrgApiKey(value || '')}
      />

      <div className="settings-footer flex flex-shrink-0 items-center justify-between gap-4 border-t border-sf-dark-700 px-5 py-4">
        <p className="text-[11px] text-sf-text-muted">
          {isWorkflowSetupActive
            ? t('settings.saveHelpWorkflow')
            : t('settings.saveHelp')}
        </p>
        <button
          onClick={handleSaveAllSettings}
          className={`flex flex-shrink-0 items-center justify-center gap-2 rounded px-4 py-2.5 text-sm transition-colors min-w-[180px] ${
            isWorkflowSetupActive
              ? 'border border-sf-dark-600 bg-sf-dark-800 text-sf-text-secondary hover:border-sf-dark-500 hover:bg-sf-dark-700 hover:text-sf-text-primary'
              : 'bg-sf-accent text-white hover:bg-sf-accent-hover'
          }`}
        >
          <Save className="w-4 h-4" />
          {settingsSaved ? t('common.saved') : t('settings.saveSettings')}
        </button>
      </div>
    </div>
  )
}

export default function SettingsModal({ isOpen, onClose, initialSection = null, initialFocusTarget = '', workflowSetupFocusIds = [] }) {
  const { t } = useI18n()
  if (!isOpen) return null

  return (
    <div
      className="settings-modal-overlay fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pb-4 pt-4"
      onClick={onClose}
    >
      <div
        className="settings-modal-shell flex h-[calc(100vh-2rem)] w-full max-w-6xl flex-shrink-0 flex-col overflow-hidden rounded-xl border border-sf-dark-600 bg-sf-dark-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-modal-header flex flex-shrink-0 items-center justify-between border-b border-sf-dark-700 p-4">
          <h2 className="text-lg font-medium text-sf-text-primary">{t('settings.title')}</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-sf-dark-700 rounded-lg transition-colors"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5 text-sf-text-muted" />
          </button>
        </div>

        <div className="flex-1 min-h-0">
          <GeneralTab
            initialSection={initialSection}
            initialFocusTarget={initialFocusTarget}
            workflowSetupFocusIds={workflowSetupFocusIds}
          />
        </div>
      </div>
    </div>
  )
}
