/**
 * 变更预测器
 * 负责预测代码变更的影响范围，生成变更计划
 */

class ChangePredictor {
  constructor(config = {}) {
    this.config = {
      impactThreshold: 0.5, // 影响阈值
      maxImpactedFiles: 20, // 最大影响文件数
      ...config
    };
  }
  
  /**
   * 预测代码变更的影响
   * @param {Array} mappingResults - 映射结果数组
   * @param {Object} dependencyGraph - 依赖图谱对象
   * @returns {Promise<Object>} - 变更预测结果
   */
  async predictChanges(mappingResults, dependencyGraph) {
    console.log('Predicting code changes impact...');
    
    // 提取需要修改的文件和代码元素
    const filesToModify = new Set();
    const codeElementsToModify = [];
    
    for (const result of mappingResults) {
      filesToModify.add(result.codeElement.filePath);
      codeElementsToModify.push({
        id: this.getElementId(result.codeElement),
        type: result.codeElement.type,
        name: result.codeElement.name,
        filePath: result.codeElement.filePath,
        confidence: result.mapping.confidence
      });
    }
    
    // 分析每个代码元素的影响
    const impactAnalysis = await this.analyzeImpact(codeElementsToModify, dependencyGraph);
    
    // 合并影响分析结果
    const mergedImpact = this.mergeImpactAnalysis(impactAnalysis);
    
    // 生成变更计划
    const changePlan = this.generateChangePlan(mergedImpact, filesToModify);
    
    return {
      filesToModify: Array.from(filesToModify),
      codeElementsToModify,
      impactAnalysis: mergedImpact,
      changePlan
    };
  }
  
  /**
   * 获取代码元素的ID
   * @param {Object} codeElement - 代码元素对象
   * @returns {string} - 元素ID
   */
  getElementId(codeElement) {
    return `${codeElement.type}:${codeElement.filePath}:${codeElement.name}`;
  }
  
  /**
   * 分析代码元素的影响
   * @param {Array} codeElements - 代码元素数组
   * @param {Object} dependencyGraph - 依赖图谱对象
   * @returns {Promise<Array>} - 影响分析结果数组
   */
  async analyzeImpact(codeElements, dependencyGraph) {
    const impactResults = [];
    
    for (const element of codeElements) {
      // 获取元素的影响分析
      const impact = dependencyGraph.getImpactAnalysis
        ? dependencyGraph.getImpactAnalysis(element.id)
        : this.fallbackImpactAnalysis(element, dependencyGraph);
      
      impactResults.push({
        element,
        impact
      });
    }
    
    return impactResults;
  }
  
  /**
   * 备用的影响分析方法（当依赖图谱不提供 getImpactAnalysis 方法时使用）
   * @param {Object} element - 代码元素
   * @param {Object} dependencyGraph - 依赖图谱对象
   * @returns {Object} - 影响分析结果
   */
  fallbackImpactAnalysis(element, dependencyGraph) {
    // 如果依赖图谱不提供 getNodeDependencies 方法，返回空结果
    if (!dependencyGraph.getNodeDependencies) {
      return {
        nodeId: element.id,
        node: element,
        impactedNodes: [],
        dependencyNodes: [],
        impactScore: 0,
        dependencyScore: 0
      };
    }
    
    // 获取依赖该节点的节点（被影响的节点）
    const impactedNodes = dependencyGraph.getNodeDependencies(element.id, {
      direction: 'incoming',
      depth: 2
    });
    
    // 获取该节点依赖的节点（影响源）
    const dependencyNodes = dependencyGraph.getNodeDependencies(element.id, {
      direction: 'outgoing',
      depth: 2
    });
    
    return {
      nodeId: element.id,
      node: element,
      impactedNodes,
      dependencyNodes,
      impactScore: impactedNodes.length,
      dependencyScore: dependencyNodes.length
    };
  }
  
  /**
   * 合并影响分析结果
   * @param {Array} impactResults - 影响分析结果数组
   * @returns {Object} - 合并后的影响分析
   */
  mergeImpactAnalysis(impactResults) {
    // 收集所有受影响的节点
    const allImpactedNodes = new Map();
    const allDependencyNodes = new Map();
    
    // 收集所有受影响的文件
    const impactedFiles = new Map();
    const dependencyFiles = new Map();
    
    // 处理每个影响分析结果
    for (const result of impactResults) {
      const { element, impact } = result;
      
      // 处理受影响的节点
      if (impact.impactedNodes) {
        for (const node of impact.impactedNodes) {
          if (!allImpactedNodes.has(node.id)) {
            allImpactedNodes.set(node.id, {
              node: node.node,
              sources: [element.id],
              weight: this.calculateNodeWeight(node, element)
            });
          } else {
            const existing = allImpactedNodes.get(node.id);
            existing.sources.push(element.id);
            existing.weight += this.calculateNodeWeight(node, element);
          }
          
          // 收集受影响的文件
          if (node.node.filePath && node.node.type !== 'file') {
            const filePath = node.node.filePath;
            if (!impactedFiles.has(filePath)) {
              impactedFiles.set(filePath, {
                path: filePath,
                elements: [node.id],
                weight: this.calculateFileWeight(node)
              });
            } else {
              const existing = impactedFiles.get(filePath);
              if (!existing.elements.includes(node.id)) {
                existing.elements.push(node.id);
                existing.weight += this.calculateFileWeight(node);
              }
            }
          } else if (node.node.path && node.node.type === 'file') {
            const filePath = node.node.path;
            if (!impactedFiles.has(filePath)) {
              impactedFiles.set(filePath, {
                path: filePath,
                elements: [node.id],
                weight: this.calculateFileWeight(node)
              });
            } else {
              const existing = impactedFiles.get(filePath);
              if (!existing.elements.includes(node.id)) {
                existing.elements.push(node.id);
                existing.weight += this.calculateFileWeight(node);
              }
            }
          }
        }
      }
      
      // 处理依赖节点
      if (impact.dependencyNodes) {
        for (const node of impact.dependencyNodes) {
          if (!allDependencyNodes.has(node.id)) {
            allDependencyNodes.set(node.id, {
              node: node.node,
              targets: [element.id],
              weight: this.calculateNodeWeight(node, element)
            });
          } else {
            const existing = allDependencyNodes.get(node.id);
            existing.targets.push(element.id);
            existing.weight += this.calculateNodeWeight(node, element);
          }
          
          // 收集依赖文件
          if (node.node.filePath && node.node.type !== 'file') {
            const filePath = node.node.filePath;
            if (!dependencyFiles.has(filePath)) {
              dependencyFiles.set(filePath, {
                path: filePath,
                elements: [node.id],
                weight: this.calculateFileWeight(node)
              });
            } else {
              const existing = dependencyFiles.get(filePath);
              if (!existing.elements.includes(node.id)) {
                existing.elements.push(node.id);
                existing.weight += this.calculateFileWeight(node);
              }
            }
          } else if (node.node.path && node.node.type === 'file') {
            const filePath = node.node.path;
            if (!dependencyFiles.has(filePath)) {
              dependencyFiles.set(filePath, {
                path: filePath,
                elements: [node.id],
                weight: this.calculateFileWeight(node)
              });
            } else {
              const existing = dependencyFiles.get(filePath);
              if (!existing.elements.includes(node.id)) {
                existing.elements.push(node.id);
                existing.weight += this.calculateFileWeight(node);
              }
            }
          }
        }
      }
    }
    
    // 转换为数组并排序
    const impactedNodesArray = Array.from(allImpactedNodes.values());
    impactedNodesArray.sort((a, b) => b.weight - a.weight);
    
    const dependencyNodesArray = Array.from(allDependencyNodes.values());
    dependencyNodesArray.sort((a, b) => b.weight - a.weight);
    
    const impactedFilesArray = Array.from(impactedFiles.values());
    impactedFilesArray.sort((a, b) => b.weight - a.weight);
    
    const dependencyFilesArray = Array.from(dependencyFiles.values());
    dependencyFilesArray.sort((a, b) => b.weight - a.weight);
    
    return {
      impactedNodes: impactedNodesArray,
      dependencyNodes: dependencyNodesArray,
      impactedFiles: impactedFilesArray,
      dependencyFiles: dependencyFilesArray,
      totalImpactScore: impactedNodesArray.reduce((sum, node) => sum + node.weight, 0),
      totalDependencyScore: dependencyNodesArray.reduce((sum, node) => sum + node.weight, 0)
    };
  }
  
  /**
   * 计算节点权重
   * @param {Object} node - 节点对象
   * @param {Object} sourceElement - 源元素对象
   * @returns {number} - 节点权重
   */
  calculateNodeWeight(node, sourceElement) {
    // 基础权重
    let weight = 1;
    
    // 根据深度调整权重（深度越大，权重越小）
    if (node.depth) {
      weight = weight / node.depth;
    }
    
    // 根据边的类型调整权重
    if (node.edge && node.edge.type) {
      switch (node.edge.type) {
        case 'calls':
          weight *= 1.5; // 函数调用关系权重更高
          break;
        case 'imports':
        case 'requires':
          weight *= 1.2; // 导入关系权重较高
          break;
        case 'contains':
          weight *= 0.8; // 包含关系权重较低
          break;
        default:
          break;
      }
    }
    
    // 根据源元素的置信度调整权重
    if (sourceElement.confidence) {
      switch (sourceElement.confidence) {
        case 'high':
          weight *= 1.2;
          break;
        case 'medium':
          weight *= 1.0;
          break;
        case 'low':
          weight *= 0.8;
          break;
        default:
          break;
      }
    }
    
    return weight;
  }
  
  /**
   * 计算文件权重
   * @param {Object} node - 节点对象
   * @returns {number} - 文件权重
   */
  calculateFileWeight(node) {
    // 基础权重
    let weight = 1;
    
    // 根据深度调整权重
    if (node.depth) {
      weight = weight / node.depth;
    }
    
    // 根据节点类型调整权重
    if (node.node && node.node.type) {
      switch (node.node.type) {
        case 'file':
          weight *= 1.0;
          break;
        case 'function':
          weight *= 1.2;
          break;
        case 'class':
          weight *= 1.5;
          break;
        case 'method':
          weight *= 1.3;
          break;
        default:
          break;
      }
    }
    
    return weight;
  }
  
  /**
   * 生成变更计划
   * @param {Object} impactAnalysis - 影响分析结果
   * @param {Set} filesToModify - 需要修改的文件集合
   * @returns {Object} - 变更计划
   */
  generateChangePlan(impactAnalysis, filesToModify) {
    // 确定需要修改的文件
    const primaryFiles = Array.from(filesToModify);
    
    // 确定可能受影响的文件（按权重排序，限制数量）
    const secondaryFiles = impactAnalysis.impactedFiles
      .filter(file => !filesToModify.has(file.path) && file.weight >= this.config.impactThreshold)
      .slice(0, this.config.maxImpactedFiles)
      .map(file => file.path);
    
    // 确定需要检查的依赖文件
    const dependencyFiles = impactAnalysis.dependencyFiles
      .filter(file => !filesToModify.has(file.path) && file.weight >= this.config.impactThreshold)
      .slice(0, this.config.maxImpactedFiles / 2)
      .map(file => file.path);
    
    // 生成变更计划
    return {
      primaryChanges: primaryFiles.map(filePath => ({
        filePath,
        changeType: 'modify',
        priority: 'high',
        description: '直接修改文件以实现功能'
      })),
      
      secondaryChanges: secondaryFiles.map(filePath => ({
        filePath,
        changeType: 'check',
        priority: 'medium',
        description: '检查文件是否需要适配修改'
      })),
      
      dependencyChecks: dependencyFiles.map(filePath => ({
        filePath,
        changeType: 'verify',
        priority: 'low',
        description: '验证依赖关系是否正常'
      })),
      
      impactSummary: {
        directChanges: primaryFiles.length,
        potentialImpact: secondaryFiles.length,
        dependenciesToVerify: dependencyFiles.length,
        totalImpactScore: impactAnalysis.totalImpactScore,
        riskLevel: this.calculateRiskLevel(impactAnalysis)
      }
    };
  }
  
  /**
   * 计算变更风险等级
   * @param {Object} impactAnalysis - 影响分析结果
   * @returns {string} - 风险等级 (low, medium, high)
   */
  calculateRiskLevel(impactAnalysis) {
    const { totalImpactScore, impactedFiles } = impactAnalysis;
    
    // 根据影响分数和影响文件数计算风险等级
    if (totalImpactScore > 50 || impactedFiles.length > 20) {
      return 'high';
    } else if (totalImpactScore > 20 || impactedFiles.length > 10) {
      return 'medium';
    } else {
      return 'low';
    }
  }
}

module.exports = ChangePredictor;
