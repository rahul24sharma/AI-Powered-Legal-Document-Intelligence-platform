type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const envLevel = (process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'))
  .toLowerCase() as LogLevel;

const currentLevel: LogLevel = levelOrder[envLevel] ? envLevel : 'info';

function shouldLog(level: LogLevel) {
  return levelOrder[level] >= levelOrder[currentLevel];
}

function stringify(message: unknown) {
  return typeof message === 'string' ? message : JSON.stringify(message);
}

function write(level: LogLevel, message: unknown, ...args: unknown[]) {
  if (!shouldLog(level)) return;

  const prefix = `[${level.toUpperCase()}]`;
  if (level === 'error') {
    console.error(prefix, stringify(message), ...args);
    return;
  }
  if (level === 'warn') {
    console.warn(prefix, stringify(message), ...args);
    return;
  }
  console.log(prefix, stringify(message), ...args);
}

export const logger = {
  debug: (message: unknown, ...args: unknown[]) => write('debug', message, ...args),
  info: (message: unknown, ...args: unknown[]) => write('info', message, ...args),
  warn: (message: unknown, ...args: unknown[]) => write('warn', message, ...args),
  error: (message: unknown, ...args: unknown[]) => write('error', message, ...args),
};
