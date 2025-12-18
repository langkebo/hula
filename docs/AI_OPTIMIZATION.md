# AI 模块内存优化报告

## 1. 优化目标
分析并优化 `luohuo-ai` 模块的内存占用，通过安全注释策略禁用未使用的 AI 功能，降低部署成本。

## 2. 优化方案
采用 **Maven 依赖注释 + 源码编译排除** 的双重策略：
1.  **依赖层**：在 `luohuo-ai-biz/pom.xml` 中注释掉了所有 `spring-ai-*` 相关依赖（OpenAI, Ollama, Alibaba, 向量数据库等）。
2.  **代码层**：在 `luohuo-ai-biz/pom.xml` 中添加 `maven-compiler-plugin` 配置，排除 `com/luohuo/flex/ai/**` 包下的所有源码参与编译。
    *   **优点**：无需修改几十个 Java 源文件，保持代码库整洁，可随时通过移除 POM 配置恢复。
    *   **安全性**：保留了完整代码，仅在构建阶段忽略。

## 3. 内存对比测试
测试环境：本地开发环境 (JDK 21)
测试对象：`luohuo-ai-server` (单节点启动)

| 指标 | 优化前 (Baseline) | 优化后 (Optimized) | 差异 | 变化幅度 |
| :--- | :--- | :--- | :--- | :--- |
| **RSS (物理内存)** | 468,284 KB (~457 MB) | 298,068 KB (~291 MB) | -170,216 KB | **-36.3%** |
| **VSZ (虚拟内存)** | 5.81 GB | 5.74 GB | -0.07 GB | -1.2% |

## 4. 结果分析
内存占用减少了约 **36% (170MB)**。主要收益来源于：
1.  **类加载减少**：移除 `spring-ai` 全家桶后，JVM 加载的类数量大幅减少（Metaspace 占用降低）。
2.  **Bean 初始化减少**：Spring Boot 启动时不再扫描和初始化大量的 AI AutoConfiguration Bean（如 `OpenAiChatClient`, `VectorStore` 等）。
3.  **线程池减少**：减少了后台维护的连接池和定时任务线程。

## 5. 恢复指南
若需重新启用 AI 功能，请执行以下步骤：
1.  打开 `luohuo-cloud/luohuo-ai/luohuo-ai-biz/pom.xml`。
2.  **取消注释** `<!-- Spring AI Model 模型接入 -->` 块内的所有依赖。
3.  **移除** `<build>` 标签下的 `<excludes>` 配置块。
4.  重新执行 `mvn clean install`。
