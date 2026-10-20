import { createApp } from './app';
const port = Number(process.env.PORT ?? 4175);
if (process.versions.node.split('.')[0] !== '24') throw new Error('请使用 Node.js 24 LTS；Windows 可运行 scripts/run.ps1');
const app = await createApp({ origin: process.env.APP_ORIGIN, localTestFeatures: process.env.LOCAL_TEST_FEATURES === '1' });
await app.listen({ port, host: '127.0.0.1' });
console.log(`拾味本地开发版 http://127.0.0.1:${port}（构造内容；云、模型、账户与健康未开放）`);
if (process.env.LOCAL_TEST_FEATURES === '1') console.log('本机测试登录与健康流程已开启；不连接真实认证、不执行疾病适宜性判断。');
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => { void app.close(); });
