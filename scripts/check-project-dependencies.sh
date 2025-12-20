#!/bin/bash

# 项目依赖检查脚本
# 检查Hula-IM项目运行所需的所有外部依赖

set -e

echo "======================================"
echo "Hula-IM 项目依赖检查工具"
echo "======================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 计数器
PASS=0
FAIL=0
WARN=0

# 日志函数
log_pass() {
    echo -e "${GREEN}[✓ PASS]${NC} $1"
    ((PASS++))
}

log_fail() {
    echo -e "${RED}[✗ FAIL]${NC} $1"
    ((FAIL++))
}

log_warn() {
    echo -e "${YELLOW}[⚠ WARN]${NC} $1"
    ((WARN++))
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# 检查函数
check_command() {
    local cmd=$1
    local name=$2
    local required=${3:-true}

    if command -v $cmd &> /dev/null; then
        log_pass "$name 已安装"
        return 0
    else
        if [ "$required" = "true" ]; then
            log_fail "$name 未安装 - 这是必需的"
        else
            log_warn "$name 未安装 - 这是可选的"
        fi
        return 1
    fi
}

check_port() {
    local port=$1
    local service=$2

    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_pass "$service 端口 $port 正在监听"
    else
        log_warn "$service 端口 $port 未监听"
    fi
}

check_url() {
    local url=$1
    local service=$2
    local timeout=${3:-5}

    if curl -s --connect-timeout $timeout $url > /dev/null; then
        log_pass "$service ($url) 可访问"
    else
        log_fail "$service ($url) 不可访问"
    fi
}

echo -e "\n${BLUE}1. 基础环境检查${NC}"
echo "-------------------"

# 检查操作系统
OS=$(uname -s)
case $OS in
    Linux*)
        log_pass "操作系统: Linux"
        ;;
    Darwin*)
        log_pass "操作系统: macOS"
        ;;
    CYGWIN*|MINGW*)
        log_pass "操作系统: Windows"
        ;;
    *)
        log_warn "未知操作系统: $OS"
        ;;
esac

# 检查Java
check_command java "Java" true
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)
    if [ "$JAVA_VERSION" -ge "21" ]; then
        log_pass "Java版本: $JAVA_VERSION (满足要求 >=21)"
    else
        log_fail "Java版本过低: $JAVA_VERSION (需要 >=21)"
    fi
fi

# 检查Maven
check_command mvn "Maven" true
if command -v mvn &> /dev/null; then
    MVN_VERSION=$(mvn -version | head -n 1 | cut -d' ' -f3)
    log_info "Maven版本: $MVN_VERSION"
fi

# 检查Git
check_command git "Git" true

# 检查Docker
check_command docker "Docker" false
if command -v docker &> /dev/null; then
    docker --version
fi

# 检查Docker Compose
check_command docker-compose "Docker Compose" false
if command -v docker-compose &> /dev/null; then
    docker-compose --version
fi

# 检查OpenSSL（PII加密需要）
check_command openssl "OpenSSL" true

echo -e "\n${BLUE}2. 外部服务依赖检查${NC}"
echo "-----------------------"

# 检查MySQL
check_port 3306 "MySQL"

# 检查Redis
check_port 6379 "Redis"

# 检查Elasticsearch
check_port 9200 "Elasticsearch"

# 检查Nacos
check_port 8848 "Nacos"
if check_url "http://localhost:8848/nacos" "Nacos控制台" 3; then
    log_info "Nacos控制台: http://localhost:8848/nacos (nacos/nacos)"
fi

# 检查RabbitMQ
check_port 5672 "RabbitMQ"
check_port 15672 "RabbitMQ管理界面"

# 检查Kafka
check_port 9092 "Kafka"

# 检查XXL-JOB
check_port 8080 "XXL-JOB"

# 检查Zipkin
check_port 9411 "Zipkin"

# 检查Prometheus
check_port 9090 "Prometheus"

# 检查Grafana
check_port 3000 "Grafana"

echo -e "\n${BLUE}3. 项目配置文件检查${NC}"
echo "-------------------"

# 检查环境变量文件
if [ -f ".env" ]; then
    log_pass ".env 文件存在"

    # 检查关键配置
    if grep -q "PII_ENCRYPTION_KEY=" .env; then
        log_pass "PII加密密钥已配置"
    else
        log_fail "PII加密密钥未配置"
    fi

    if grep -q "MYSQL_PASSWORD=" .env; then
        log_pass "MySQL密码已配置"
    else
        log_warn "MySQL密码未配置"
    fi
else
    log_fail ".env 文件不存在"
    log_info "请复制 .env.example 到 .env 并配置相应参数"
fi

# 检查数据库初始化脚本
if [ -f "scripts/db-init.sql" ]; then
    log_pass "数据库初始化脚本存在"
else
    log_fail "数据库初始化脚本不存在"
fi

# 检查PII加密配置
if [ -f "common-pii-encryption.yml" ]; then
    log_pass "PII加密配置文件存在"
else
    log_fail "PII加密配置文件不存在"
    log_info "运行 ./scripts/generate-pii-key.sh 生成"
fi

echo -e "\n${BLUE}4. 邮件服务配置检查${NC}"
echo "-------------------"

# 检查邮件配置脚本
if [ -f "scripts/add-qq-email-config.sql" ]; then
    log_pass "邮件配置SQL脚本存在"
else
    log_warn "邮件配置SQL脚本不存在"
fi

# 检查邮件服务类
if [ -f "luohuo-cloud/luohuo-im/luohuo-im-biz/src/main/java/com/luohuo/flex/im/service/mail/MailService.java" ]; then
    log_pass "邮件服务类存在"
else
    log_fail "邮件服务类不存在"
fi

echo -e "\n${BLUE}5. 项目编译检查${NC}"
echo "-------------------"

# 检查pom.xml
if [ -f "luohuo-cloud/pom.xml" ]; then
    log_pass "根pom.xml存在"

    # 检查是否能编译
    log_info "检查项目编译..."
    if mvn -q clean compile -pl luohuo-cloud -DskipTests > /dev/null 2>&1; then
        log_pass "项目编译成功"
    else
        log_fail "项目编译失败"
        log_info "运行: mvn clean compile -pl luohuo-cloud"
    fi
else
    log_fail "根pom.xml不存在"
fi

echo -e "\n${BLUE}6. 安全配置检查${NC}"
echo "-------------------"

# 检查日志目录权限
if [ -d "logs" ]; then
    log_pass "日志目录存在"
else
    log_warn "日志目录不存在，运行时可能报错"
fi

# 检查临时目录
if [ -d "/tmp" ]; then
    log_pass "临时目录存在"
else
    log_fail "临时目录不存在"
fi

# 检查文件描述符限制
if [ "$(ulimit -n)" -ge "65536" ]; then
    log_pass "文件描述符限制: $(ulimit -n)"
else
    log_warn "文件描述符限制过低: $(ulimit -n) (建议 >= 65536)"
fi

echo -e "\n${BLUE}7. 性能优化建议${NC}"
echo "-------------------"

# 检查系统资源
if command -v free &> /dev/null; then
    MEM=$(free -h | awk 'NR==2{printf "%.0f", $7*100/$2}')
    if [ "$MEM" -gt "20" ]; then
        log_pass "可用内存: ${MEM}%"
    else
        log_warn "可用内存不足: ${MEM}%"
    fi
fi

if command -v nproc &> /dev/null; then
    CORES=$(nproc)
    log_info "CPU核心数: $CORES"

    if [ "$CORES" -lt "4" ]; then
        log_warn "CPU核心数较少，可能影响性能"
    fi
fi

# 检查磁盘空间
if command -v df &> /dev/null; then
    DISK=$(df -h . | awk 'NR==2{print $5}' | sed 's/%//')
    if [ "$DISK" -lt "80" ]; then
        log_pass "磁盘空间: 使用${DISK}%"
    else
        log_warn "磁盘空间不足: 使用${DISK}%"
    fi
fi

echo -e "\n${BLUE}8. 快速启动建议${NC}"
echo "-------------------"

log_info "1. 启动所有依赖服务:"
echo "   docker-compose up -d"

log_info "2. 执行数据库初始化:"
echo "   mysql -u root -p < scripts/db-init.sql"
echo "   mysql -u root -p < scripts/add-qq-email-config.sql"

log_info "3. 配置PII加密:"
echo "   export PII_ENCRYPTION_KEY=your_key_here"
echo "   或在Nacos中配置 common-pii-encryption.yml"

log_info "4. 启动应用:"
echo "   cd luohuo-cloud"
echo "   mvn spring-boot:run -pl luohuo-im/luohuo-im-server"

# 输出检查结果
echo -e "\n======================================"
echo -e "检查完成！"
echo -e "======================================"
echo -e "统计结果:"
echo -e "  - 通过: ${GREEN}$PASS${NC}"
echo -e "  - 警告: ${YELLOW}$WARN${NC}"
echo -e "  - 失败: ${RED}$FAIL${NC}"

if [ $FAIL -eq 0 ]; then
    echo -e "\n${GREEN}✅ 所有必需依赖都已满足，可以正常启动项目！${NC}"
    exit 0
else
    echo -e "\n${RED}❌ 发现 $FAIL 个必需依赖未满足，请修复后再启动项目${NC}"
    exit 1
fi