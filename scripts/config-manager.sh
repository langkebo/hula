#!/bin/bash

# HuLa-Server 配置管理脚本
# 用于管理不同环境的配置文件
# 使用方法:
#   bash scripts/config-manager.sh init    # 初始化配置
#   bash scripts/config-manager.sh dev     # 生成开发环境配置
#   bash scripts/config-manager.sh prod   # 生成生产环境配置
#   bash scripts/config-manager.sh docker  # 生成Docker环境配置

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 获取脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 环境变量文件路径
ENV_FILE="$PROJECT_ROOT/.env"
ENV_TEMPLATE="$PROJECT_ROOT/.env.template"

# 配置文件路径
CONFIG_DIR="$PROJECT_ROOT/luohuo-cloud/luohuo-support/luohuo-boot-server/src/main/resources/config"
TEMPLATE_CONFIG="$CONFIG_DIR/mysql-template.yml"
DEV_CONFIG="$CONFIG_DIR/dev/mysql.yml"
PROD_CONFIG="$CONFIG_DIR/prod/mysql.yml"

# 显示帮助信息
show_help() {
    echo "HuLa-Server 配置管理脚本"
    echo ""
    echo "使用方法:"
    echo "  $0 init      初始化配置环境"
    echo "  $0 dev       生成开发环境配置"
    echo "  $0 prod      生成生产环境配置"
    echo "  $0 docker    生成Docker环境配置"
    echo "  $0 check     检查配置文件"
    echo "  $0 clean     清理生成的配置文件"
    echo ""
    echo "示例:"
    echo "  $0 init && $0 dev"
    echo ""
}

# 初始化配置
init_config() {
    echo -e "${GREEN}初始化配置环境...${NC}"

    # 检查.env.template是否存在
    if [ ! -f "$ENV_TEMPLATE" ]; then
        echo -e "${RED}错误: 找不到.env.template文件${NC}"
        exit 1
    fi

    # 如果.env不存在，从模板复制
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${YELLOW}创建.env文件从模板...${NC}"
        cp "$ENV_TEMPLATE" "$ENV_FILE"
        echo -e "${YELLOW}请编辑.env文件配置您的环境变量${NC}"
    else
        echo -e "${GREEN}.env文件已存在${NC}"
    fi

    # 创建配置备份目录
    mkdir -p "$CONFIG_DIR/backup"

    echo -e "${GREEN}初始化完成${NC}"
}

# 生成环境配置文件
generate_config() {
    local env_type="$1"
    local target_config="$2"
    local source_config="${3:-$TEMPLATE_CONFIG}"

    echo -e "${GREEN}生成${env_type}环境配置...${NC}"

    # 备份原配置
    if [ -f "$target_config" ]; then
        local backup_file="$CONFIG_DIR/backup/mysql-$(date +%Y%m%d%H%M%S).yml"
        cp "$target_config" "$backup_file"
        echo -e "${YELLOW}备份原配置到: $backup_file${NC}"
    fi

    # 生成新配置
    if command -v envsubst >/dev/null 2>&1; then
        # 使用envsubst替换环境变量
        envsubst < "$source_config" > "$target_config"
    else
        # 如果没有envsubst，直接复制模板
        cp "$source_config" "$target_config"
        echo -e "${YELLOW}警告: 未找到envsubst命令，请手动替换配置中的环境变量${NC}"
    fi

    echo -e "${GREEN}配置文件已生成: $target_config${NC}"
}

# 生成开发环境配置
generate_dev_config() {
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED}错误: 请先运行 $0 init${NC}"
        exit 1
    fi

    # 加载环境变量
    source "$ENV_FILE"

    # 设置开发环境默认值
    export MYSQL_HOST=${MYSQL_HOST:-192.168.1.37}
    export MYSQL_PORT=${MYSQL_PORT:-13306}
    export MYSQL_DATABASE=${MYSQL_DATABASE:-luohuo_dev}
    export REDIS_HOST=${REDIS_HOST:-192.168.1.37}
    export REDIS_PORT=${REDIS_PORT:-16379}
    export MYSQL_SSL_ENABLED=${MYSQL_SSL_ENABLED:-true}
    export MYSQL_SSL_REQUIRE=${MYSQL_SSL_REQUIRE:-false}
    export MYSQL_SSL_VERIFY=${MYSQL_SSL_VERIFY:-false}
    export SQL_LOG_ENABLED=${SQL_LOG_ENABLED:-true}

    generate_config "开发" "$DEV_CONFIG"
}

# 生成生产环境配置
generate_prod_config() {
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED}错误: 请先运行 $0 init${NC}"
        exit 1
    fi

    # 加载环境变量
    source "$ENV_FILE"

    # 设置生产环境默认值
    export MYSQL_HOST=${MYSQL_HOST:-127.0.0.1}
    export MYSQL_PORT=${MYSQL_PORT:-3218}
    export MYSQL_DATABASE=${MYSQL_DATABASE:-luohuo_none}
    export MYSQL_SSL_ENABLED=${MYSQL_SSL_ENABLED:-true}
    export MYSQL_SSL_REQUIRE=${MYSQL_SSL_REQUIRE:-true}
    export MYSQL_SSL_VERIFY=${MYSQL_SSL_VERIFY:-true}
    export SQL_LOG_ENABLED=${SQL_LOG_ENABLED:-false}
    export LOG_LEVEL=${LOG_LEVEL:-WARN}

    generate_config "生产" "$PROD_CONFIG"
}

# 生成Docker环境配置
generate_docker_config() {
    echo -e "${GREEN}生成Docker环境配置...${NC}"

    # Docker环境使用环境变量，不需要生成静态配置文件
    echo -e "${YELLOW}Docker环境将使用环境变量配置，请确保.env文件正确配置${NC}"

    # 创建docker配置目录
    mkdir -p "$PROJECT_ROOT/config/docker"

    # 生成docker专用的application.yml
    cat > "$PROJECT_ROOT/config/docker/application.yml" << EOF
# Docker环境配置
# 使用环境变量，无需硬编码
spring:
  profiles:
    active: docker
  config:
    import: optional:configserver:${CONFIG_SERVER_URL:}

logging:
  level:
    root: \${LOG_LEVEL:INFO}
    com.luohuo: \${LOG_LEVEL:INFO}
  path: \${LOG_PATH:./logs}

# 管理端点配置
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  endpoint:
    health:
      show-details: when-authorized
EOF

    echo -e "${GREEN}Docker配置已生成${NC}"
}

# 检查配置文件
check_config() {
    echo -e "${GREEN}检查配置文件...${NC}"

    # 检查必要的环境变量
    local required_vars=("MYSQL_HOST" "MYSQL_PORT" "MYSQL_DATABASE" "MYSQL_USERNAME" "MYSQL_PASSWORD")
    local missing_vars=()

    if [ -f "$ENV_FILE" ]; then
        source "$ENV_FILE"

        for var in "${required_vars[@]}"; do
            if [ -z "${!var}" ]; then
                missing_vars+=("$var")
            fi
        done

        if [ ${#missing_vars[@]} -gt 0 ]; then
            echo -e "${RED}错误: 以下环境变量未设置:${NC}"
            printf '%s\n' "${missing_vars[@]}"
            echo -e "${YELLOW}请编辑.env文件设置这些变量${NC}"
            exit 1
        fi

        echo -e "${GREEN}环境变量检查通过${NC}"
    else
        echo -e "${RED}错误: .env文件不存在${NC}"
        echo -e "${YELLOW}请先运行 $0 init${NC}"
        exit 1
    fi

    # 检查配置文件是否存在
    local configs=("$DEV_CONFIG" "$PROD_CONFIG")
    for config in "${configs[@]}"; do
        if [ -f "$config" ]; then
            echo -e "${GREEN}✓ 配置文件存在: $config${NC}"
        else
            echo -e "${YELLOW}✗ 配置文件不存在: $config${NC}"
        fi
    done
}

# 清理生成的配置文件
clean_config() {
    echo -e "${GREEN}清理生成的配置文件...${NC}"

    # 清理备份目录
    if [ -d "$CONFIG_DIR/backup" ]; then
        echo -e "${YELLOW}清理备份文件...${NC}"
        rm -rf "$CONFIG_DIR/backup"
    fi

    # 清理docker配置
    if [ -d "$PROJECT_ROOT/config/docker" ]; then
        echo -e "${YELLOW}清理Docker配置...${NC}"
        rm -rf "$PROJECT_ROOT/config/docker"
    fi

    echo -e "${GREEN}清理完成${NC}"
}

# 主函数
main() {
    case "${1:-help}" in
        init)
            init_config
            ;;
        dev)
            generate_dev_config
            ;;
        prod)
            generate_prod_config
            ;;
        docker)
            generate_docker_config
            ;;
        check)
            check_config
            ;;
        clean)
            clean_config
            ;;
        all)
            init_config
            generate_dev_config
            generate_prod_config
            generate_docker_config
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}错误: 未知命令 '$1'${NC}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"