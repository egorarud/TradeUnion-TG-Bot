const { createLogger, format, transports } = require('winston');
const path = require('path');
const DailyRotateFile = require('winston-daily-rotate-file');

const logFormat = format.printf(({ timestamp, level, message, stack, ...meta }) => {
  let msg = `${timestamp} [${level}]: ${stack || message}`;
  if (Object.keys(meta).length) {
    msg += ` | meta: ${JSON.stringify(meta)}`;
  }
  return msg;
});

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    logFormat
  ),
  transports: [
    new transports.Console(),
    new DailyRotateFile({
      filename: path.join('logs', 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d', // хранить 14 дней
      level: 'info'
    }),
    new DailyRotateFile({
      filename: path.join('logs', 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d', // хранить 30 дней
      level: 'error'
    })
  ]
});

module.exports = logger;