import { DomainError } from './recommendation';
const bad=(code:string,status:number,message:string)=>new DomainError(code,status,message);
export async function requestDeepSeekJson(apiKey:string,messages:{role:string;content:string}[],signal:AbortSignal,fetcher:typeof fetch=fetch,maxTokens=4000){
  try {
    signal.throwIfAborted();
    const response = await fetcher('https://api.deepseek.com/chat/completions', {
      method: 'POST', redirect: 'error', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body:JSON.stringify({model:'deepseek-flash',stream:false,thinking:{type:'disabled'},response_format:{type:'json_object'},max_tokens:maxTokens,messages}),
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      if ([401, 403].includes(response.status)) throw bad('CHAT_KEY_REJECTED', 400, 'DeepSeek API Key 无效或无访问权限，请检查后重新填写');
      if (response.status === 402) throw bad('CHAT_BALANCE_REQUIRED', 400, 'DeepSeek 可用额度不足，请在自己的账户中检查余额');
      if (response.status === 429) throw bad('CHAT_PROVIDER_BUSY', 429, 'DeepSeek 请求较多，请稍后手动重试');
      throw bad('CHAT_PROVIDER_UNAVAILABLE', 502, 'DeepSeek 暂时无法回复，请稍后手动重试');
    }
    if (!response.body) throw bad('CHAT_EMPTY_REPLY', 502, 'AI 未返回内容，请手动重试');
    const reader = response.body.getReader(), chunks: Uint8Array[] = [];
    let size = 0;
    let envelope;
    try {
      for (;;) {
        signal.throwIfAborted();
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 64 * 1024) throw bad('CHAT_REPLY_TOO_LARGE', 502, 'AI 回复过长，请缩小问题后重试');
        chunks.push(value);
      }
      envelope = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    const choice = envelope?.choices?.[0], content = choice?.message?.content;
    if (choice?.finish_reason !== 'stop' || typeof content !== 'string' || !content.trim() || content.length > 24000) throw bad('CHAT_INCOMPLETE_REPLY', 502, 'AI 未完整回复，请缩小问题后重试');
    signal.throwIfAborted();
    const id=envelope.id,model=envelope.model,usage=envelope.usage;
    if(typeof id!=='string'||!/^[-A-Za-z0-9_]{8,160}$/.test(id)||id.includes(apiKey)||typeof model!=='string'||!/^[-A-Za-z0-9_.:/]{1,120}$/.test(model)
      ||!usage||![usage.prompt_tokens,usage.completion_tokens,usage.total_tokens].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=10000000)
      ||usage.total_tokens!==usage.prompt_tokens+usage.completion_tokens)throw bad('CHAT_MISSING_RECEIPT',502,'DeepSeek 未返回完整调用凭证，本次不展示为已核实回复；未自动重发');
    return {content,invocation:{provider:'DeepSeek' as const,requestId:id,model,promptTokens:usage.prompt_tokens,completionTokens:usage.completion_tokens,totalTokens:usage.total_tokens,calledAt:new Date().toISOString()}};
  } catch (error) {
    if (signal.aborted) throw bad('CHAT_CANCELLED', 408, '本次对话已取消或超时，未自动重发');
    if (error instanceof DomainError) throw error;
    throw bad('CHAT_CONNECTION_FAILED', 502, 'AI 连接中断，请手动重试；问题已保留');
  }
}
