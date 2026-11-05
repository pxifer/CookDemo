import { createApp } from './app';
import { readConfig, ConfigurationError } from './config';
import { connectDatabase, type Database } from './db';
import { inspectDatabase } from './deployment';
import { createHealthModel, readHealthModelConfig } from './health-model';
import { InvocationLedger } from './gateway';
import { createHmac } from 'node:crypto';
import { resolve } from 'node:path';
import { createLocalFoodGuidanceProvider } from './rag/food-guidance-repository';
import type { FoodGuidanceProvider } from '../../shared/food-guidance';

let database: Database | undefined;
let foodGuidance:FoodGuidanceProvider|undefined;
try {
  if (process.versions.node.split('.')[0] !== '24') throw new ConfigurationError('NODE_24_LTS');
  const config = readConfig();
  if(process.env.RAG_BUSINESS_RESEARCH==='1'){
    if(config.environment!=='local'||!['127.0.0.1','localhost','::1'].includes(config.host)||!config.origin||!['127.0.0.1','localhost','[::1]'].includes(new URL(config.origin).hostname))throw new ConfigurationError('RAG_BUSINESS_RESEARCH_LOCAL_ONLY');
    foodGuidance=await createLocalFoodGuidanceProvider();
  }else if(process.env.RAG_BUSINESS_RESEARCH&&!['0','false'].includes(process.env.RAG_BUSINESS_RESEARCH))throw new ConfigurationError('RAG_BUSINESS_RESEARCH');
  const modelConfig = readHealthModelConfig(process.env);
  if (modelConfig && (!config.databaseUrl || !config.sessionSecret || !config.csrfSecret)) throw new ConfigurationError('MODEL_REQUIRES_DATABASE_AND_SESSION_SECRETS');
  if (config.databaseUrl) {
    database = await connectDatabase(config.databaseUrl, config.database);
    if (!(await inspectDatabase(database, config.requireVector)).ready) throw new ConfigurationError('DATABASE_SCHEMA_OR_CONNECTIVITY');
  }
  const healthModel = modelConfig ? createHealthModel(modelConfig, new InvocationLedger(database!, createHmac('sha256', config.sessionSecret!).update('health-model-invocation-v1').digest())) : undefined;
  const app = await createApp({ staticRoot: process.env.STATIC_ROOT ? resolve(process.env.STATIC_ROOT) : undefined, origin: config.origin, localTestFeatures: config.localTestFeatures, healthModel,
    sessionSecret: config.sessionSecret, csrfSecret: config.csrfSecret, database,
    environment: config.environment, contentSource: config.contentSource, contentRelease: config.contentRelease, requireVector: config.requireVector,foodGuidance });
  app.addHook('onClose', async () => { await foodGuidance?.close?.();await database?.close(); });
  await app.listen({ port: config.port, host: config.host });
  console.log(`拾味已启动：${config.environment}；内容=${config.contentSource}；健康模型接口=${healthModel ? '已配置' : '未配置'}；健康证据与规则尚未开放。`);
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => { void app.close(); });
} catch (error) {
  await foodGuidance?.close?.();
  await database?.close();
  console.error(error instanceof ConfigurationError ? error.message : '启动失败，请检查数据库、端口和部署配置；连接信息不写入日志。');
  process.exitCode = 1;
}
