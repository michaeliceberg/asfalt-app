// lib/logger.ts
type LogArgs = unknown[];

export const logger = {
  info: (...args: LogArgs) => console.log(new Date().toISOString(), '[INFO]', ...args),
  error: (...args: LogArgs) => console.error(new Date().toISOString(), '[ERROR]', ...args),
  warn: (...args: LogArgs) => console.warn(new Date().toISOString(), '[WARN]', ...args),
  debug: (...args: LogArgs) => console.debug(new Date().toISOString(), '[DEBUG]', ...args),
};