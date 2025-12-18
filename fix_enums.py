import os
import re

directory = 'luohuo-cloud/luohuo-im/luohuo-im-entity/src/main/java/com/luohuo/flex/im/'

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    if 'implements BaseEnum' in content:
        return

    # Find package
    package_match = re.search(r'package\s+([\w.]+);', content)
    if not package_match:
        return

    # Find class name
    class_match = re.search(r'public\s+enum\s+(\w+)', content)
    if not class_match:
        return
    class_name = class_match.group(1)

    print(f"Fixing {class_name} in {filepath}")

    # Identify fields
    code_field = None
    code_type = None
    desc_field = None

    # Try to find @EnumValue field
    enum_value_match = re.search(r'@EnumValue\s+(?:@JsonValue\s+)?private\s+final\s+(\w+)\s+(\w+);', content)
    if not enum_value_match:
         enum_value_match = re.search(r'@EnumValue\s+private\s+final\s+(\w+)\s+(\w+);', content)

    if enum_value_match:
        code_type = enum_value_match.group(1)
        code_field = enum_value_match.group(2)
    else:
        # Heuristic search for code field
        for field in ['code', 'type', 'value', 'id', 'status']:
            match = re.search(r'private\s+final\s+(\w+)\s+' + field + ';', content)
            if match:
                code_type = match.group(1)
                code_field = field
                break

    # Heuristic search for desc field
    for field in ['desc', 'description', 'name']:
        match = re.search(r'private\s+final\s+String\s+' + field + ';', content)
        if match:
            desc_field = field
            break

    if not code_field or not desc_field:
        print(f"  Skipping {class_name}: Could not identify fields. Code: {code_field}, Desc: {desc_field}")
        return

    # Prepare replacements
    new_content = content
    
    # Add import
    if 'import com.luohuo.basic.interfaces.BaseEnum;' not in new_content:
        new_content = re.sub(r'(package\s+[\w.]+;)', r'\1\n\nimport com.luohuo.basic.interfaces.BaseEnum;', new_content)

    # Add implements
    new_content = re.sub(r'public\s+enum\s+' + class_name, r'public enum ' + class_name + ' implements BaseEnum', new_content)

    # Add methods
    methods = ""
    
    # getCode
    # Check if getCode already exists
    if f'public String getCode()' not in new_content:
        methods += "\n    @Override\n"
        methods += "    public String getCode() {\n"
        if code_type == 'String':
            methods += f"        return {code_field};\n"
        else:
            methods += f"        return String.valueOf({code_field});\n"
        methods += "    }\n"
    else:
        # If exists but returns something else, we might need to handle it.
        # But if it returns String, just add @Override
        pass

    # getDesc
    if f'public String getDesc()' not in new_content:
        methods += "\n    @Override\n"
        methods += "    public String getDesc() {\n"
        methods += f"        return {desc_field};\n"
        methods += "    }\n"

    # Insert methods before the last closing brace
    last_brace_index = new_content.rfind('}')
    new_content = new_content[:last_brace_index] + methods + new_content[last_brace_index:]

    with open(filepath, 'w') as f:
        f.write(new_content)

# Walk directory
for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith('.java'):
            fix_file(os.path.join(root, file))
