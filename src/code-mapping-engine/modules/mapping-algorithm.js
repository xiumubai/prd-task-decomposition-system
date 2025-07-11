/**
 * 映射算法
 * 负责将任务描述映射到代码位置
 */

const { mergeVectors } = require('../utils/vector-utils');

class MappingAlgorithm {
  constructor(config = {}) {
    this.config = {
      similarityThreshold: 0.7,
      maxResults: 10,
      weightKeywords: 0.6,
      weightDescription: 0.4,
      ...config
    };
  }
  
  /**
   * 将任务映射到代码
   * @param {Object} task - 任务对象
   * @param {Object} codeIndex - 代码索引对象
   * @param {Object} dependencyGraph - 依赖图谱对象
   * @returns {Promise<Array>} - 映射结果数组
   */
  async mapTask(task, codeIndex, dependencyGraph) {
    console.log(`Mapping task "${task.title}" to code...`);
    
    // 获取语义分析器实例
    const semanticAnalyzer = global.semanticAnalyzer;
    if (!semanticAnalyzer) {
      throw new Error('Semantic analyzer not available. Initialize the code mapping engine first.');
    }
    
    // 分析任务描述
    const taskAnalysis = this.analyzeTask(task);
    
    // 查找相似的代码元素
    const similarElements = await this.findSimilarCodeElements(taskAnalysis, semanticAnalyzer);
    
    // 应用依赖关系过滤和排序
    const rankedResults = this.rankResultsByDependencies(similarElements, dependencyGraph, task);
    
    // 生成最终映射结果
    const mappingResults = this.generateMappingResults(rankedResults, task);
    
    return mappingResults;
  }
  
  /**
   * 分析任务
   * @param {Object} task - 任务对象
   * @returns {Object} - 任务分析结果
   */
  analyzeTask(task) {
    // 提取任务关键信息
    const keywords = task.keywords || [];
    const title = task.title || '';
    const description = task.description || '';
    const type = task.type || '';
    
    // 合并任务描述文本
    const taskText = `${title} ${description} ${type} ${keywords.join(' ')}`;
    
    return {
      task,
      taskText,
      keywords,
      title,
      description,
      type
    };
  }
  
  /**
   * 查找与任务相似的代码元素
   * @param {Object} taskAnalysis - 任务分析结果
   * @param {Object} semanticAnalyzer - 语义分析器实例
   * @returns {Promise<Array>} - 相似代码元素数组
   */
  async findSimilarCodeElements(taskAnalysis, semanticAnalyzer) {
    // 使用任务标题和描述查找相似元素
    const titleResults = semanticAnalyzer.findSimilarElements(
      taskAnalysis.title,
      { threshold: this.config.similarityThreshold * 0.8 } // 降低标题的阈值，因为标题通常较短
    );
    
    // 使用任务描述查找相似元素
    const descriptionResults = semanticAnalyzer.findSimilarElements(
      taskAnalysis.description,
      { threshold: this.config.similarityThreshold }
    );
    
    // 使用任务关键词查找相似元素
    const keywordResults = semanticAnalyzer.findSimilarElements(
      taskAnalysis.keywords.join(' '),
      { threshold: this.config.similarityThreshold * 0.9 } // 提高关键词的阈值，因为关键词更精确
    );
    
    // 合并结果并去重
    const combinedResults = this.combineSearchResults([
      { results: titleResults, weight: 0.3 },
      { results: descriptionResults, weight: 0.4 },
      { results: keywordResults, weight: 0.3 }
    ]);
    
    return combinedResults;
  }
  
  /**
   * 合并搜索结果并去重
   * @param {Array} resultSets - 结果集数组，每个元素包含 results 和 weight
   * @returns {Array} - 合并后的结果数组
   */
  combineSearchResults(resultSets) {
    const combinedMap = new Map();
    
    // 遍历所有结果集
    for (const { results, weight } of resultSets) {
      for (const result of results) {
        const key = `${result.type}:${result.item.filePath}:${result.item.name}`;
        
        if (combinedMap.has(key)) {
          // 如果已存在，更新相似度分数
          const existing = combinedMap.get(key);
          existing.similarity = existing.similarity * existing.weight + result.similarity * weight;
          existing.weight += weight;
          existing.similarity /= existing.weight;
        } else {
          // 如果不存在，添加到Map
          combinedMap.set(key, {
            ...result,
            weight,
            originalSimilarity: result.similarity
          });
        }
      }
    }
    
    // 转换为数组并排序
    const combined = Array.from(combinedMap.values());
    combined.sort((a, b) => b.similarity - a.similarity);
    
    return combined;
  }
  
  /**
   * 根据依赖关系对结果进行排序
   * @param {Array} similarElements - 相似代码元素数组
   * @param {Object} dependencyGraph - 依赖图谱对象
   * @param {Object} task - 任务对象
   * @returns {Array} - 排序后的结果数组
   */
  rankResultsByDependencies(similarElements, dependencyGraph, task) {
    if (!dependencyGraph || !dependencyGraph.getNodeDependencies) {
      // 如果依赖图谱不可用，直接返回原结果
      return similarElements;
    }
    
    // 获取任务的依赖信息
    const taskDependencies = task.dependencies || [];
    
    // 计算每个结果的依赖关系得分
    const rankedResults = similarElements.map(element => {
      let dependencyScore = 0;
      
      // 获取元素的依赖
      const elementKey = this.getElementKey(element);
      const elementDependencies = dependencyGraph.getNodeDependencies(elementKey) || [];
      
      // 计算与任务依赖的匹配度
      for (const taskDep of taskDependencies) {
        for (const elemDep of elementDependencies) {
          if (elemDep.includes(taskDep) || taskDep.includes(elemDep)) {
            dependencyScore += 0.1; // 每匹配一个依赖增加0.1分
          }
        }
      }
      
      // 计算最终得分 = 相似度 * 0.8 + 依赖得分 * 0.2
      const finalScore = element.similarity * 0.8 + dependencyScore * 0.2;
      
      return {
        ...element,
        dependencyScore,
        finalScore
      };
    });
    
    // 按最终得分排序
    rankedResults.sort((a, b) => b.finalScore - a.finalScore);
    
    return rankedResults;
  }
  
  /**
   * 获取元素的唯一键
   * @param {Object} element - 代码元素
   * @returns {string} - 唯一键
   */
  getElementKey(element) {
    return `${element.type}:${element.item.filePath}:${element.item.name}`;
  }
  
  /**
   * 生成最终映射结果
   * @param {Array} rankedResults - 排序后的结果数组
   * @param {Object} task - 任务对象
   * @returns {Array} - 映射结果数组
   */
  generateMappingResults(rankedResults, task) {
    // 限制结果数量
    const limitedResults = rankedResults.slice(0, this.config.maxResults);
    
    // 转换为标准格式
    return limitedResults.map(result => {
      const { item, type, similarity, dependencyScore, finalScore } = result;
      
      return {
        task: {
          id: task.id,
          title: task.title,
          type: task.type
        },
        codeElement: {
          type,
          name: item.name,
          filePath: item.filePath,
          location: item.loc || { start: 0, end: 0 }
        },
        mapping: {
          similarity,
          dependencyScore: dependencyScore || 0,
          finalScore: finalScore || similarity,
          confidence: this.calculateConfidence(finalScore || similarity)
        }
      };
    });
  }
  
  /**
   * 计算映射置信度
   * @param {number} score - 相似度分数
   * @returns {string} - 置信度级别 (high, medium, low)
   */
  calculateConfidence(score) {
    if (score >= 0.8) {
      return 'high';
    } else if (score >= 0.6) {
      return 'medium';
    } else {
      return 'low';
    }
  }
}

module.exports = MappingAlgorithm;
