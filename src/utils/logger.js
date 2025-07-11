/**
 * 日志工具模块
 * 提供统一的日志记录功能
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');

// 确保日志目录存在
const logDir = path.join(process.cwd(), 'logs');
fs.ensureDirSync(logDir);

// 定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${stack ? '\n' + stack : ''}`;
  })
);

// 控制台输出格式（带颜色）
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${stack ? '\n' + stack : ''}`;
  })
);

// 创建日志记录器
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'prd-task-decomposition' },
  transports: [
    // 写入所有日志到 combined.log
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // 写入错误日志到 error.log
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // 开发环境下输出到控制台
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    }),
  ],
});

// 添加请求日志中间件
logger.middleware = (req, res, next) => {
  const start = Date.now();
  const { method, url, ip } = req;
  
  // 请求开始日志
  logger.info(`${method} ${url} - Request received from ${ip}`);
  
  // 响应完成后记录日志
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    if (statusCode >= 400) {
      logger.warn(`${method} ${url} - Response: ${statusCode} (${duration}ms)`);
    } else {
      logger.info(`${method} ${url} - Response: ${statusCode} (${duration}ms)`);
    }
  });
  
  next();
};

// 导出日志记录器
module.exports = logger;
