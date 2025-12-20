#!/bin/bash

# HuLa-Server 健康检查脚本
# 用于检查所有服务的健康状态
# 使用方法: bash scripts/health-check.sh [options]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 默认配置
TIMEOUT=10
RETRIES=3
WAIT_TIME=5
VERBOSE=0
SERVICES_ONLY=0
INFRA_ONLY=0

# 获取脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 服务定义
declare -A INFRA_SERVICES=(
    ["mysql"]="MySQL数据库"
    ["redis"]="Redis缓存"
    ["nacos"]="Nacos注册中心"
    ["rocketmq-broker"]="RocketMQ Broker"
    ["rocketmq-nameserver"]="RocketMQ NameServer"
    ["minio"]="MinIO对象存储"
)

declare -A APP_SERVICES=(
    ["hula-gateway"]="Gateway网关服务"
    ["hula-oauth"]="OAuth认证服务"
    ["hula-base"]="Base基础服务"
    ["hula-im"]="IM即时通讯服务"
    ["hula-ws"]="WebSocket服务"
    ["hula-system"]="System系统服务"
)

# 端口映射
declare -A SERVICE_PORTS=(
    ["mysql"]="3306"
    ["redis"]="6379"
    ["nacos"]="8848"
    ["rocketmq-broker"]="10911"
    ["rocketmq-nameserver"]="9876"
    ["minio"]="9000"
    ["hula-gateway"]="18760"
    ["hula-oauth"]="8080"
    ["hula-base"]="8080"
    ["hula-im"]="8080"
    ["hula-ws"]="8080"
    ["hula-system"]="8080"
)

# 健康检查路径
declare -A HEALTH_PATHS=(
    ["hula-gateway"]="/actuator/health"
    ["hula-oauth"]="/actuator/health"
    ["hula-base"]="/actuator/health"
    ["hula-im"]="/actuator/health"
    ["hula-ws"]="/actuator/health"
    ["hula-system"]="/actuator/health"
)

# 显示帮助信息
show_help() {
    echo "HuLa-Server 健康检查脚本"
    echo ""
    echo "使用方法:"
    echo "  $0 [options]"
    echo ""
    echo "选项:"
    echo "  -t, --timeout <seconds>    请求超时时间 (默认: 10)"
    echo "  -r, --retries <count>      重试次数 (默认: 3)"
    echo "  -w, --wait <seconds>       重试等待时间 (默认: 5)"
    echo "  -v, --verbose              详细输出"
    echo "  -s, --services-only        仅检查应用服务"
    echo "  -i, --infra-only          仅检查基础设施服务"
    echo "  -j, --json                 输出JSON格式"
    echo "  -h, --help                 显示帮助信息"
    echo ""
    echo "示例:"
    echo "  $0                         # 检查所有服务"
    echo "  $0 -v                      # 详细模式"
    echo "  $0 -s                      # 仅检查应用服务"
    echo "  $0 -i                      # 仅检查基础设施"
    echo "  $0 -t 5 -r 5               # 设置超时和重试"
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

# 检查Docker容器状态
check_container() {
    local container="$1"
    local name="$2"
    local status

    log DEBUG "检查容器: $container"

    if ! docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "^$container"; then
        log ERROR "$name ($container): 容器未运行"
        return 1
    fi

    status=$(docker ps --format "{{.Names}}\t{{.Status}}" | grep "^$container" | awk '{print $2,$3,$4}')

    if [[ $status == *"healthy"* ]]; then
        log INFO "$name ($container): 健康 ✓"
        return 0
    elif [[ $status == *"unhealthy"* ]]; then
        log ERROR "$name ($container): 不健康 ✗"
        return 1
    else
        log WARN "$name ($container): 运行中 (无健康检查)"
        return 0
    fi
}

# 检查端口连通性
check_port() {
    local host="$1"
    local port="$2"
    local service="$3"

    log DEBUG "检查端口: $host:$port"

    if timeout "$TIMEOUT" bash -c "</dev/tcp/$host/$port" 2>/dev/null; then
        log INFO "$service ($host:$port): 端口连通 ✓"
        return 0
    else
        log ERROR "$service ($host:$port): 端口不可达 ✗"
        return 1
    fi
}

# 检查HTTP端点
check_http() {
    local url="$1"
    local service="$2"
    local retry=0

    log DEBUG "检查HTTP端点: $url"

    while [ $retry -lt $RETRIES ]; do
        if curl -sf -m "$TIMEOUT" "$url" >/dev/null 2>&1; then
            log INFO "$service ($url): HTTP OK ✓"
            return 0
        else
            retry=$((retry + 1))
            if [ $retry -lt $RETRIES ]; then
                log WARN "$service ($url): 重试 $retry/$RETRIES..."
                sleep $WAIT_TIME
            fi
        fi
    done

    log ERROR "$service ($url): HTTP失败 ✗"
    return 1
}

# 检查基础设施服务
check_infra() {
    local failed=0

    log INFO "检查基础设施服务..."
    echo ""

    for service in "${!INFRA_SERVICES[@]}"; do
        local name="${INFRA_SERVICES[$service]}"
        local port="${SERVICE_PORTS[$service]}"

        # 检查容器状态
        if ! check_container "$service" "$name"; then
            failed=1
            continue
        fi

        # 检查端口连通性
        if ! check_port "localhost" "$port" "$name"; then
            failed=1
        fi
    done

    echo ""
    return $failed
}

# 检查应用服务
check_apps() {
    local failed=0

    log INFO "检查应用服务..."
    echo ""

    for service in "${!APP_SERVICES[@]}"; do
        local name="${APP_SERVICES[$service]}"
        local port="${SERVICE_PORTS[$service]}"
        local health_path="${HEALTH_PATHS[$service]}"

        # 检查容器状态
        if ! check_container "$service" "$name"; then
            failed=1
            continue
        fi

        # 检查健康端点
        if [ -n "$health_path" ]; then
            local host_port_mapping=$(docker port "$service" 2>/dev/null | grep -E "^[0-9]+/tcp" | cut -d: -f2)
            if [ -n "$host_port_mapping" ]; then
                check_http "http://localhost:$host_port_mapping$health_path" "$name"
            else
                # 检查内部端口
                check_http "http://localhost:$port$health_path" "$name"
            fi
        fi
    done

    echo ""
    return $failed
}

# 输出JSON格式的健康状态
output_json() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%NZ")
    local overall_status="healthy"
    local failed_services=()

    # 检查所有服务并收集状态
    local json="{"
    json+='"timestamp":"'${timestamp}'",'
    json+='"services":{'

    # 基础设施服务
    for service in "${!INFRA_SERVICES[@]}"; do
        local status="healthy"
        if docker ps --format "{{.Names}}\t{{.Status}}" | grep -q "^$container"; then
            if [[ $(docker ps --format "{{.Names}}\t{{.Status}}" | grep "^$container") == *"unhealthy"* ]]; then
                status="unhealthy"
                failed_services+=("$service")
                overall_status="unhealthy"
            fi
        else
            status="down"
            failed_services+=("$service")
            overall_status="unhealthy"
        fi
        json+='"'$service'":{"status":"'$status'","type":"infra"},'
    done

    # 应用服务
    for service in "${!APP_SERVICES[@]}"; do
        local status="healthy"
        if docker ps --format "{{.Names}}\t{{.Status}}" | grep -q "^$container"; then
            if [[ $(docker ps --format "{{.Names}}\t{{.Status}}" | grep "^$container") == *"unhealthy"* ]]; then
                status="unhealthy"
                failed_services+=("$service")
                overall_status="unhealthy"
            fi
        else
            status="down"
            failed_services+=("$service")
            overall_status="unhealthy"
        fi
        json+='"'$service'":{"status":"'$status'","type":"app"},'
    done

    # 移除最后的逗号
    json=${json%,}
    json+='},'
    json+='"overall_status":"'$overall_status'",'
    json+='"failed_services":['

    for failed in "${failed_services[@]}"; do
        json+='"'$failed'",'
    done

    # 移除最后的逗号
    json=${json%,}
    json+=']}'

    echo "$json"
}

# 主函数
main() {
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            -r|--retries)
                RETRIES="$2"
                shift 2
                ;;
            -w|--wait)
                WAIT_TIME="$2"
                shift 2
                ;;
            -v|--verbose)
                VERBOSE=1
                shift
                ;;
            -s|--services-only)
                SERVICES_ONLY=1
                shift
                ;;
            -i|--infra-only)
                INFRA_ONLY=1
                shift
                ;;
            -j|--json)
                JSON_OUTPUT=1
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                echo "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # 切换到项目根目录
    cd "$PROJECT_ROOT"

    # 检查Docker是否运行
    if ! docker info >/dev/null 2>&1; then
        log ERROR "Docker未运行，请先启动Docker"
        exit 1
    fi

    local exit_code=0

    # 输出标题
    if [ "$JSON_OUTPUT" -eq 1 ]; then
        output_json
        exit $?
    fi

    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}      HuLa-Server 健康检查${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""

    # 检查基础设施
    if [ "$SERVICES_ONLY" -ne 1 ]; then
        check_infra
        exit_code=$((exit_code | $?))
    fi

    # 检查应用服务
    if [ "$INFRA_ONLY" -ne 1 ]; then
        check_apps
        exit_code=$((exit_code | $?))
    fi

    # 输出总结
    echo -e "${BLUE}========================================${NC}"
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}所有服务运行正常 ✓${NC}"
    else
        echo -e "${RED}存在问题，请检查上述错误 ✗${NC}"
    fi
    echo -e "${BLUE}========================================${NC}"

    exit $exit_code
}

# 运行主函数
main "$@"