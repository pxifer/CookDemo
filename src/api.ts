import type { Extraction, RecommendationRequest, RecommendationResult } from '../shared/types';
import type { SessionInfo } from '../shared/session';
let csrf: string | null = null;
export async function establishSession(): Promise<SessionInfo> {
  const response = await fetch('/api/v1/auth/session');
  if (!response.ok) throw new Error('本机会话建立失败，请刷新重试');
  const data: SessionInfo = await response.json(); csrf = data.csrfToken; return data;
}
async function post(url: string, body: unknown, signal?: AbortSignal, stream = false) {
  if (!csrf) await establishSession();
  const response = await fetch(`/api/v1/${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf!, Accept: stream ? 'application/x-ndjson' : 'application/json' }, body: JSON.stringify(body), signal });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message ?? '本次请求失败，输入已保留');
  }
  return response;
}
export async function extract(text: string): Promise<Extraction> { return (await post('recognitions/text', { text })).json(); }
export async function loginForLocalTest(): Promise<SessionInfo> {
  await post('auth/login', { mode: 'local-test' });
  return establishSession();
}
export async function logout(): Promise<SessionInfo> {
  await post('auth/logout', {});
  return establishSession();
}
export async function requestRecommendation(body: RecommendationRequest, signal: AbortSignal, progress: (s: string) => void): Promise<RecommendationResult> {
  const response = await post('recommendations', body, signal, true);
  if (!response.body) throw new Error('结果连接未建立，请主动重试');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', terminal: RecommendationResult | null = null;
  let ended = false;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (ended) throw new Error('结果流包含重复终态');
    if (event.type === 'progress') progress(event.stage);
    else if (event.type === 'error') { ended = true; throw new Error(event.message); }
    else if (event.type === 'result') { ended = true; terminal = event.result; }
    else throw new Error('无法识别的结果协议');
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n'); buffer = lines.pop()!;
      for (const line of lines) consume(line);
      if (done) break;
    }
    if (buffer.trim()) consume(buffer);
    if (!terminal) throw new Error('结果连接中断，请主动重试；未自动重新发送');
    return terminal;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
