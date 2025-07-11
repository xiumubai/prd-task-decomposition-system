/**
 * 依赖分析器
 * 负责分析代码间的依赖关系，建立依赖图谱
 */

const fs = require('fs').promises;
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

class DependencyAnalyzer {
  constructor(config = {}) {
    this.config = {
      maxDepth: 3, // 依赖分析的最大深度
      includeNodeModules: false, // 是否包含node_modules
      ...config
    };
    
    this.dependencyGraph = {
      nodes: {}, // 节点信息
      edges: [], // 边信息
      metadata: {
        createdAt: null,
        nodeCount: 0,
        edgeCount: 0
      }
    };
  }
  
  /**
   * 构建依赖图谱
   * @param {Object} codeIndex - 代码索引对象
   * @returns {Promise<Object>} - 依赖图谱对象
   */
  async buildDependencyGraph(codeIndex) {
    console.log('Building dependency graph...');
    
    // 重置依赖图谱
    this.resetDependencyGraph();
    
    // 添加所有文件作为节点
    this.addFilesToGraph(codeIndex.files);
    
    // 添加所有函数作为节点
    this.addFunctionsToGraph(codeIndex.functions);
    
    // 添加所有类作为节点
    this.addClassesToGraph(codeIndex.classes);
    
    // 分析文件间的依赖关系
    await this.analyzeFileDependencies(codeIndex.files);
    
    // 分析函数调用关系
    await this.analyzeFunctionCalls(codeIndex.functions, codeIndex.files);
    
    // 更新元数据
    this.updateGraphMetadata();
    
    console.log(`Dependency graph built. ${this.dependencyGraph.metadata.nodeCount} nodes, ${this.dependencyGraph.metadata.edgeCount} edges.`);
    
    return this.dependencyGraph;
  }
  
  /**
   * 重置依赖图谱
   */
  resetDependencyGraph() {
    this.dependencyGraph = {
      nodes: {},
      edges: [],
      metadata: {
        createdAt: null,
        nodeCount: 0,
        edgeCount: 0
      }
    };
  }
  
  /**
   * 更新图谱元数据
   */
  updateGraphMetadata() {
    this.dependencyGraph.metadata = {
      createdAt: new Date().toISOString(),
      nodeCount: Object.keys(this.dependencyGraph.nodes).length,
      edgeCount: this.dependencyGraph.edges.length
    };
  }
  
  /**
   * 添加文件到图谱
   * @param {Array} files - 文件数组
   */
  addFilesToGraph(files) {
    for (const file of files) {
      const nodeId = `file:${file.path}`;
      
      this.dependencyGraph.nodes[nodeId] = {
        id: nodeId,
        type: 'file',
        name: file.name,
        path: file.path,
        size: file.size,
        lastModified: file.lastModified
      };
    }
  }
  
  /**
   * 添加函数到图谱
   * @param {Array} functions - 函数数组
   */
  addFunctionsToGraph(functions) {
    for (const func of functions) {
      const nodeId = `function:${func.filePath}:${func.name}`;
      
      this.dependencyGraph.nodes[nodeId] = {
        id: nodeId,
        type: 'function',
        name: func.name,
        filePath: func.filePath,
        params: func.params,
        loc: func.loc
      };
      
      // 添加函数与其所在文件的依赖关系
      this.addEdge(
        nodeId,
        `file:${func.filePath}`,
        'contains'
      );
    }
  }
  
  /**
   * 添加类到图谱
   * @param {Array} classes - 类数组
   */
  addClassesToGraph(classes) {
    for (const cls of classes) {
      const nodeId = `class:${cls.filePath}:${cls.name}`;
      
      this.dependencyGraph.nodes[nodeId] = {
        id: nodeId,
        type: 'class',
        name: cls.name,
        filePath: cls.filePath,
        methods: cls.methods,
        loc: cls.loc
      };
      
      // 添加类与其所在文件的依赖关系
      this.addEdge(
        nodeId,
        `file:${cls.filePath}`,
        'contains'
      );
      
      // 添加类方法
      for (const method of cls.methods) {
        const methodNodeId = `method:${cls.filePath}:${cls.name}.${method.name}`;
        
        this.dependencyGraph.nodes[methodNodeId] = {
          id: methodNodeId,
          type: 'method',
          name: method.name,
          className: cls.name,
          filePath: cls.filePath,
          params: method.params,
          loc: method.loc
        };
        
        // 添加方法与类的依赖关系
        this.addEdge(
          methodNodeId,
          nodeId,
          'memberOf'
        );
      }
    }
  }
  
  /**
   * 添加边到图谱
   * @param {string} sourceId - 源节点ID
   * @param {string} targetId - 目标节点ID
   * @param {string} type - 边类型
   * @param {Object} metadata - 边元数据
   */
  addEdge(sourceId, targetId, type, metadata = {}) {
    // 检查源节点和目标节点是否存在
    if (!this.dependencyGraph.nodes[sourceId] || !this.dependencyGraph.nodes[targetId]) {
      return;
    }
    
    // 检查边是否已存在
    const existingEdge = this.dependencyGraph.edges.find(edge => 
      edge.source === sourceId && edge.target === targetId && edge.type === type
    );
    
    if (existingEdge) {
      // 如果边已存在，更新元数据
      Object.assign(existingEdge.metadata, metadata);
    } else {
      // 如果边不存在，添加新边
      this.dependencyGraph.edges.push({
        source: sourceId,
        target: targetId,
        type,
        metadata: {
          weight: 1, // 默认权重
          ...metadata
        }
      });
    }
  }
  
  /**
   * 分析文件间的依赖关系
   * @param {Array} files - 文件数组
   * @returns {Promise<void>}
   */
  async analyzeFileDependencies(files) {
    for (const file of files) {
      try {
        // 读取文件内容
        const content = await fs.readFile(file.path, 'utf-8');
        
        // 解析代码为AST
        const ast = parser.parse(content, {
          sourceType: 'module',
          plugins: ['jsx', 'typescript', 'classProperties']
        });
        
        // 分析导入语句
        traverse(ast, {
          ImportDeclaration: (nodePath) => {
            const node = nodePath.node;
            const importPath = node.source.value;
            
            // 解析导入路径
            const resolvedPath = this.resolveImportPath(importPath, file.path);
            if (resolvedPath) {
              // 添加文件依赖关系
              this.addEdge(
                `file:${file.path}`,
                `file:${resolvedPath}`,
                'imports'
              );
            }
          },
          
          // 分析 require 语句
          CallExpression: (nodePath) => {
            const node = nodePath.node;
            
            if (
              node.callee.type === 'Identifier' &&
              node.callee.name === 'require' &&
              node.arguments.length > 0 &&
              node.arguments[0].type === 'StringLiteral'
            ) {
              const importPath = node.arguments[0].value;
              
              // 解析导入路径
              const resolvedPath = this.resolveImportPath(importPath, file.path);
              if (resolvedPath) {
                // 添加文件依赖关系
                this.addEdge(
                  `file:${file.path}`,
                  `file:${resolvedPath}`,
                  'requires'
                );
              }
            }
          }
        });
      } catch (error) {
        console.error(`Error analyzing dependencies for file ${file.path}:`, error);
      }
    }
  }
  
  /**
   * 解析导入路径
   * @param {string} importPath - 导入路径
   * @param {string} currentFilePath - 当前文件路径
   * @returns {string|null} - 解析后的绝对路径
   */
  resolveImportPath(importPath, currentFilePath) {
    // 跳过 node_modules 导入，除非配置允许
    if (!this.config.includeNodeModules && (
      importPath.startsWith('node_modules/') ||
      !importPath.startsWith('.') && !importPath.startsWith('/')
    )) {
      return null;
    }
    
    try {
      let resolvedPath;
      
      if (importPath.startsWith('.')) {
        // 相对路径
        const currentDir = path.dirname(currentFilePath);
        resolvedPath = path.resolve(currentDir, importPath);
      } else if (importPath.startsWith('/')) {
        // 绝对路径
        resolvedPath = importPath;
      } else {
        // 模块路径，跳过
        return null;
      }
      
      // 检查文件扩展名
      if (!path.extname(resolvedPath)) {
        // 尝试添加常见的扩展名
        for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
          const pathWithExt = `${resolvedPath}${ext}`;
          try {
            if (fs.existsSync(pathWithExt)) {
              return pathWithExt;
            }
          } catch (e) {
            // 忽略错误
          }
        }
        
        // 尝试作为目录处理，查找 index 文件
        for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
          const indexPath = path.join(resolvedPath, `index${ext}`);
          try {
            if (fs.existsSync(indexPath)) {
              return indexPath;
            }
          } catch (e) {
            // 忽略错误
          }
        }
      }
      
      return resolvedPath;
    } catch (error) {
      console.error(`Error resolving import path ${importPath}:`, error);
      return null;
    }
  }
  
  /**
   * 分析函数调用关系
   * @param {Array} functions - 函数数组
   * @param {Array} files - 文件数组
   * @returns {Promise<void>}
   */
  async analyzeFunctionCalls(functions, files) {
    // 创建函数名到函数ID的映射
    const functionMap = {};
    for (const func of functions) {
      functionMap[func.name] = `function:${func.filePath}:${func.name}`;
    }
    
    // 分析每个文件中的函数调用
    for (const file of files) {
      try {
        // 读取文件内容
        const content = await fs.readFile(file.path, 'utf-8');
        
        // 解析代码为AST
        const ast = parser.parse(content, {
          sourceType: 'module',
          plugins: ['jsx', 'typescript', 'classProperties']
        });
        
        // 分析函数调用
        traverse(ast, {
          CallExpression: (nodePath) => {
            const node = nodePath.node;
            
            if (node.callee.type === 'Identifier') {
              const calleeName = node.callee.name;
              
              // 检查是否调用了已知函数
              if (functionMap[calleeName]) {
                // 获取当前函数上下文
                let currentFunction = null;
                let currentFunctionName = null;
                
                // 向上查找函数声明或表达式
                let parent = nodePath.parentPath;
                while (parent && !currentFunction) {
                  if (parent.node.type === 'FunctionDeclaration') {
                    currentFunction = parent.node;
                    currentFunctionName = currentFunction.id ? currentFunction.id.name : 'anonymous';
                    break;
                  } else if (parent.node.type === 'FunctionExpression' || parent.node.type === 'ArrowFunctionExpression') {
                    currentFunction = parent.node;
                    
                    // 尝试获取函数名
                    if (parent.parent && parent.parent.node.type === 'VariableDeclarator') {
                      currentFunctionName = parent.parent.node.id.name;
                    } else {
                      currentFunctionName = 'anonymous';
                    }
                    break;
                  }
                  
                  parent = parent.parentPath;
                }
                
                if (currentFunctionName && currentFunctionName !== 'anonymous') {
                  const callerId = `function:${file.path}:${currentFunctionName}`;
                  const calleeId = functionMap[calleeName];
                  
                  // 添加函数调用关系
                  this.addEdge(
                    callerId,
                    calleeId,
                    'calls',
                    { weight: 1 }
                  );
                }
              }
            }
          }
        });
      } catch (error) {
        console.error(`Error analyzing function calls for file ${file.path}:`, error);
      }
    }
  }
  
  /**
   * 获取节点的依赖关系
   * @param {string} nodeId - 节点ID
   * @param {Object} options - 选项
   * @returns {Array} - 依赖节点数组
   */
  getNodeDependencies(nodeId, options = {}) {
    const defaults = {
      direction: 'outgoing', // 'outgoing', 'incoming', 'both'
      types: null, // 边类型过滤，null表示所有类型
      depth: 1, // 依赖深度
      maxResults: 100 // 最大结果数
    };
    
    const config = { ...defaults, ...options };
    
    // 检查节点是否存在
    if (!this.dependencyGraph.nodes[nodeId]) {
      return [];
    }
    
    const visited = new Set();
    const dependencies = [];
    
    // 递归获取依赖
    this.getDependenciesRecursive(
      nodeId,
      config,
      visited,
      dependencies,
      0
    );
    
    return dependencies;
  }
  
  /**
   * 递归获取依赖关系
   * @param {string} nodeId - 节点ID
   * @param {Object} options - 选项
   * @param {Set} visited - 已访问节点集合
   * @param {Array} dependencies - 依赖数组
   * @param {number} currentDepth - 当前深度
   */
  getDependenciesRecursive(nodeId, options, visited, dependencies, currentDepth) {
    // 检查深度限制
    if (currentDepth >= options.depth) {
      return;
    }
    
    // 标记节点为已访问
    visited.add(nodeId);
    
    // 获取相关边
    const edges = this.dependencyGraph.edges.filter(edge => {
      if (options.direction === 'outgoing') {
        return edge.source === nodeId;
      } else if (options.direction === 'incoming') {
        return edge.target === nodeId;
      } else { // 'both'
        return edge.source === nodeId || edge.target === nodeId;
      }
    });
    
    // 过滤边类型
    const filteredEdges = options.types
      ? edges.filter(edge => options.types.includes(edge.type))
      : edges;
    
    // 处理每条边
    for (const edge of filteredEdges) {
      const targetId = options.direction === 'incoming' ? edge.source : edge.target;
      
      // 跳过已访问的节点
      if (visited.has(targetId)) {
        continue;
      }
      
      // 获取目标节点
      const targetNode = this.dependencyGraph.nodes[targetId];
      if (!targetNode) {
        continue;
      }
      
      // 添加到依赖数组
      dependencies.push({
        id: targetId,
        node: targetNode,
        edge: edge,
        depth: currentDepth + 1
      });
      
      // 检查结果数量限制
      if (dependencies.length >= options.maxResults) {
        return;
      }
      
      // 递归获取下一级依赖
      this.getDependenciesRecursive(
        targetId,
        options,
        visited,
        dependencies,
        currentDepth + 1
      );
    }
  }
  
  /**
   * 获取影响分析
   * @param {string} nodeId - 节点ID
   * @returns {Object} - 影响分析结果
   */
  getImpactAnalysis(nodeId) {
    // 获取依赖该节点的节点（被影响的节点）
    const impactedNodes = this.getNodeDependencies(nodeId, {
      direction: 'incoming',
      depth: this.config.maxDepth
    });
    
    // 获取该节点依赖的节点（影响源）
    const dependencyNodes = this.getNodeDependencies(nodeId, {
      direction: 'outgoing',
      depth: this.config.maxDepth
    });
    
    return {
      nodeId,
      node: this.dependencyGraph.nodes[nodeId],
      impactedNodes,
      dependencyNodes,
      impactScore: impactedNodes.length, // 简单的影响分数
      dependencyScore: dependencyNodes.length // 简单的依赖分数
    };
  }
}

module.exports = DependencyAnalyzer;
