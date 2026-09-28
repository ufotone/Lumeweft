const path = require('path')
const fs = require('fs').promises

// Bundle members must exist at their declared paths. A sibling adapter with
// the same basename must not satisfy the check for a different adapter.
async function checkWorkflowBundleFile(modelsPath, file, extraRoots = []) {
  const filename = String(file?.filename || '').trim()
  const parts = String(file?.targetSubdir || '').replace(/\\/g, '/').split('/')
  if (!filename || /[\\/:]/.test(filename) || ['.', '..'].includes(filename)
    || parts.some(part => !part || part === '.' || part === '..' || part.includes(':'))) {
    return { exists: false, resolvedPath: '' }
  }
  const [modelFolder, ...subdirs] = parts
  const roots = [path.join(modelsPath, modelFolder), ...extraRoots]
  for (const root of roots) {
    const base = path.resolve(root)
    const candidate = path.resolve(base, ...subdirs, filename)
    if (!candidate.startsWith(base + path.sep)) continue
    try {
      if ((await fs.stat(candidate)).isFile()) return { exists: true, resolvedPath: candidate }
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error?.code)) throw error
    }
  }
  return { exists: false, resolvedPath: '' }
}

module.exports = { checkWorkflowBundleFile }
