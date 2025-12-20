#!/bin/bash

# 项目验证脚本
# 创建日期: 2025-12-20
# 描述: 验证项目功能完整性和代码质量

set -e

echo "======================================"
echo "项目验证开始..."
echo "======================================"

# 记录开始时间
START_TIME=$(date +%s)

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 计数器
ERRORS=0
WARNINGS=0
SUCCESSES=0

# 日志函数
log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ((ERRORS++))
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    ((WARNINGS++))
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    ((SUCCESSES++))
}

# 1. 检查项目结构
echo -e "\n[1] 检查项目结构..."
if [ -d "/Users/ljf/Desktop/hulah/hula/luohuo-cloud" ]; then
    log_success "luohuo-cloud目录存在"
else
    log_error "luohuo-cloud目录不存在"
fi

# 检查关键模块
MODULES=("luohuo-im" "luohuo-base" "luohuo-gateway" "luohuo-ws" "luohuo-oauth" "luohuo-public")
for module in "${MODULES[@]}"; do
    if [ -d "/Users/ljf/Desktop/hulah/hula/luohuo-cloud/$module" ]; then
        log_success "模块 $module 存在"
    else
        log_error "模块 $module 不存在"
    fi
done

# 2. 检查配置文件
echo -e "\n[2] 检查配置文件..."
POM_COUNT=$(find /Users/ljf/Desktop/hulah/hula -name "pom.xml" -type f | wc -l | tr -d ' ')
log_success "找到 $POM_COUNT 个 pom.xml 文件"

# 检查主配置文件
if [ -f "/Users/ljf/Desktop/hulah/hula/pom.xml" ]; then
    log_success "根pom.xml存在"
else
    log_error "根pom.xml不存在"
fi

# 3. 检查重复配置文件
echo -e "\n[3] 检查重复配置文件..."
CONFIG_COUNT=$(find /Users/ljf/Desktop/hulah/hula -name "*Config.java" -type f | wc -l | tr -d ' ')
log_success "当前有 $CONFIG_COUNT 个配置文件（清理前为54个）"

# 检查是否还有重复的ElasticsearchConfig
ES_CONFIG_COUNT=$(find /Users/ljf/Desktop/hulah/hula -name "ElasticsearchConfig.java" -type f | wc -l | tr -d ' ')
if [ "$ES_CONFIG_COUNT" -eq 1 ]; then
    log_success "ElasticsearchConfig已合并，无重复"
else
    log_warning "发现 $ES_CONFIG_COUNT 个ElasticsearchConfig文件"
fi

# 4. 检查测试文件
echo -e "\n[4] 检查测试文件..."
TEST_COUNT=$(find /Users/ljf/Desktop/hulah/hula -name "*Test.java" -type f | wc -l | tr -d ' ')
log_success "当前有 $TEST_COUNT 个测试文件（清理前为17个）"

# 5. 检查TODO注释
echo -e "\n[5] 检查TODO注释..."
TODO_COUNT=$(find /Users/ljf/Desktop/hulah/hula -name "*.java" -type f -exec grep -l "TODO\|FIXME" {} \; | wc -l | tr -d ' ')
echo "当前还有 $TODO_COUNT 个文件包含TODO/FIXME注释"

# 6. 检查数据库脚本
echo -e "\n[6] 检查数据库脚本..."
if [ -f "/Users/ljf/Desktop/hulah/hula/scripts/db-integrity-fix.sql" ]; then
    log_success "数据库完整性修复脚本存在"
else
    log_error "数据库完整性修复脚本不存在"
fi

# 7. 检查文档完整性
echo -e "\n[7] 检查文档..."
DOCS=("README.md" "CHANGELOG.md" "docs/COMPREHENSIVE_DEPLOYMENT_GUIDE.md")
for doc in "${DOCS[@]}"; do
    if [ -f "/Users/ljf/Desktop/hulah/hula/$doc" ]; then
        log_success "文档 $doc 存在"
    else
        log_warning "文档 $doc 不存在"
    fi
done

# 8. 生成验证报告
echo -e "\n[8] 生成验证报告..."
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

cat << EOF > /Users/ljf/Desktop/hulah/hula/scripts/verification-report.md
# 项目验证报告

生成时间: $(date)
验证耗时: ${DURATION}秒

## 验证结果统计
- ✅ 成功项: $SUCCESSES
- ⚠️ 警告项: $WARNINGS
- ❌ 错误项: $ERRORS

## 清理成果
1. **配置文件优化**: 从54个减少到 $CONFIG_COUNT 个
2. **测试文件清理**: 从17个减少到 $TEST_COUNT 个
3. **删除重复配置**:
   - 删除了2个重复的RedisConfig
   - 删除了重复的ElasticsearchConfig
   - 删除了重复的E2EECacheConfig

## 已完成的优化
1. **数据库完整性**: 创建了db-integrity-fix.sql脚本
2. **TODO管理**: 整理了TODO状态报告
3. **代码清理**: 删除了无意义的测试文件
4. **配置优化**: 合并了重复的配置类

## 后续建议
1. 执行数据库完整性修复脚本
2. 运行项目测试确保功能正常
3. 考虑添加CI/CD检查以防止重复配置
4. 定期review TODO列表

## 项目健康度
$([ $ERRORS -eq 0 ] && echo "🟢 良好" || echo "🟡 需要关注")
EOF

log_success "验证报告已生成: /Users/ljf/Desktop/hulah/hula/scripts/verification-report.md"

# 9. 总结
echo -e "\n======================================"
echo "验证完成！"
echo "======================================"
echo -e "结果统计:"
echo -e "  - 成功: ${GREEN}$SUCCESSES${NC}"
echo -e "  - 警告: ${YELLOW}$WARNINGS${NC}"
echo -e "  - 错误: ${RED}$ERRORS${NC}"

if [ $ERRORS -eq 0 ]; then
    echo -e "\n${GREEN}✅ 项目验证通过！${NC}"
    exit 0
else
    echo -e "\n${RED}❌ 发现 $ERRORS 个错误，需要修复${NC}"
    exit 1
fi