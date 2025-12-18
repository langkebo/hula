# HuLa E2EE 监控系统部署指南

## 📋 目录

- [概述](#概述)
- [架构说明](#架构说明)
- [环境准备](#环境准备)
- [Prometheus部署](#prometheus部署)
- [Grafana部署](#grafana部署)
- [AlertManager部署](#alertmanager部署)
- [集成测试](#集成测试)
- [常见问题](#常见问题)

---

## 概述

本指南详细说明如何部署HuLa E2EE端到端加密系统的完整监控解决方案，包括：

- **Prometheus**: 指标收集和存储
- **Grafana**: 可视化监控仪表盘
- **AlertManager**: 告警管理和通知

### 监控指标

E2EE系统提供以下监控指标：

- 加密/解密性能指标
- 缓存命中率
- 错误率统计
- 系统健康状态
- 清理操作统计
- 活跃用户/会话数

---

## 架构说明

### 监控架构图

```
┌─────────────────┐
│   HuLa E2EE     │
│   Application   │──────┐
└─────────────────┘      │
                         │ /actuator/prometheus
                         ▼
                  ┌──────────────┐
                  │  Prometheus  │
                  │   Server     │
                  └──────┬───────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
  ┌────────────┐  ┌────────────┐  ┌────────────┐
  │  Grafana   │  │AlertManager│  │  Storage   │
  │ Dashboard  │  │  Alerts    │  │   (TSDB)   │
  └────────────┘  └────────────┘  └────────────┘
         │               │
         │               │
         ▼               ▼
  ┌────────────┐  ┌────────────┐
  │   Users    │  │Email/钉钉  │
  │  Viewing   │  │Notification│
  └────────────┘  └────────────┘
```

### 数据流

1. **HuLa E2EE应用** 通过Micrometer暴露Prometheus格式的指标
2. **Prometheus** 定期抓取应用的 `/actuator/prometheus` 端点
3. **Prometheus** 评估告警规则并触发AlertManager
4. **AlertManager** 根据配置发送告警通知
5. **Grafana** 从Prometheus查询数据并展示仪表盘

---

## 环境准备

### 系统要求

**最低配置**:
- CPU: 2核
- 内存: 4GB
- 磁盘: 50GB SSD
- 操作系统: Linux (Ubuntu 20.04+/CentOS 7+)

**推荐配置**:
- CPU: 4核
- 内存: 8GB
- 磁盘: 100GB SSD

### 软件依赖

```bash
# 更新系统
sudo apt-get update
sudo apt-get upgrade -y

# 安装基础工具
sudo apt-get install -y wget curl tar gzip
```

### 端口规划

| 服务 | 端口 | 说明 |
|------|------|------|
| HuLa E2EE | 8080 | 应用服务 |
| Prometheus | 9090 | Web UI和API |
| Grafana | 3000 | Web UI |
| AlertManager | 9093 | Web UI和API |

---

## Prometheus部署

### 1. 下载和安装

```bash
# 创建目录
sudo mkdir -p /opt/prometheus
cd /opt/prometheus

# 下载Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz

# 解压
tar xvfz prometheus-2.45.0.linux-amd64.tar.gz
cd prometheus-2.45.0.linux-amd64

# 创建数据目录
sudo mkdir -p /var/lib/prometheus
sudo mkdir -p /etc/prometheus
```

### 2. 配置Prometheus

```bash
# 复制配置文件到标准位置
sudo cp prometheus.yml /etc/prometheus/

# 编辑配置文件
sudo vi /etc/prometheus/prometheus.yml
```

**prometheus.yml配置**:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'hula-production'
    region: 'cn-east-1'

# 告警规则文件
rule_files:
  - '/etc/prometheus/rules/e2ee_alerts.yml'

# 抓取配置
scrape_configs:
  # HuLa E2EE应用
  - job_name: 'hula-e2ee'
    metrics_path: '/actuator/prometheus'
    static_configs:
      - targets: ['localhost:8080']
        labels:
          service: 'e2ee'
          env: 'production'

  # Prometheus自监控
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

# AlertManager配置
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['localhost:9093']
```

### 3. 部署告警规则

```bash
# 创建规则目录
sudo mkdir -p /etc/prometheus/rules

# 复制告警规则文件
sudo cp /path/to/HuLa-Server-master/luohuo-cloud/luohuo-im/docs/prometheus/e2ee_alerts.yml \
  /etc/prometheus/rules/

# 验证规则语法
/opt/prometheus/prometheus-2.45.0.linux-amd64/promtool check rules \
  /etc/prometheus/rules/e2ee_alerts.yml
```

### 4. 创建systemd服务

```bash
sudo vi /etc/systemd/system/prometheus.service
```

**prometheus.service**:

```ini
[Unit]
Description=Prometheus
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=prometheus
Group=prometheus
ExecStart=/opt/prometheus/prometheus-2.45.0.linux-amd64/prometheus \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.path=/var/lib/prometheus/ \
  --storage.tsdb.retention.time=30d \
  --web.console.templates=/opt/prometheus/prometheus-2.45.0.linux-amd64/consoles \
  --web.console.libraries=/opt/prometheus/prometheus-2.45.0.linux-amd64/console_libraries \
  --web.enable-lifecycle

Restart=always
RestartSec=10s

[Install]
WantedBy=multi-user.target
```

### 5. 启动Prometheus

```bash
# 创建prometheus用户
sudo useradd --no-create-home --shell /bin/false prometheus

# 设置权限
sudo chown -R prometheus:prometheus /var/lib/prometheus
sudo chown -R prometheus:prometheus /etc/prometheus

# 重载systemd
sudo systemctl daemon-reload

# 启动Prometheus
sudo systemctl start prometheus
sudo systemctl enable prometheus

# 检查状态
sudo systemctl status prometheus

# 查看日志
sudo journalctl -u prometheus -f
```

### 6. 验证Prometheus

```bash
# 检查Prometheus是否运行
curl http://localhost:9090/-/healthy

# 访问Web UI
# 浏览器打开: http://your-server:9090

# 验证目标状态
curl http://localhost:9090/api/v1/targets

# 测试查询
curl 'http://localhost:9090/api/v1/query?query=up'
```

---

## Grafana部署

### 1. 安装Grafana

```bash
# 添加Grafana仓库
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"

# 添加GPG密钥
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -

# 更新并安装
sudo apt-get update
sudo apt-get install -y grafana

# 或使用二进制安装
cd /tmp
wget https://dl.grafana.com/oss/release/grafana-10.0.0.linux-amd64.tar.gz
tar -zxvf grafana-10.0.0.linux-amd64.tar.gz
sudo mv grafana-10.0.0 /opt/grafana
```

### 2. 配置Grafana

```bash
# 编辑配置文件
sudo vi /etc/grafana/grafana.ini
```

**关键配置**:

```ini
[server]
http_port = 3000
domain = your-domain.com
root_url = http://your-domain.com:3000/

[security]
admin_user = admin
admin_password = your_secure_password

[users]
allow_sign_up = false

[auth.anonymous]
enabled = false

[smtp]
enabled = true
host = smtp.example.com:587
user = grafana@hula.com
password = your_smtp_password
from_address = grafana@hula.com
from_name = HuLa Grafana
```

### 3. 启动Grafana

```bash
# 启动Grafana服务
sudo systemctl start grafana-server
sudo systemctl enable grafana-server

# 检查状态
sudo systemctl status grafana-server

# 查看日志
sudo tail -f /var/log/grafana/grafana.log
```

### 4. 配置Prometheus数据源

```bash
# 方式1: 通过Web UI配置
# 1. 访问 http://your-server:3000
# 2. 登录 (admin/your_password)
# 3. Configuration → Data Sources → Add data source
# 4. 选择Prometheus
# 5. URL: http://localhost:9090
# 6. Save & Test

# 方式2: 通过配置文件
sudo vi /etc/grafana/provisioning/datasources/prometheus.yml
```

**prometheus.yml (数据源配置)**:

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://localhost:9090
    isDefault: true
    jsonData:
      timeInterval: 15s
      httpMethod: POST
    editable: false
```

### 5. 导入E2EE仪表盘

```bash
# 复制仪表盘JSON到provisioning目录
sudo mkdir -p /etc/grafana/provisioning/dashboards
sudo cp /path/to/HuLa-Server-master/luohuo-cloud/luohuo-im/docs/grafana/E2EE_Dashboard.json \
  /etc/grafana/provisioning/dashboards/

# 创建provisioning配置
sudo vi /etc/grafana/provisioning/dashboards/dashboards.yml
```

**dashboards.yml**:

```yaml
apiVersion: 1

providers:
  - name: 'E2EE Dashboards'
    orgId: 1
    folder: 'HuLa'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
```

```bash
# 重启Grafana加载仪表盘
sudo systemctl restart grafana-server
```

### 6. 验证Grafana

```bash
# 访问Grafana Web UI
# http://your-server:3000

# 验证数据源
curl -u admin:your_password \
  http://localhost:3000/api/datasources

# 验证仪表盘
curl -u admin:your_password \
  http://localhost:3000/api/search?query=E2EE
```

---

## AlertManager部署

### 1. 下载和安装

```bash
# 下载AlertManager
cd /opt
wget https://github.com/prometheus/alertmanager/releases/download/v0.26.0/alertmanager-0.26.0.linux-amd64.tar.gz

# 解压
tar xvfz alertmanager-0.26.0.linux-amd64.tar.gz
cd alertmanager-0.26.0.linux-amd64

# 创建目录
sudo mkdir -p /etc/alertmanager
sudo mkdir -p /var/lib/alertmanager
```

### 2. 配置AlertManager

```bash
# 复制配置文件
sudo cp /path/to/HuLa-Server-master/luohuo-cloud/luohuo-im/docs/prometheus/alertmanager.yml \
  /etc/alertmanager/

# 编辑配置（修改邮件服务器等信息）
sudo vi /etc/alertmanager/alertmanager.yml
```

**重要配置项**:

```yaml
global:
  # 修改为实际的SMTP服务器
  smtp_smarthost: 'smtp.example.com:587'
  smtp_from: 'alert@hula.com'
  smtp_auth_username: 'alert@hula.com'
  smtp_auth_password: 'your_password'

receivers:
  - name: 'critical-alerts'
    email_configs:
      - to: 'ops@hula.com,oncall@hula.com'  # 修改为实际邮箱

    # 配置钉钉机器人（可选）
    webhook_configs:
      - url: 'https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN'
```

### 3. 创建systemd服务

```bash
sudo vi /etc/systemd/system/alertmanager.service
```

**alertmanager.service**:

```ini
[Unit]
Description=Alertmanager
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=alertmanager
Group=alertmanager
ExecStart=/opt/alertmanager-0.26.0.linux-amd64/alertmanager \
  --config.file=/etc/alertmanager/alertmanager.yml \
  --storage.path=/var/lib/alertmanager/ \
  --web.listen-address=:9093

Restart=always
RestartSec=10s

[Install]
WantedBy=multi-user.target
```

### 4. 启动AlertManager

```bash
# 创建alertmanager用户
sudo useradd --no-create-home --shell /bin/false alertmanager

# 设置权限
sudo chown -R alertmanager:alertmanager /var/lib/alertmanager
sudo chown -R alertmanager:alertmanager /etc/alertmanager

# 重载systemd
sudo systemctl daemon-reload

# 启动AlertManager
sudo systemctl start alertmanager
sudo systemctl enable alertmanager

# 检查状态
sudo systemctl status alertmanager

# 查看日志
sudo journalctl -u alertmanager -f
```

### 5. 验证AlertManager

```bash
# 检查AlertManager健康状态
curl http://localhost:9093/-/healthy

# 访问Web UI
# http://your-server:9093

# 测试告警
curl -X POST http://localhost:9093/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {
      "alertname": "TestAlert",
      "severity": "warning"
    },
    "annotations": {
      "summary": "This is a test alert"
    }
  }]'
```

---

## 集成测试

### 1. 端到端测试流程

```bash
# 1. 确保HuLa E2EE应用正在运行
curl http://localhost:8080/e2ee/health

# 2. 检查Prometheus是否抓取到指标
curl 'http://localhost:9090/api/v1/query?query=e2ee_encryption_time_seconds_count'

# 3. 检查Grafana仪表盘
# 访问: http://your-server:3000/d/hula-e2ee-dashboard

# 4. 触发测试告警
# 方式1: 模拟高延迟（修改应用配置）
# 方式2: 手动发送测试告警到AlertManager

# 5. 验证告警通知
# 检查邮箱是否收到告警邮件
```

### 2. 性能测试

```bash
# 测试Prometheus查询性能
time curl -s 'http://localhost:9090/api/v1/query_range?query=rate(e2ee_messages_encrypted_total[5m])&start=2024-01-01T00:00:00Z&end=2024-01-02T00:00:00Z&step=1m' > /dev/null

# 测试Grafana加载速度
# 打开浏览器开发者工具，访问仪表盘，检查加载时间

# 检查Prometheus存储使用
du -sh /var/lib/prometheus
```

### 3. 故障恢复测试

```bash
# 测试1: Prometheus重启
sudo systemctl restart prometheus
# 等待30秒
curl http://localhost:9090/-/healthy

# 测试2: Grafana重启
sudo systemctl restart grafana-server
# 访问 http://your-server:3000

# 测试3: AlertManager重启
sudo systemctl restart alertmanager
curl http://localhost:9093/-/healthy
```

---

## 常见问题

### Q1: Prometheus无法抓取E2EE应用指标

**症状**: Prometheus Targets页面显示应用为DOWN状态

**排查步骤**:

```bash
# 1. 检查应用是否运行
curl http://localhost:8080/actuator/health

# 2. 检查指标端点是否可访问
curl http://localhost:8080/actuator/prometheus

# 3. 检查防火墙
sudo ufw status
sudo ufw allow 8080/tcp

# 4. 检查Prometheus配置
cat /etc/prometheus/prometheus.yml | grep -A 5 hula-e2ee

# 5. 重启Prometheus
sudo systemctl restart prometheus
```

### Q2: Grafana无法连接Prometheus

**症状**: Grafana数据源测试失败

**解决方案**:

```bash
# 1. 验证Prometheus是否运行
curl http://localhost:9090/-/healthy

# 2. 检查Grafana数据源配置
sudo vi /etc/grafana/provisioning/datasources/prometheus.yml

# 3. 确保URL正确
# 如果Prometheus在同一台机器: http://localhost:9090
# 如果在不同机器: http://prometheus-ip:9090

# 4. 重启Grafana
sudo systemctl restart grafana-server
```

### Q3: 没有收到告警通知

**症状**: 告警触发但未收到邮件

**排查步骤**:

```bash
# 1. 检查AlertManager日志
sudo journalctl -u alertmanager -f | grep -i error

# 2. 验证SMTP配置
sudo vi /etc/alertmanager/alertmanager.yml
# 确认smtp_smarthost, smtp_from, smtp_auth_username等配置正确

# 3. 测试SMTP连接
telnet smtp.example.com 587

# 4. 手动发送测试告警
curl -X POST http://localhost:9093/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {"alertname": "TestEmail", "severity": "critical"},
    "annotations": {"summary": "Email test"}
  }]'

# 5. 检查告警状态
curl http://localhost:9093/api/v1/alerts
```

### Q4: Grafana仪表盘显示"No Data"

**症状**: 仪表盘面板无数据

**解决方案**:

```bash
# 1. 验证指标是否存在
curl 'http://localhost:9090/api/v1/label/__name__/values' | grep e2ee

# 2. 检查时间范围
# 确保选择的时间范围内有数据

# 3. 验证查询语法
# 在Prometheus UI中测试查询

# 4. 检查数据源
# Grafana → Configuration → Data Sources → Prometheus
# 点击"Save & Test"
```

### Q5: Prometheus存储空间不足

**症状**: Prometheus日志显示存储错误

**解决方案**:

```bash
# 1. 检查磁盘使用
df -h /var/lib/prometheus

# 2. 清理旧数据
# 修改数据保留时间
sudo vi /etc/systemd/system/prometheus.service
# 将 --storage.tsdb.retention.time=30d 改为 15d

# 3. 重启Prometheus
sudo systemctl daemon-reload
sudo systemctl restart prometheus

# 4. 或者挂载新的存储
sudo mkdir /data/prometheus
sudo chown prometheus:prometheus /data/prometheus
# 修改service文件中的 --storage.tsdb.path
```

---

## 维护建议

### 日常检查

```bash
# 每日检查脚本
cat > /usr/local/bin/check-monitoring.sh << 'EOF'
#!/bin/bash
echo "=== Monitoring Health Check ==="
echo "Prometheus: $(curl -s http://localhost:9090/-/healthy)"
echo "Grafana: $(curl -s http://localhost:3000/api/health)"
echo "AlertManager: $(curl -s http://localhost:9093/-/healthy)"
echo "E2EE App: $(curl -s http://localhost:8080/actuator/health | jq -r .status)"
echo "=== Disk Usage ==="
du -sh /var/lib/prometheus
echo "=== Active Alerts ==="
curl -s http://localhost:9093/api/v1/alerts | jq '.data[] | select(.status.state=="active")'
EOF

chmod +x /usr/local/bin/check-monitoring.sh
```

### 备份策略

```bash
# Prometheus数据备份
tar -czf prometheus-backup-$(date +%Y%m%d).tar.gz /var/lib/prometheus/

# Grafana仪表盘备份
curl -u admin:password http://localhost:3000/api/search > grafana-dashboards.json

# AlertManager配置备份
cp /etc/alertmanager/alertmanager.yml alertmanager-backup-$(date +%Y%m%d).yml
```

---

## 附录

### A. 完整部署脚本

```bash
#!/bin/bash
# 完整监控栈部署脚本
# 使用方法: sudo bash deploy-monitoring.sh

set -e

echo "开始部署HuLa E2EE监控栈..."

# 安装Prometheus
echo "安装Prometheus..."
# ... 省略具体步骤 ...

# 安装Grafana
echo "安装Grafana..."
# ... 省略具体步骤 ...

# 安装AlertManager
echo "安装AlertManager..."
# ... 省略具体步骤 ...

echo "监控栈部署完成!"
echo "Prometheus: http://your-server:9090"
echo "Grafana: http://your-server:3000 (admin/admin)"
echo "AlertManager: http://your-server:9093"
```

### B. 参考文档

- [Prometheus官方文档](https://prometheus.io/docs/)
- [Grafana官方文档](https://grafana.com/docs/)
- [AlertManager官方文档](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [E2EE运维手册](./E2EE_OPERATIONS_MANUAL.md)
- [E2EE API指南](./E2EE_API_GUIDE.md)

---

**文档版本**: v1.0.0
**最后更新**: 2025-01-01
**维护团队**: HuLa DevOps Team
