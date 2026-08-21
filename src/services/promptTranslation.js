export async function translatePrompt(prompt, target = 'en', sourceLanguage = 'ja') {
  const source = String(prompt || '').trim()
  if (!source) throw new Error('翻訳するプロンプトを入力してください。')
  const api = window.electronAPI
  if (!api?.translatePrompt) throw new Error('端末内翻訳はデスクトップ版で利用できます。')
  return api.translatePrompt({ text: source, target, sourceLanguage })
}
