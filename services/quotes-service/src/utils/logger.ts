import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

const pinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(isProduction
    ? {
        // Production: structured JSON logging
        formatters: {
          level: (label) => {
            return { level: label };
          },
        },
      }
    : {
        // Development: pretty printed logs
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }),
});

// Winston-compatible wrapper to maintain existing API
const logger = {
  info: (message: string, meta?: any) => {
    if (meta) {
      pinoLogger.info(meta, message);
    } else {
      pinoLogger.info(message);
    }
  },
  error: (message: string, meta?: any) => {
    if (meta) {
      pinoLogger.error(meta, message);
    } else {
      pinoLogger.error(message);
    }
  },
  warn: (message: string, meta?: any) => {
    if (meta) {
      pinoLogger.warn(meta, message);
    } else {
      pinoLogger.warn(message);
    }
  },
  debug: (message: string, meta?: any) => {
    if (meta) {
      pinoLogger.debug(meta, message);
    } else {
      pinoLogger.debug(message);
    }
  },
};

export { pinoLogger };
export default logger;
