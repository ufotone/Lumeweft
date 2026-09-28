import { useEffect, useState } from 'react'
import {
  NSFW_WORKFLOW_VISIBILITY_CHANGED_EVENT,
  getShowNsfwWorkflows,
} from '../services/nsfwWorkflowVisibility.mjs'

export default function useNsfwWorkflowVisibility() {
  const [showNsfwWorkflows, setShowNsfwWorkflows] = useState(getShowNsfwWorkflows)

  useEffect(() => {
    const sync = (event) => setShowNsfwWorkflows(
      typeof event?.detail?.show === 'boolean' ? event.detail.show : getShowNsfwWorkflows()
    )
    window.addEventListener(NSFW_WORKFLOW_VISIBILITY_CHANGED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(NSFW_WORKFLOW_VISIBILITY_CHANGED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return showNsfwWorkflows
}
