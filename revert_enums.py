import os
import re

directory = 'luohuo-cloud/luohuo-im/luohuo-im-entity/src/main/java/com/luohuo/flex/im/'

def revert_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    if 'implements BaseEnum' not in content and 'import com.luohuo.basic.interfaces.BaseEnum;' not in content:
        return

    print(f"Reverting {filepath}")

    # Remove import
    content = content.replace('import com.luohuo.basic.interfaces.BaseEnum;', '')
    
    # Remove implements
    content = re.sub(r'public\s+enum\s+(\w+)\s+implements\s+BaseEnum', r'public enum \1', content)
    
    # Remove getCode method block
    # Matches: @Override (optional newline) public String getCode() { return ...; }
    content = re.sub(r'\s*@Override\s*\n\s*public\s+String\s+getCode\(\)\s*\{\s*return\s+[^;]+;\s*\}\s*', '', content)
    
    # Remove getDesc method block
    content = re.sub(r'\s*@Override\s*\n\s*public\s+String\s+getDesc\(\)\s*\{\s*return\s+[^;]+;\s*\}\s*', '', content)

    # Fix extra newlines if any
    content = re.sub(r'\n{3,}', '\n\n', content)

    with open(filepath, 'w') as f:
        f.write(content)

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith('.java'):
            revert_file(os.path.join(root, file))
