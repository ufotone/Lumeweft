const DATABASE_DIRECTORY = 'generation-recipes'
const DATABASE_FILENAME = 'generation-recipes.db.json'
const DATABASE_VERSION = 1

let writeQueue = Promise.resolve()

function validEntries(entries) {
  return (Array.isArray(entries) ? entries : []).filter((entry) => entry?.id && entry?.text)
}

async function databasePath() {
  const api = typeof window !== 'undefined' ? window.electronAPI : null
  if (!api?.getAppPath || !api?.pathJoin) return null
  const userData = await api.getAppPath('userData')
  const directory = await api.pathJoin(userData, DATABASE_DIRECTORY)
  return {
    directory,
    filePath: await api.pathJoin(directory, DATABASE_FILENAME),
  }
}

async function writeDatabaseNow(entries) {
  const api = typeof window !== 'undefined' ? window.electronAPI : null
  const paths = await databasePath()
  if (!api?.writeFile || !api?.createDirectory || !paths) return false
  await api.createDirectory(paths.directory, { recursive: true })
  const payload = {
    format: 'lumeweft-generation-recipes',
    version: DATABASE_VERSION,
    updatedAt: new Date().toISOString(),
    entries: validEntries(entries),
  }
  const result = await api.writeFile(paths.filePath, JSON.stringify(payload, null, 2), { encoding: 'utf8' })
  if (!result?.success) throw new Error(result?.error || 'Could not save the generation recipe database.')
  return true
}

export async function saveGenerationRecipeDatabase(entries) {
  writeQueue = writeQueue.catch(() => {}).then(() => writeDatabaseNow(entries))
  return writeQueue
}

export async function loadGenerationRecipeDatabase(legacyEntries = []) {
  const api = typeof window !== 'undefined' ? window.electronAPI : null
  const paths = await databasePath()
  if (!api?.readFile || !paths) return validEntries(legacyEntries)

  try {
    const result = await api.readFile(paths.filePath, { encoding: 'utf8' })
    if (result?.success && result.data) {
      const parsed = JSON.parse(result.data)
      return validEntries(parsed?.entries)
    }
  } catch {
    // Missing/corrupt database: preserve any legacy Local Storage entries and
    // create a fresh recoverable database below.
  }

  const migrated = validEntries(legacyEntries)
  await saveGenerationRecipeDatabase(migrated)
  return migrated
}

