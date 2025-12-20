#!/bin/bash

# HuLa-Server 数据库部署脚本
# 集成MySQL安装、配置、初始化和优化
# 使用方法: bash scripts/deploy-database.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置变量
MYSQL_VERSION="8.0"
MYSQL_DATA_DIR="/var/lib/mysql"
MYSQL_LOG_DIR="/var/log/mysql"
MYSQL_CONFIG_DIR="/etc/mysql"
MYSQL_SOCK="/var/run/mysqld/mysqld.sock"

# 获取脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 日志函数
log() {
    local level="$1"
    shift
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    case $level in
        INFO)  echo -e "${GREEN}[INFO]${NC}  $timestamp $*" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC}  $timestamp $*" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} $timestamp $*" ;;
        DEBUG) echo -e "${BLUE}[DEBUG]${NC} $timestamp $*" ;;
    esac
}

# 检查操作系统
check_os() {
    log INFO "检查操作系统..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command -v apt-get >/dev/null; then
            OS="ubuntu"
            PKG_MANAGER="apt-get"
        elif command -v yum >/dev/null; then
            OS="centos"
            PKG_MANAGER="yum"
        else
            log ERROR "不支持的Linux发行版"
            exit 1
        fi
    else
        log ERROR "仅支持Linux系统"
        exit 1
    fi
    log INFO "检测到系统: $OS"
}

# 安装MySQL
install_mysql() {
    log INFO "安装MySQL $MYSQL_VERSION..."

    case $OS in
        ubuntu)
            # 更新包列表
            $PKG_MANAGER update -y

            # 安装必要的包
            $PKG_MANAGER install -y wget gnupg2 lsb-release ca-certificates

            # 添加MySQL APT仓库
            wget -O /tmp/mysql-apt-config.deb https://dev.mysql.com/get/mysql-apt-config_0.8.24-1_all.deb
            echo "mysql-apt-config mysql-apt-config/select-server select mysql-8.0" | debconf-set-selections
            DEBIAN_FRONTEND=noninteractive dpkg -i /tmp/mysql-apt-config.deb

            # 更新APT
            $PKG_MANAGER update

            # 安装MySQL服务器
            DEBIAN_FRONTEND=noninteractive $PKG_MANAGER install -y mysql-server mysql-client

            # 清理
            rm -f /tmp/mysql-apt-config.deb
            ;;
        centos)
            # 安装MySQL yum仓库
            yum install -y https://dev.mysql.com/get/mysql80-community-release-el7-3.noarch.rpm

            # 安装MySQL服务器
            yum install -y mysql-community-server mysql-community-client
            ;;
    esac

    # 启动并设置开机自启
    systemctl start mysqld
    systemctl enable mysqld

    log INFO "MySQL安装完成"
}

# 配置MySQL
configure_mysql() {
    log INFO "配置MySQL..."

    # 创建配置目录
    mkdir -p /etc/mysql/mysql.conf.d

    # 生成MySQL配置文件
    cat > /etc/mysql/mysql.conf.d/hula.cnf << EOF
# HuLa-Server MySQL配置优化
[mysqld]
# 基本设置
default-storage-engine = InnoDB
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
init_connect = 'SET NAMES utf8mb4'

# 网络设置
bind-address = 0.0.0.0
port = 3306
max_connections = 1000
max_connect_errors = 10000
wait_timeout = 28800
interactive_timeout = 28800

# 缓冲区设置
key_buffer_size = 32M
max_allowed_packet = 64M
table_open_cache = 256
sort_buffer_size = 1M
read_buffer_size = 1M
read_rnd_buffer_size = 4M
myisam_sort_buffer_size = 64M
thread_cache_size = 8
query_cache_size = 16M
query_cache_limit = 2M

# InnoDB设置
innodb_buffer_pool_size = 512M
innodb_log_file_size = 128M
innodb_log_buffer_size = 8M
innodb_flush_log_at_trx_commit = 1
innodb_lock_wait_timeout = 50
innodb_file_per_table = 1

# 日志设置
log-error = $MYSQL_LOG_DIR/error.log
slow_query_log = 1
slow_query_log_file = $MYSQL_LOG_DIR/slow.log
long_query_time = 2

# 二进制日志
log-bin = mysql-bin
binlog_format = ROW
expire_logs_days = 7
max_binlog_size = 100M

# 性能模式
performance_schema = ON

# 安全设置
local-infile = 0
skip-name-resolve

# 客户端设置
[client]
default-character-set = utf8mb4

[mysql]
default-character-set = utf8mb4
EOF

    # 重启MySQL
    systemctl restart mysqld

    log INFO "MySQL配置完成"
}

# 获取临时root密码
get_temp_password() {
    log INFO "获取MySQL临时密码..."

    if [ -f /var/log/mysqld.log ]; then
        TEMP_PASSWORD=$(grep 'temporary password' /var/log/mysqld.log | awk '{print $NF}' | tail -1)
        if [ -n "$TEMP_PASSWORD" ]; then
            log INFO "临时密码: $TEMP_PASSWORD"
        fi
    fi
}

# 设置root密码
set_root_password() {
    log INFO "设置root密码..."

    # 从环境变量读取密码
    if [ -f "$PROJECT_ROOT/.env" ]; then
        source "$PROJECT_ROOT/.env"
        MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-Root@2025#Secure}"
    else
        MYSQL_ROOT_PASSWORD="Root@2025#Secure"
        log WARN "未找到.env文件，使用默认密码"
    fi

    # 如果有临时密码，先修改密码
    if [ -n "$TEMP_PASSWORD" ]; then
        mysql -uroot -p"$TEMP_PASSWORD" --connect-expired-password -e \
            "ALTER USER 'root'@'localhost' IDENTIFIED BY '$MYSQL_ROOT_PASSWORD';"
    else
        mysql -uroot -e \
            "ALTER USER 'root'@'localhost' IDENTIFIED BY '$MYSQL_ROOT_PASSWORD';"
    fi

    # 创建my.cnf文件保存密码
    cat > ~/.my.cnf << EOF
[client]
user=root
password=$MYSQL_ROOT_PASSWORD
EOF
    chmod 600 ~/.my.cnf

    log INFO "root密码设置完成"
}

# 优化系统参数
optimize_system() {
    log INFO "优化系统参数..."

    # 增加文件描述符限制
    cat >> /etc/security/limits.conf << EOF
# MySQL limits
mysql soft nofile 65535
mysql hard nofile 65535
EOF

    # 优化内核参数
    cat >> /etc/sysctl.conf << EOF
# MySQL optimization
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
vm.swappiness = 1
EOF

    sysctl -p

    log INFO "系统参数优化完成"
}

# 创建备份脚本
create_backup_script() {
    log INFO "创建自动备份脚本..."

    BACKUP_SCRIPT="/usr/local/bin/mysql-backup.sh"
    BACKUP_DIR="$PROJECT_ROOT/backups/database"

    # 创建备份目录
    mkdir -p "$BACKUP_DIR"

    # 创建备份脚本
    cat > "$BACKUP_SCRIPT" << 'EOF'
#!/bin/bash

# MySQL自动备份脚本
BACKUP_DIR="/opt/hula/backups/database"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 备份所有数据库
mysqldump --single-transaction --routines --triggers --events --all-databases | \
gzip > "$BACKUP_DIR/all_${DATE}.sql.gz"

# 删除旧备份
find "$BACKUP_DIR" -name "all_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "备份完成: all_${DATE}.sql.gz"
EOF

    chmod +x "$BACKUP_SCRIPT"

    # 添加到crontab
    (crontab -l 2>/dev/null; echo "0 2 * * * $BACKUP_SCRIPT") | crontab -

    log INFO "自动备份脚本创建完成"
}

# 部署数据库应用用户
deploy_users() {
    log INFO "部署数据库应用用户..."

    # 执行数据库初始化脚本
    if [ -f "$SCRIPT_DIR/db-init.sql" ]; then
        log INFO "执行数据库初始化..."
        mysql -uroot -p"$MYSQL_ROOT_PASSWORD" < "$SCRIPT_DIR/db-init.sql"
    else
        log ERROR "找不到数据库初始化脚本: $SCRIPT_DIR/db-init.sql"
        exit 1
    fi

    log INFO "数据库用户部署完成"
}

# 安装监控插件
install_monitoring() {
    log INFO "安装监控插件..."

    # 安装Percona监控插件（可选）
    # wget https://repo.percona.com/apt/percona-release_latest.generic_all.deb
    # dpkg -i percona-release_latest.generic_all.deb
    # apt-get update
    # apt-get install -y percona-monitoring-plugins

    # 创建监控用户
    mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "
        CREATE USER IF NOT EXISTS 'monitor'@'%' IDENTIFIED BY 'Monitor@2025#Secure';
        GRANT SELECT ON *.* TO 'monitor'@'%';
        GRANT REPLICATION CLIENT ON *.* TO 'monitor'@'%';
        FLUSH PRIVILEGES;
    "

    log INFO "监控插件安装完成"
}

# 验证部署
verify_deployment() {
    log INFO "验证部署..."

    # 检查MySQL状态
    if systemctl is-active --quiet mysqld; then
        log INFO "MySQL服务运行正常"
    else
        log ERROR "MySQL服务未运行"
        return 1
    fi

    # 测试连接
    if mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SELECT VERSION();" >/dev/null 2>&1; then
        log INFO "MySQL连接测试成功"
    else
        log ERROR "MySQL连接测试失败"
        return 1
    }

    # 检查用户
    log INFO "检查数据库用户..."
    mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SELECT User, Host FROM mysql.user;" | grep luohuo

    log INFO "部署验证完成"
}

# 主函数
main() {
    log INFO "开始部署HuLa数据库环境..."
    echo ""

    # 检查权限
    if [ "$EUID" -ne 0 ]; then
        log ERROR "请使用root权限运行此脚本"
        exit 1
    fi

    # 执行部署步骤
    check_os
    install_mysql
    get_temp_password
    configure_mysql
    set_root_password
    optimize_system
    deploy_users
    create_backup_script
    install_monitoring
    verify_deployment

    echo ""
    log INFO "============================================"
    log INFO "HuLa数据库环境部署完成！"
    log INFO "============================================"
    echo ""
    log INFO "数据库连接信息:"
    log INFO "  主机: $MYSQL_HOST:3306"
    log INFO "  Root密码: $MYSQL_ROOT_PASSWORD"
    echo ""
    log INFO "应用用户已创建:"
    log INFO "  - luohuo_im (IM服务)"
    log INFO "  - luohuo_base (Base服务)"
    log INFO "  - luohuo_oauth (OAuth服务)"
    log INFO "  - luohuo_system (System服务)"
    log INFO "  - nacos (Nacos配置)"
    echo ""
    log INFO "管理命令:"
    log INFO "  bash scripts/db-manager.sh check  # 检查状态"
    log INFO "  bash scripts/db-manager.sh backup # 备份数据"
    echo ""
}

# 运行主函数
main "$@"