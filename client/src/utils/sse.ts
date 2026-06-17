import { authToken } from './request'

// SSE 流式请求封装
export interface ISseOptions {
  onMessage: (data: any) => void
  onError?: (error: Error) => void
  onComplete?: () => void
}

export function fetchSSE(url: string, body: any, options: ISseOptions): AbortController {
  const controller = new AbortController()

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = authToken.get()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text()
        throw new Error(`请求失败: ${response.status} ${text}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('响应流为空')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          const data = trimmed.slice(6)
          try {
            const parsed = JSON.parse(data)
            options.onMessage(parsed)
            if (parsed.type === 'done') {
              options.onComplete?.()
              return
            }
          } catch {
            // 忽略解析错误
          }
        }
      }

      options.onComplete?.()
    })
    .catch((error) => {
      if (error.name !== 'AbortError') {
        options.onError?.(error)
      }
    })

  return controller
}
