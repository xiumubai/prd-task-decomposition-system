/**
 * 代码映射引擎入口文件
 * 负责协调各个模块的工作，提供统一的API接口
 */

const CodebaseIndexer = require('./modules/codebase-indexer');
const SemanticAnalyzer = require('./modules/semantic-analyzer');
const MappingAlgorithm = require('./modules/mapping-algorithm');
const DependencyAnalyzer = require('./modules/dependency-analyzer');
const ChangePredictor = require('./modules/change-predictor');

class CodeMappingEngine {
  constructor(config = {}) {
    this.config = {
      indexDepth: 3,
      similarityThreshold: 0.7,
      ...config
    };
    
    this.codebaseIndexer = new CodebaseIndexer(this.config);
    this.semanticAnalyzer = new SemanticAnalyzer(this.config);
    this.mappingAlgorithm = new MappingAlgorithm(this.config);
    this.dependencyAnalyzer = new DependencyAnalyzer(this.config);
    this.changePredictor = new ChangePredictor(this.config);
    
    this.codeIndex = null;
    this.dependencyGraph = null;
  }
  
  /**
   * 初始化代码映射引擎
   * @param {string} codebasePath - 代码库路径
   * @returns {Promise<void>}
   */
  async initialize(codebasePath) {
    console.log(`Initializing code mapping engine for ${codebasePath}...`);
    
    // 索引代码库
    this.codeIndex = await this.codebaseIndexer.indexCodebase(codebasePath);
    
    // 分析代码语义
    await this.semanticAnalyzer.analyzeCodebase(this.codeIndex);
    
    // 构建依赖图谱
    this.dependencyGraph = await this.dependencyAnalyzer.buildDependencyGraph(this.codeIndex);
    
    console.log('Code mapping engine initialized successfully.');
  }
  
  /**
   * 将任务映射到代码位置
   * @param {Object} task - 任务对象
   * @returns {Promise<Array>} - 映射结果数组
   */
  async mapTaskToCode(task) {
    if (!this.codeIndex) {
      throw new Error('Code mapping engine not initialized. Call initialize() first.');
    }
    
    console.log(`Mapping task "${task.title}" to code...`);
    
    // 使用映射算法将任务映射到代码
    const mappingResults = await this.mappingAlgorithm.mapTask(task, this.codeIndex, this.dependencyGraph);
    
    return mappingResults;
  }
  
  /**
   * 预测代码变更影响
   * @param {Array} mappingResults - 映射结果数组
   * @returns {Promise<Object>} - 变更预测结果
   */
  async predictChanges(mappingResults) {
    if (!this.dependencyGraph) {
      throw new Error('Dependency graph not built. Call initialize() first.');
    }
    
    console.log('Predicting code changes impact...');
    
    // 预测代码变更影响
    const changeImpact = await this.changePredictor.predictChanges(mappingResults, this.dependencyGraph);
    
    return changeImpact;
  }
  
  /**
   * 生成代码修改建议
   * @param {Object} task - 任务对象
   * @returns {Promise<Object>} - 代码修改建议
   */
  async generateCodeModificationSuggestions(task) {
    // 映射任务到代码
    const mappingResults = await this.mapTaskToCode(task);
    
    // 预测变更影响
    const changeImpact = await this.predictChanges(mappingResults);
    
    // 生成修改建议
    const suggestions = {
      mappingResults,
      changeImpact,
      modificationPlan: {
        filesToModify: mappingResults.map(result => result.filePath),
        suggestedChanges: mappingResults.map(result => ({
          filePath: result.filePath,
          location: result.location,
          suggestion: `Implement ${task.title} here`
        })),
        potentialImpact: changeImpact.impactedFiles.length
      }
    };
    
    return suggestions;
  }
}

module.exports = CodeMappingEngine;
