#!/bin/bash

# PII加密密钥生成脚本
# 用于生成Hula-IM系统PII字段加密所需的密钥

set -e

echo "======================================"
echo "Hula-IM PII加密密钥生成工具"
echo "======================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查OpenSSL是否安装
if ! command -v openssl &> /dev/null; then
    echo -e "${RED}错误: 未找到OpenSSL工具${NC}"
    echo "请先安装OpenSSL："
    echo "  Ubuntu/Debian: sudo apt-get install openssl"
    echo "  CentOS/RHEL: sudo yum install openssl"
    echo "  macOS: brew install openssl"
    exit 1
fi

# 生成密钥
echo -e "\n${BLUE}[1/4] 生成32字节随机密钥...${NC}"
KEY=$(openssl rand -base64 32)
echo -e "生成的密钥: ${GREEN}$KEY${NC}"

# 显示密钥信息
echo -e "\n${BLUE}[2/4] 密钥信息:${NC}"
echo "  - 长度: 32字节 (256位)"
echo "  - 编码: Base64"
echo "  - 算法: AES-256-GCM"

# 创建配置文件
echo -e "\n${BLUE}[3/4] 创建配置文件...${NC}"

# 创建Nacos配置文件
cat > ./common-pii-encryption.yml << EOF
# PII字段加密配置
# 生成时间: $(date)
pii:
  encryption:
    # 加密密钥 (请妥善保管!)
    key: "$KEY"

    # 启用PII加密
    enabled: true

    # 加密算法配置
    algorithm: "AES/GCM/NoPadding"
    iv-length: 12        # GCM推荐96位IV
    tag-length: 128      # GCM认证标签128位
    key-length: 256      # AES-256
EOF

echo -e "${GREEN}✓ 配置文件已生成: ./common-pii-encryption.yml${NC}"

# 创建环境变量文件
cat > .env.pii << EOF
# PII加密环境变量
# 请将此文件安全保存，不要提交到版本控制系统

# PII加密密钥
PII_ENCRYPTION_KEY=$KEY

# PII加密开关
PII_ENCRYPTION_ENABLED=true
EOF

echo -e "${GREEN}✓ 环境变量文件已生成: .env.pii${NC}"

# 保存密钥到文件（加密存储）
echo -e "\n${BLUE}[4/4] 保存密钥...${NC}"

# 创建密钥备份文件（使用简单加密）
BACKUP_FILE="pii-key-backup-$(date +%Y%m%d).txt"
echo "密钥备份文件: $BACKUP_FILE"

cat > $BACKUP_FILE << EOF
=========================================
Hula-IM PII加密密钥备份
=========================================

生成时间: $(date)
密钥: $KEY

重要提醒:
1. 请将此文件保存在安全的位置
2. 不要通过电子邮件等方式传输
3. 建议使用密码管理器存储
4. 定期更换密钥（建议90-180天）

配置方法:
1. 方法一 - 环境变量:
   export PII_ENCRYPTION_KEY="$KEY"

2. 方法二 - Nacos配置:
   在Nacos控制台添加配置 common-pii-encryption.yml
   内容请参考生成的 common-pii-encryption.yml 文件

3. 方法三 - Docker:
   docker run -e PII_ENCRYPTION_KEY="$KEY" your-app

=========================================
EOF

# 加密备份文件（简单XOR加密，仅防误看）
python3 -c "
import base64
key = b'hula-pii-backup-2025'
with open('$BACKUP_FILE', 'rb') as f:
    data = f.read()
encrypted = bytes([b ^ key[i % len(key)] for i, b in enumerate(data)])
with open('$BACKUP_FILE.enc', 'wb') as f:
    f.write(base64.b64encode(encrypted))
print(f'备份文件已加密保存: $BACKUP_FILE.enc')
" 2>/dev/null || echo "Python3不可用，跳过加密步骤"

# 清理
rm -f .env.pii

echo -e "\n${YELLOW}======================================"
echo -e "配置完成！${NC}"
echo -e "======================================"
echo -e "\n下一步操作:"
echo -e "1. ${BLUE}将密钥配置到环境变量:${NC}"
echo -e "   export PII_ENCRYPTION_KEY=\"$KEY\""
echo -e "\n2. ${BLUE}或在Nacos控制台添加配置:${NC}"
echo -e "   - 登录: http://localhost:8848/nacos"
echo -e "   - 添加配置: common-pii-encryption.yml"
echo -e "   - 使用生成的配置文件内容"
echo -e "\n3. ${BLUE}重启应用服务${NC}"
echo -e "4. ${BLUE}查看日志确认:${NC}"
echo -e "   tail -f logs/application.log | grep 'PII'"
echo -e "\n${RED}⚠️  重要提醒:${NC}"
echo -e "  - 请妥善保管生成的密钥"
echo -e "  - 不要将密钥提交到版本控制系统"
echo -e "  - 定期更换密钥（90-180天）"
echo -e "  - 备份文件位于: $BACKUP_FILE"

# 测试密钥
echo -e "\n${BLUE}测试密钥长度...${NC}"
KEY_DECODED=$(echo -n "$KEY" | base64 -d 2>/dev/null)
if [ ${#KEY_DECODED} -eq 32 ]; then
    echo -e "${GREEN}✓ 密钥长度正确 (32字节)${NC}"
else
    echo -e "${RED}✗ 密钥长度错误${NC}"
fi

echo -e "\n${GREEN}密钥生成和配置完成！${NC}"