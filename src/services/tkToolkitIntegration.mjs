import { OPEN_COMFY_TAB_EVENT } from '../config/generateWorkspaceConfig.js'

export const TK_TOOLKIT_WORKFLOW_ID = 'tk-toolkit'
export const TK_TOOLKIT_NODE_CLASS = 'TK Batch LoRA Loader'
export const TK_TOOLKIT_REPOSITORY_URL = 'https://github.com/Ararararararaki/comfyui-anima-toolkit'
export const TK_TOOLKIT_PANEL_PATH = '/extensions/ComfyUI-Anima-Batch-LoRA/app/'

export function openTkToolkitPanel() {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return { success: false, error: 'The TK Toolkit panel is only available in the desktop app.' }
  }

  window.dispatchEvent(new CustomEvent(OPEN_COMFY_TAB_EVENT, {
    detail: {
      label: 'TK Toolkit',
      comfyPath: TK_TOOLKIT_PANEL_PATH,
    },
  }))

  return { success: true }
}
