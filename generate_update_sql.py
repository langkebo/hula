import hashlib
import sys

# Read the file
file_path = "mysql-fixed.yml"
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Calculate MD5
md5_val = hashlib.md5(content.encode('utf-8')).hexdigest()

# Escape for SQL
content_sql = content.replace("\\", "\\\\").replace("'", "\\'")

# Generate SQL
sql = f"UPDATE config_info SET content = '{content_sql}', md5 = '{md5_val}', gmt_modified = NOW() WHERE data_id = 'mysql.yml' AND group_id = 'DEFAULT_GROUP';"

print(sql)
