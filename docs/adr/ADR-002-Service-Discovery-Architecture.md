# ADR-002: 服务发现子系统架构演进 (Service Discovery SDK)

## 状态

- [x] 提议
- [ ] 接受
- [ ] 弃用
- [ ] 已取代

## 背景

在 `hula` 与 `element-desktop` 的集成场景中，应用不仅需要发现 Matrix Homeserver，还需要与后端的微服务治理体系（如 Consul, Etcd）对接。当前 `hula` 的服务发现逻辑仅限于 Matrix 协议定义的 `.well-known` 发现，缺乏生产级的注册中心支持、负载均衡、熔断限流等特性。

## 决策

我们将设计并实现一个统一的 **Service Discovery SDK**，作为 `hula` 核心服务层的一部分，支持多注册中心平滑切换与高级治理特性。

### 1. 核心架构设计

- **Registry Interface (适配器模式)**: 定义统一的注册与发现接口，屏蔽 Consul, Etcd, Zookeeper 的底层差异。
- **Load Balancer (策略模式)**: 提供可插拔的负载均衡算法（Round Robin, Random, Least Connections, Consistent Hashing）。
- **Governance Middleware**: 引入熔断器（Circuit Breaker）、限流器（Rate Limiter）和重试退避机制。
- **Observable Layer**: 统一暴露 Prometheus 指标，并集成 OpenTelemetry 追踪请求链路。

### 2. 技术规格

- **注册中心支持**:
    - Consul (HTTP API)
    - Etcd (gRPC)
    - Static Config (用于本地调试)
- **健康检查**:
    - 支持 TCP 探测
    - 支持 HTTP 200 OK 校验
    - 支持 gRPC Health Checking Protocol
- **高可用保障**:
    - 支持多注册中心“双写”与“双读”容灾。
    - 节点上下线实时监听（Watch/Poll 机制）。
    - 配置变更版本号 + CRC 校验，防止脑裂。

### 3. 集成路径

1. **Phase 1**: 在 Rust 侧实现核心发现逻辑，并通过 Tauri Command 暴露给 Vue 侧。
2. **Phase 2**: 替换现有的 Matrix 静态 Endpoint 发现，接入 Service Discovery SDK。
3. **Phase 3**: 开启 Prometheus 指标采集与告警。

## 后果

### 正面影响

- 支持生产级微服务治理，满足高可用要求。
- 架构高度可扩展，支持未来引入新的注册中心。
- 提升了系统的可观测性。

### 负面影响

- 增加了系统的复杂性，需要管理注册中心的生命周期。
- 引入了额外的运行时依赖（如各注册中心的 SDK 或 Client）。

## 替代方案

- **方案 A**: 继续使用静态配置。优点是简单，缺点是无法应对动态扩缩容。
- **方案 B**: 仅支持 Consul。优点是开发快，缺点是缺乏灵活性，不符合“多注册中心”需求。

## 关联任务

- `P3-SD-01` 实现 Registry 适配器层
- `P3-SD-02` 集成负载均衡策略
- `P3-SD-03` 接入 Prometheus 监控指标
