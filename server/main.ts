import { createApp } from './app';
import { readConfig, ConfigurationError } from './config';
import { connectDatabase, type Database } from './db';
import { inspectDatabase } from './deployment';
import { createHealthModel, readHealthModelConfig } from './health-model';
import { InvocationLedger } from './gateway';
import { createHmac } from 'node:crypto';

let database: Database | undefined;
try {
  if (process.versions.node.split('.')[0] !== '24') throw new ConfigurationError('NODE_24_LTS');
  const config = readConfig();
  const modelConfig = readHealthModelConfig(process.env);
  if (modelConfig && (!config.databaseUrl || !config.sessionSecret || !config.csrfSecret)) throw new ConfigurationError('MODEL_REQUIRES_DATABASE_AND_SESSION_SECRETS');
  if (config.databaseUrl) {
    database = await connectDatabase(config.databaseUrl, config.database);
    if (!(await inspectDatabase(database, config.requireVector)).ready) throw new ConfigurationError('DATABASE_SCHEMA_OR_CONNECTIVITY');
  }
  const healthModel = modelConfig ? createHealthModel(modelConfig, new InvocationLedger(database!, createHmac('sha256', config.sessionSecret!).update('health-model-invocation-v1').digest())) : undefined;
  const app = await createApp({ origin: config.origin, localTestFeatures: config.localTestFeatures, healthModel,
    sessionSecret: config.sessionSecret, csrfSecret: config.csrfSecret, database,
    environment: config.environment, contentSource: config.contentSource, contentRelease: config.contentRelease, requireVector: config.requireVector });
  app.addHook('onClose', async () => { await database?.close(); });
  await app.listen({ port: config.port, host: config.host });
  console.log(`拾味已启动：${config.environment}；内容=${config.contentSource}；健康模型接口=${healthModel ? '已配置' : '未配置'}；健康证据与规则尚未开放。`);
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => { void app.close(); });
} catch (error) {
  await database?.close();
  console.error(error instanceof ConfigurationError ? error.message : '启动失败，请检查数据库、端口和部署配置；连接信息不写入日志。');
  process.exitCode = 1;
}
