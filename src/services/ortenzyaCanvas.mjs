export const ORTENZYA_WORKFLOW_ID = 'ortenzya-wordsmith-local'
export const ORTENZYA_MODEL_URL = 'https://huggingface.co/llmfan46/gemma-4-Ortenzya-The-Creative-Wordsmith-31B-it-uncensored-heretic-GGUF'
const activeRequests = new Set()
export function cancelOrtenzyaGeneration() {
  const cancelled = activeRequests.size > 0
  for (const controller of activeRequests) controller.abort()
  return cancelled
}
export const ORTENZYA_SCENARIO_INSTRUCTIONS = 'あなたはシナリオ制作の編集者です。ユーザーの設定・指示に基づき、日本語でシナリオの下書きを作成してください。タイトル、あらすじ、登場人物の外見と性格、舞台、シーン番号ごとの場所・時間・出来事・台詞を整理してください。人物の設定と場面の連続性を維持し、不足する設定は仮定として明示してください。作品本文だけを出力してください。'
export const ORTENZYA_PROMPT_INSTRUCTIONS = 'あなたは映像制作の絵コンテ編集者です。入力されたシナリオを、画像・動画生成用プロンプトの下書きに変換してください。各シーンをショットに分け、ショット番号、原文の対応箇所、人物の固定外見、背景、構図、カメラ、照明、開始画像の英語プロンプト、動作とカメラ移動を記述した英語の動画プロンプト、台詞・環境音を日本語の見出しで整理してください。原文の展開を変えず、画像の静的要素と動画の動的要素を分けてください。特定のモデル固有構文は付けず、後から編集できる下書きにしてください。'

export async function generateOrtenzyaText({ prompt, systemPrompt, endpoint = 'http://localhost:1234', modelId = '', maxTokens = 4096, seed = 0, modelFamily = 'ortenzya', fetchImpl = fetch }) {
  if (!String(prompt || '').trim()) throw new Error('設定・指示文、またはシナリオを入力してください。')
  const url = new URL(endpoint)
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password) {
    throw new Error('ローカルLLMの接続先には localhost または 127.0.0.1 を指定してください。')
  }
  const base = url.href.replace(/\/+$/, '').replace(/\/v1$/, '')
  const request = async (path, init = {}, timeout = 15000) => {
    const controller = new AbortController()
    activeRequests.add(controller)
    const timer = setTimeout(() => controller.abort(), timeout)
    let response
    try {
      response = await fetchImpl(`${base}/v1/${path}`, { ...init, signal: controller.signal })
      if (!response.ok) throw new Error(`ローカルLLM (${response.status}): ${(await response.text()).slice(0, 500)}`)
      return await response.json()
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Generation interrupted or timed out. / 文章生成を中断しました。')
      throw new Error(`ローカルLLMへの接続・応答を確認してください。${error.message || ''}`)
    } finally { clearTimeout(timer); activeRequests.delete(controller) }
  }
  const models = (await request('models')).data || []
  const ids = models.map(model => model.id).filter(id => typeof id === 'string')
  const matches = modelFamily === 'any' ? ids : ids.filter(id => /ortenzya/i.test(id) && /31b/i.test(id))
  const chosen = String(modelId || '').trim() || (matches.length === 1 ? matches[0] : '')
  if (!chosen || !ids.includes(chosen)) throw new Error(modelFamily === 'any' ? 'ローカルLLMを読み込んでください。複数モデルがある場合はインスペクターでモデルIDを指定してください。' : 'Ortenzya 31B をLM Studio / llama.cppで読み込んでください。複数ある場合や別名で公開している場合は、インスペクターのモデルIDに /v1/models のIDを指定してください。')
  const result = await request('chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: chosen, messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      { role: 'user', content: String(prompt).trim() },
    ], temperature: 1, top_p: 0.95, top_k: 64, max_tokens: Math.max(256, Math.min(16384, Math.round(Number(maxTokens) || 4096))), seed: Math.max(0, Math.round(Number(seed) || 0)), stream: false }),
  }, 600000)
  const text = result.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) throw new Error('モデルから本文が返りませんでした。出力上限とモデル設定を確認してください。')
  return { text: text.trim(), modelId: chosen, truncated: result.choices[0].finish_reason === 'length' }
}
