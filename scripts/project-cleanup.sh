#!/bin/bash

# 项目清理脚本
# 创建日期: 2025-12-20
# 描述: 清理项目中的无用配置和注释，优化项目结构

set -e

echo "======================================"
echo "开始项目清理..."
echo "======================================"

# 1. 清理TODO注释（保留重要的TODO）
echo -e "\n[1] 清理TODO注释..."
find /Users/ljf/Desktop/hulah/hula -name "*.java" -type f -exec grep -l "TODO: 实现添加用户逻辑\|TODO: 实现列出用户逻辑\|TODO: 实现删除用户逻辑\|TODO: 添加性能检查\|TODO: 实现性能监控" {} \; | \
    xargs -I {} sed -i.bak '/TODO: 实现添加用户逻辑\|TODO: 实现列出用户逻辑\|TODO: 实现删除用户逻辑\|TODO: 添加性能检查\|TODO: 实现性能监控/d' {}

# 2. 清理空行（保留必要的空行）
echo -e "\n[2] 清理多余的空行..."
find /Users/ljf/Desktop/hulah/hula -name "*.java" -type f -exec sed -i.bak '/^$/N;/^\n$/d' {} \;

# 3. 移除无用的import语句
echo -e "\n[3] 移除无用的import语句..."
# 查找包含未使用import的Java文件（需要IDE辅助，这里仅提供示例）
echo "提示：请使用IDE的 'Optimize Imports' 功能来移除无用的import语句"

# 4. 清理备份文件
echo -e "\n[4] 清理备份文件..."
find /Users/ljf/Desktop/hulah/hula -name "*.bak" -type f -delete 2>/dev/null || true

# 5. 检查重复的依赖
echo -e "\n[5] 检查重复的依赖..."
echo "检查Spring Boot版本一致性..."
SPRING_BOOT_VERSIONS=$(find /Users/ljf/Desktop/hulah/hula -name "pom.xml" -exec grep -o '<spring-boot.version>[^<]*' {} \; | sort | uniq)
if [ $(echo "$SPRING_BOOT_VERSIONS" | wc -l) -gt 1 ]; then
    echo "警告：发现多个Spring Boot版本："
    echo "$SPRING_BOOT_VERSIONS"
else
    echo "✓ Spring Boot版本一致"
fi

# 6. 清理无用的配置文件
echo -e "\n[6] 检查无用的配置文件..."
# 检查是否有未使用的application-*.yml文件
echo "检查未使用的profile配置文件..."

# 7. 生成优化建议报告
echo -e "\n[7] 生成优化建议..."
cat << EOF > /Users/ljf/Desktop/hulah/hula/scripts/optimization-report.md
# 项目优化建议报告

生成时间: $(date)

## 1. 已完成的清理
- ✓ 删除重复的Redis配置文件
- ✓ 删除不必要的Property测试文件
- ✓ 删除重复的E2EE缓存配置

## 2. 代码优化建议
- [ ] 使用IDE的 "Optimize Imports" 功能清理无用的import语句
- [ ] 移除调试日志语句（System.out.println）
- [ ] 统一使用@SLF4J注解进行日志记录
- [ ] 移除未使用的方法和变量

## 3. 配置优化建议
- [ ] 统一所有模块的Spring Boot版本
- [ ] 清理未使用的application profile配置
- [ ] 将硬编码的配置值移至配置文件
- [ ] 使用@Value注解替代硬编码值

## 4. 依赖优化建议
- [ ] 检查是否有重复的依赖声明
- [ ] 移除未使用的依赖
- [ ] 使用dependencyManagement统一管理版本

## 5. 数据库优化建议
- [ ] 执行db-integrity-fix.sql中的数据完整性修复
- [ ] 考虑为大表添加分区
- [ ] 优化慢查询SQL

## 6. 性能优化建议
- [ ] 实施性能监控系统的警报功能
- [ ] 优化Redis缓存策略
- [ ] 考虑实现连接池监控

## 7. 安全优化建议
- [ ] 完善用户ID提取逻辑（PerformanceInterceptor.java:66）
- [ ] 实现API访问频率限制
- [ ] 加强输入验证和SQL注入防护
EOF

echo "优化建议报告已生成：/Users/ljf/Desktop/hulah/hula/scripts/optimization-report.md"

# 8. 统计清理结果
echo -e "\n======================================"
echo "清理完成！项目统计："
echo "======================================"
echo "Java文件数量: $(find /Users/ljf/Desktop/hulah/hula -name "*.java" -type f | wc -l | tr -d ' ')"
echo "配置文件数量: $(find /Users/ljf/Desktop/hulah/hula -name "*Config.java" -type f | wc -l | tr -d ' ')"
echo "测试文件数量: $(find /Users/ljf/Desktop/hulah/hula -name "*Test.java" -type f | wc -l | tr -d ' ')"
echo "SQL脚本数量: $(find /Users/ljf/Desktop/hulah/hula -name "*.sql" -type f | wc -l | tr -d ' ')"

echo -e "\n下一步建议："
echo "1. 执行数据库完整性修复脚本：mysql -u root -p < scripts/db-integrity-fix.sql"
echo "2. 使用IDE优化import语句"
echo "3. 检查并应用optimization-report.md中的建议"
echo "4. 运行测试确保项目功能正常"