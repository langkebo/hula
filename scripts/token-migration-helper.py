#!/usr/bin/env python3
"""
Design Token Migration Helper
用于检测和替换非 --tjg-* 命名空间的 CSS 变量引用
"""

import os
import re
import sys
from pathlib import Path


def find_css_variables(file_path):
    """查找文件中的所有 CSS 变量引用"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 匹配各种 CSS 变量格式
    patterns = [
        r'var\(\s*(--[^)]+)\s*\)',  # var(--xxx)
        r'(?<![-\w])(--[a-zA-Z][-\w]*)(?![\w-])',  # 独立的 --xxx
    ]

    found = set()
    for pattern in patterns:
        matches = re.findall(pattern, content)
        found.update(matches)

    return found


def analyze_token_usage(directory):
    """分析目录中所有文件的 token 使用情况"""
    token_counts = {}
    files_to_check = []

    # 支持的扩展名
    extensions = {'.vue', '.ts', '.scss', '.css'}

    for root, dirs, files in os.walk(directory):
        # 跳过 node_modules 和 __tests__
        dirs[:] = [d for d in dirs if d not in ['node_modules', '__tests__', 'dist', '.git']]

        for file in files:
            if Path(file).suffix in extensions:
                filepath = os.path.join(root, file)
                files_to_check.append(filepath)

    # 分析每个文件
    for filepath in files_to_check:
        try:
            tokens = find_css_variables(filepath)
            for token in tokens:
                if token not in token_counts:
                    token_counts[token] = {'count': 0, 'files': []}
                token_counts[token]['count'] += 1
                token_counts[token]['files'].append(filepath)
        except Exception as e:
            print(f"Warning: Could not read {filepath}: {e}", file=sys.stderr)

    return token_counts


def classify_token(token):
    """分类 token 类型"""
    if token.startswith('--tjg-'):
        return '规范'
    elif token.startswith('--hula-'):
        return '旧别名'
    elif token.startswith('--color-') or token.startswith('--bg-'):
        return '未迁移'
    elif token.startswith('--'):
        return '自定义'
    else:
        return '其他'


def generate_report(token_counts, output_file):
    """生成分析报告"""
    report_lines = []
    report_lines.append("# Design Token Usage Report")
    report_lines.append(f"\nGenerated: {__import__('datetime').datetime.now().isoformat()}")
    report_lines.append(f"Total unique tokens: {len(token_counts)}\n")

    # 按分类分组
    categories = {'规范': [], '旧别名': [], '未迁移': [], '自定义': [], '其他': []}
    for token, data in token_counts.items():
        cat = classify_token(token)
        categories[cat].append((token, data))

    # 输出报告
    for cat in categories:
        if categories[cat]:
            report_lines.append(f"\n## {cat} ({len(categories[cat])} tokens)")
            for token, data in sorted(categories[cat], key=lambda x: x[1]['count'], reverse=True):
                report_lines.append(f"- `{token}`: {data['count']} uses in {len(data['files'])} files")

    report_lines.append("\n## Recommendations")
    if categories['旧别名']:
        report_lines.append("\n### High Priority: 清理旧别名")
        for token, _ in categories['旧别名']:
            report_lines.append(f"- 考虑删除或迁移 `{token}`")

    if categories['未迁移']:
        report_lines.append("\n### High Priority: 迁移未迁移的 token")
        for token, _ in categories['未迁移']:
            report_lines.append(f"- 使用 --tjg-* 命名空间替代 `{token}`")

    # 写入文件
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(report_lines))

    return report_lines


def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("Usage: python token_migration_helper.py <directory> [output_file]")
        sys.exit(1)

    directory = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else 'token-usage-report.md'

    print(f"Analyzing tokens in: {directory}")
    token_counts = analyze_token_usage(directory)

    print(f"Generating report: {output_file}")
    report_lines = generate_report(token_counts, output_file)

    print(f"\nReport generated: {output_file}")
    print(f"Found {len(token_counts)} unique tokens")

    # 输出统计
    categories = {'规范': 0, '旧别名': 0, '未迁移': 0, '自定义': 0, '其他': 0}
    for token in token_counts:
        cat = classify_token(token)
        categories[cat] += 1

    print(f"\nToken distribution:")
    for cat, count in categories.items():
        print(f"  {cat}: {count}")


if __name__ == '__main__':
    main()
