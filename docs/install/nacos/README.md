# Nacos 配置导入（本地文件，不提交 Git）

`deploy.sh` 会从 `docs/install/nacos/` 目录读取 `nacos_config_export_*.zip` 并导入配置到 Nacos。

由于导出文件通常包含数据库密码、第三方密钥、回调地址等敏感信息：
- `nacos_config_export_*.zip` 只应保存在部署机器上
- 不要提交到 Git/GitHub
- 若曾提交到公开仓库，需立刻轮换密钥并清理 Git 历史

## 生成导出文件（示例）

1. 进入 Nacos 控制台（默认 `http://localhost:8848/nacos`）
2. 选择 `配置管理` → `配置列表`
3. 选择 `导出`，导出 `DEFAULT_GROUP`
4. 将导出文件放到 `docs/install/nacos/`，文件名建议形如：
   - `nacos_config_export_YYYYMMDDHHMMSS.zip`

## 部署脚本的读取逻辑

- 脚本路径：`docs/install/docker/deploy.sh`
- 读取路径：`docs/install/nacos/nacos_config_export_*.zip`（取最新的一个）

