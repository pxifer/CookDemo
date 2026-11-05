import { test as base, expect } from '@playwright/test';
import { localHttpUrl } from '../scripts/local-test-guard.mjs';
export { expect };
export type { Page } from '@playwright/test';
export const test=base.extend<{localNetworkGuard:void}>({
  localNetworkGuard:[async({context},use)=>{
    const blocked:string[]=[];
    await context.route('**/*',async route=>{
      if(localHttpUrl(route.request().url()))return route.continue();
      blocked.push(route.request().resourceType());await route.abort('blockedbyclient');
    });
    await context.routeWebSocket(/.*/,ws=>{
      if(localHttpUrl(ws.url()))ws.connectToServer();else{blocked.push('websocket');ws.close();}
    });
    await use();
    expect(blocked,'本地测试不允许请求公网资源').toEqual([]);
  },{auto:true}],
});
