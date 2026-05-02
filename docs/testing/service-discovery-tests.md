# 服务发现 (Service Discovery) 专项测试方案

> 关联 ADR: [ADR-002: 服务发现子系统架构演进](file:///Users/ljf/Desktop/hu_ts/hula/docs/adr/ADR-002-Service-Discovery-Architecture.md)  
> 适用范围: hula 后端微服务与前端 SDK 交互层

## 1. 单元测试 (Unit Tests)

重点验证 Registry 适配器逻辑与负载均衡算法的正确性。

### 1.1 负载均衡算法验证 (Rust 示例)

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_round_robin_balancer() {
        let instances = vec!["127.0.0.1:8080", "127.0.0.1:8081"];
        let mut balancer = RoundRobinBalancer::new(instances);
        
        assert_eq!(balancer.next(), Some("127.0.0.1:8080"));
        assert_eq!(balancer.next(), Some("127.0.0.1:8081"));
        assert_eq!(balancer.next(), Some("127.0.0.1:8080")); // 循环
    }

    #[test]
    fn test_consistent_hash_balancer() {
        let instances = vec!["node1", "node2"];
        let balancer = ConsistentHashBalancer::new(instances);
        
        let node_a = balancer.get_node("request_id_123");
        let node_b = balancer.get_node("request_id_123");
        assert_eq!(node_a, node_b); // 确定性哈希
    }
}
```

## 2. 集成测试 (Integration Tests)

验证 SDK 与真实注册中心（Consul/Etcd）的连接与监听逻辑。

### 2.1 Consul 注册与发现流程 (Shell/Curl 示例)

```bash
#!/bin/bash
# 模拟服务注册与发现集成测试

# 1. 向 Consul 注册模拟服务
curl --request PUT \
  --data '{"ID": "hula-api-1", "Name": "hula-api", "Address": "127.0.0.1", "Port": 9000, "Check": {"HTTP": "http://127.0.0.1:9000/health", "Interval": "10s"}}' \
  http://localhost:8500/v1/agent/service/register

# 2. 调用 hula 发现接口并验证
RESULT=$(curl -s http://localhost:3000/api/discover?service=hula-api)
if [[ $RESULT == *"9000"* ]]; then
  echo "Integration Test Passed: Service discovered."
else
  echo "Integration Test Failed: Service not found."
  exit 1
fi
```

## 3. 混沌测试 (Chaos Tests)

验证系统在极端网络或节点异常情况下的生存能力。

### 3.1 混沌演练脚本 (基于 Chaos Mesh 或自定义脚本)

```bash
#!/bin/bash
# 模拟注册中心分区与节点频繁上下线

echo ">>> 启动混沌演练：节点抖动测试"

# 1. 模拟 50% 的网络丢包 (针对 Consul 端口)
sudo tc qdisc add dev eth0 root netem loss 50% port 8500
echo "已注入 50% 网络丢包..."
sleep 30

# 2. 模拟服务节点快速重启
for i in {1..5}
do
   echo "重启模拟服务实例 $i..."
   # 停止并立即启动服务
   docker restart hula-api-node-$i
   sleep 2
done

# 3. 验证 hula 客户端是否触发了熔断与降级
# 检查日志中是否存在 "Circuit Breaker Triggered" 或 "Falling back to local cache"
LOG_COUNT=$(grep -c "Circuit Breaker" /var/log/hula/service.log)
if [ $LOG_COUNT -gt 0 ]; then
  echo "Chaos Test Passed: Circuit breaker active."
else
  echo "Chaos Test Warning: Circuit breaker not triggered under stress."
fi

# 清理环境
sudo tc qdisc del dev eth0 root
```

## 4. 验收指标 (KPI)

| 测试类型 | 关键指标 | 期望值 |
|---|---|---|
| 单元测试 | 分支覆盖率 | > 90% |
| 集成测试 | 发现延迟 (Discovery Latency) | < 100ms |
| 混沌测试 | 故障恢复时间 (MTTR) | < 5s |
| 混沌测试 | 请求错误率 (Error Rate) | < 1% (熔断期间) |
