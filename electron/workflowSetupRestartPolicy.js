function shouldRestartComfyAfterWorkflowSetup({ nodePacks = [], models = [] } = {}) {
  // A model task is created because the running ComfyUI instance did not
  // advertise that model. Even when the file already exists and download is
  // skipped, that instance still needs a restart to rebuild its loader lists.
  return models.length > 0 || nodePacks.some((entry) => !entry?.skipped)
}

module.exports = { shouldRestartComfyAfterWorkflowSetup }
