#!/bin/bash

# HuLa-Server 数据库管理脚本
# 用于数据库初始化、备份、恢复和用户管理
# 使用方法:
#   bash scripts/db-manager.sh init      # 初始化数据库和用户
#   bash scripts/db-manager.sh backup    # 备份数据库
#   bash scripts/db-manager.sh restore   # 恢复数据库
#   bash scripts/db-manager.sh user add  # 添加用户
#   bash scripts/db-manager.sh check     # 检查数据库状态

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

# 环境变量文件
ENV_FILE="$PROJECT_ROOT/.env"
DB_INIT_SQL="$SCRIPT_DIR/db-init.sql"

# 数据库连接信息
MYSQL_HOST="${MYSQL_HOST:-localhost}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_ROOT_USER="${MYSQL_ROOT_USER:-root}"

# 备份目录
BACKUP_DIR="$PROJECT_ROOT/backups/database"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 显示帮助信息
show_help() {
    echo "HuLa-Server 数据库管理脚本"
    echo ""
    echo "使用方法:"
    echo "  $0 <command> [options]"
    echo ""
    echo "命令:"
    echo "  init     初始化数据库和用户"
    echo "  backup   备份数据库"
    echo "  restore  恢复数据库"
    echo "  user     用户管理 (add/list/del)"
    echo "  check    检查数据库状态"
    echo "  audit    查看审计日志"
    echo "  perf     查看性能监控"
    echo ""
    echo "选项:"
    echo "  -h, --help           显示帮助信息"
    echo "  -u, --user <name>    数据库用户名 (默认: root)"
    echo "  -p, --password <pwd> 数据库密码"
    echo "  -H, --host <host>    数据库主机 (默认: localhost)"
    echo "  -P, --port <port>    数据库端口 (默认: 3306)"
    echo "  -d, --database <db>  数据库名称"
    echo "  -f, --file <file>    SQL文件路径"
    echo ""
}

# 记录日志
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case $level in
        INFO)
            echo -e "${GREEN}[INFO]${NC} $timestamp $message"
            ;;
        WARN)
            echo -e "${YELLOW}[WARN]${NC} $timestamp $message"
            ;;
        ERROR)
            echo -e "${RED}[ERROR]${NC} $timestamp $message"
            ;;
        DEBUG)
            if [ "$VERBOSE" -eq 1 ]; then
                echo -e "${BLUE}[DEBUG]${NC} $timestamp $message"
            fi
            ;;
    esac
}

# 执行SQL
execute_sql() {
    local sql="$1"
    local db_user="$2"
    local db_pass="$3"
    local db_name="$4"

    if [ -n "$db_name" ]; then
        mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$db_user" -p"$db_pass" "$db_name" -e "$sql"
    else
        mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$db_user" -p"$db_pass" -e "$sql"
    fi
}

# 检查数据库连接
check_connection() {
    local user="$1"
    local pass="$2"

    log INFO "检查数据库连接: $user@$MYSQL_HOST:$MYSQL_PORT"

    if execute_sql "SELECT 1" "$user" "$pass" >/dev/null 2>&1; then
        log INFO "数据库连接成功"
        return 0
    else
        log ERROR "数据库连接失败"
        return 1
    fi
}

# 初始化数据库
init_database() {
    log INFO "开始初始化数据库..."

    # 检查环境变量文件
    if [ ! -f "$ENV_FILE" ]; then
        log ERROR ".env 文件不存在，请先创建配置文件"
        exit 1
    fi

    # 读取root密码
    source "$ENV_FILE"
    local root_pass="${MYSQL_ROOT_PASSWORD}"

    if [ -z "$root_pass" ]; then
        read -s -p "请输入MySQL root密码: " root_pass
        echo
    fi

    # 检查连接
    if ! check_connection "root" "$root_pass"; then
        exit 1
    fi

    # 替换SQL中的环境变量
    local temp_sql="/tmp/db_init_${TIMESTAMP}.sql"
    envsubst < "$DB_INIT_SQL" > "$temp_sql"

    # 执行初始化SQL
    log INFO "执行数据库初始化脚本..."
    mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"root" -p"$root_pass" < "$temp_sql"

    # 清理临时文件
    rm -f "$temp_sql"

    log INFO "数据库初始化完成"
    echo ""
    log INFO "已创建的用户:"
    echo "  - luohuo_im (IM服务)"
    echo "  - luohuo_base (Base服务)"
    echo "  - luohuo_oauth (OAuth服务)"
    echo "  - luohuo_system (System服务)"
    echo "  - nacos (Nacos配置)"
    echo "  - luohuo_readonly (只读用户)"
    echo "  - luohuo_backup (备份用户)"
}

# 备份数据库
backup_database() {
    local db_name="$1"
    local backup_file="$2"

    log INFO "开始备份数据库: $db_name"

    # 创建备份目录
    mkdir -p "$BACKUP_DIR"

    # 生成备份文件名
    if [ -z "$backup_file" ]; then
        backup_file="$BACKUP_DIR/${db_name}_${TIMESTAMP}.sql"
    fi

    # 读取备份用户密码
    source "$ENV_FILE"
    local backup_user="luohuo_backup"
    local backup_pass="${BACKUP_PASSWORD}"

    # 执行备份
    mysqldump \
        -h"$MYSQL_HOST" \
        -P"$MYSQL_PORT" \
        -u"$backup_user" \
        -p"$backup_pass" \
        --single-transaction \
        --routines \
        --triggers \
        --events \
        --hex-blob \
        --default-character-set=utf8mb4 \
        "$db_name" > "$backup_file"

    # 压缩备份文件
    gzip "$backup_file"

    log INFO "备份完成: ${backup_file}.gz"
}

# 备份所有数据库
backup_all() {
    log INFO "开始备份所有数据库..."

    # 数据库列表
    local databases=("luohuo_im" "luohuo_base" "luohuo_oauth" "luohuo_system" "nacos")

    for db in "${databases[@]}"; do
        backup_database "$db"
    done

    # 备份全局信息
    local global_backup="$BACKUP_DIR/global_${TIMESTAMP}.sql"
    source "$ENV_FILE"

    mysqldump \
        -h"$MYSQL_HOST" \
        -P"$MYSQL_PORT" \
        -u"luohuo_backup" \
        -p"${BACKUP_PASSWORD}" \
        --all-databases \
        --users \
        --routines \
        --triggers \
        --events \
        --default-character-set=utf8mb4 > "$global_backup"

    gzip "$global_backup"
    log INFO "全局信息备份完成: ${global_backup}.gz"
}

# 恢复数据库
restore_database() {
    local db_name="$1"
    local backup_file="$2"

    log INFO "开始恢复数据库: $db_name"

    if [ ! -f "$backup_file" ]; then
        log ERROR "备份文件不存在: $backup_file"
        exit 1
    fi

    # 检查备份文件是否压缩
    if [[ $backup_file == *.gz ]]; then
        local temp_sql="/tmp/restore_${TIMESTAMP}.sql"
        gunzip -c "$backup_file" > "$temp_sql"
        backup_file="$temp_sql"
    fi

    # 读取root密码
    source "$ENV_FILE"
    local root_pass="${MYSQL_ROOT_PASSWORD}"

    # 执行恢复
    mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"root" -p"$root_pass" "$db_name" < "$backup_file"

    # 清理临时文件
    if [ -f "$temp_sql" ]; then
        rm -f "$temp_sql"
    fi

    log INFO "数据库恢复完成"
}

# 用户管理
manage_user() {
    local action="$1"
    local username="$2"
    local password="$3"

    case $action in
        add)
            log INFO "添加数据库用户: $username"
            # TODO: 实现添加用户逻辑
            ;;
        list)
            log INFO "列出所有数据库用户"
            # TODO: 实现列出用户逻辑
            ;;
        del)
            log INFO "删除数据库用户: $username"
            # TODO: 实现删除用户逻辑
            ;;
        *)
            log ERROR "未知的用户操作: $action"
            ;;
    esac
}

# 检查数据库状态
check_status() {
    log INFO "检查数据库状态..."

    # 读取环境变量
    source "$ENV_FILE"

    # 检查各服务用户连接
    local users=(
        "luohuo_im:${IM_PASSWORD}"
        "luohuo_base:${BASE_PASSWORD}"
        "luohuo_oauth:${OAUTH_PASSWORD}"
        "luohuo_system:${SYSTEM_PASSWORD}"
        "nacos:${NACOS_PASSWORD}"
    )

    echo ""
    printf "%-20s %-10s\n" "用户" "状态"
    echo "------------------------"

    for user_info in "${users[@]}"; do
        IFS=':' read -r username password <<< "$user_info"
        if check_connection "$username" "$password"; then
            printf "%-20s %-10s\n" "$username" "✓ 正常"
        else
            printf "%-20s %-10s\n" "$username" "✗ 异常"
        fi
    done

    echo ""
    log INFO "检查数据库性能..."
    # TODO: 添加性能检查
}

# 查看审计日志
view_audit_log() {
    log INFO "查看数据库审计日志..."

    source "$ENV_FILE"
    execute_sql \
        "SELECT * FROM luohuo_base.db_audit_log ORDER BY create_time DESC LIMIT 100" \
        "luohuo_readonly" \
        "${READONLY_PASSWORD}" \
        "luohuo_base"
}

# 主函数
main() {
    # 解析命令行参数
    COMMAND="${1:-help}"
    shift || true

    while [[ $# -gt 0 ]]; do
        case $1 in
            -u|--user)
                MYSQL_ROOT_USER="$2"
                shift 2
                ;;
            -p|--password)
                MYSQL_ROOT_PASSWORD="$2"
                shift 2
                ;;
            -H|--host)
                MYSQL_HOST="$2"
                shift 2
                ;;
            -P|--port)
                MYSQL_PORT="$2"
                shift 2
                ;;
            -d|--database)
                DATABASE_NAME="$2"
                shift 2
                ;;
            -f|--file)
                SQL_FILE="$2"
                shift 2
                ;;
            -v|--verbose)
                VERBOSE=1
                shift
                ;;
            *)
                break
                ;;
        esac
    done

    # 切换到项目目录
    cd "$PROJECT_ROOT"

    # 执行命令
    case $COMMAND in
        init)
            init_database
            ;;
        backup)
            if [ -n "$DATABASE_NAME" ]; then
                backup_database "$DATABASE_NAME"
            else
                backup_all
            fi
            ;;
        restore)
            if [ -z "$DATABASE_NAME" ] || [ -z "$SQL_FILE" ]; then
                log ERROR "恢复数据库需要指定 -d 数据库名 和 -f 备份文件"
                exit 1
            fi
            restore_database "$DATABASE_NAME" "$SQL_FILE"
            ;;
        user)
            manage_user "${1:-list}" "$2" "$3"
            ;;
        check)
            check_status
            ;;
        audit)
            view_audit_log
            ;;
        perf)
            # TODO: 实现性能监控
            log INFO "性能监控功能开发中..."
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log ERROR "未知命令: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"