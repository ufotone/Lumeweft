function removeAssetIdFromNodeData(data, assetId) {
  if (!data || typeof data !== 'object') return data

  let changed = false
  const nextData = { ...data }

  for (const [key, value] of Object.entries(data)) {
    if (/assetId$/i.test(key) && value === assetId) {
      nextData[key] = ''
      changed = true
      continue
    }

    if (/assetIds$/i.test(key) && Array.isArray(value) && value.includes(assetId)) {
      nextData[key] = value.filter((id) => id !== assetId)
      changed = true
    }
  }

  if (data.assetId === assetId) {
    Object.assign(nextData, {
      assetLabel: '',
      status: 'idle',
      error: '',
      statusMessage: '',
    })
  }

  return changed ? nextData : data
}

export function removeFlowAssetReferences(nodes = [], assetId = '') {
  if (!assetId) return nodes

  let changed = false
  const nextNodes = nodes.map((node) => {
    const nextData = removeAssetIdFromNodeData(node?.data, assetId)
    if (nextData === node?.data) return node
    changed = true
    return { ...node, data: nextData }
  })

  return changed ? nextNodes : nodes
}

export function removeFlowProjectAssetReferences(flowProjectData, assetId, activeDocumentId, liveNodes) {
  if (!flowProjectData || !assetId) return flowProjectData

  let changed = false
  const documents = (flowProjectData.documents || []).map((document) => {
    const sourceNodes = document.id === activeDocumentId && Array.isArray(liveNodes)
      ? liveNodes
      : (document.nodes || [])
    const nextNodes = removeFlowAssetReferences(sourceNodes, assetId)
    if (nextNodes === document.nodes) return document
    changed = true
    return {
      ...document,
      nodes: nextNodes,
      updatedAt: new Date().toISOString(),
    }
  })

  if (!changed && flowProjectData.activeDocumentId === activeDocumentId) return flowProjectData

  return {
    ...flowProjectData,
    activeDocumentId,
    documents,
  }
}
