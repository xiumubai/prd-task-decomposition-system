/**
 * PRD任务拆解系统 - 主入口文件
 * 负责初始化和启动系统
 */

const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const dotenv = require('dotenv');
const logger = require('./utils/logger');

// 导入核心模块
const PrdParser = require('./prd-parser');
const TaskDecomposer = require('./task-decomposer');
const CodeMappingEngine = require('./code-mapping-engine');
const PromptGenerator = require('./prompt-generator');
const CodeGenerator = require('./code-generator');

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// 初始化系统组件
const initializeSystem = async () => {
  try {
    logger.info('正在初始化PRD任务拆解系统...');
    
    // 创建必要的目录
    await fs.ensureDir(path.join(__dirname, '../data'));
    await fs.ensureDir(path.join(__dirname, '../output'));
    
    // 初始化各个模块
    const prdParser = new PrdParser();
    const taskDecomposer = new TaskDecomposer();
    const codeMappingEngine = new CodeMappingEngine();
    const promptGenerator = new PromptGenerator();
    const codeGenerator = new CodeGenerator();
    
    // 返回初始化的模块
    return {
      prdParser,
      taskDecomposer,
      codeMappingEngine,
      promptGenerator,
      codeGenerator
    };
  } catch (error) {
    logger.error('系统初始化失败:', error);
    throw error;
  }
};

// API路由
app.get('/', (req, res) => {
  res.send('PRD任务拆解系统 API 服务正在运行');
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 导入API路由
app.use('/api/prd', require('./routes/prd-routes'));
app.use('/api/tasks', require('./routes/task-routes'));
app.use('/api/code-mapping', require('./routes/code-mapping-routes'));
app.use('/api/prompts', require('./routes/prompt-routes'));
app.use('/api/code-generation', require('./routes/code-generation-routes'));

// 错误处理中间件
app.use((err, req, res, next) => {
  logger.error('应用错误:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  });
});

// 启动服务器
const startServer = async () => {
  try {
    // 初始化系统组件
    const systemModules = await initializeSystem();
    
    // 将系统组件添加到应用上下文中
    app.locals.modules = systemModules;
    
    // 启动HTTP服务器
    app.listen(PORT, () => {
      logger.info(`PRD任务拆解系统服务已启动，监听端口: ${PORT}`);
      logger.info(`访问地址: http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
};

// 如果直接运行此文件，则启动服务器
if (require.main === module) {
  startServer();
}

// 导出应用实例（用于测试）
module.exports = { app, initializeSystem, startServer };
