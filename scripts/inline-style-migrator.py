#!/usr/bin/env python3
"""
内联样式迁移助手
扫描 Vue 文件中的内联 style 属性，按文件分组输出
"""
import os
import re
import sys
from pathlib import Path
from collections import defaultdict


def analyze_file(filepath):
    """分析单个文件的内联样式"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    inline_styles = []
    for match in re.finditer(r'style="([^"]+)"', content):
        style = match.group(1)
        line_num = content[:match.start()].count('\n') + 1
        inline_styles.append({
            'line': line_num,
            'style': style,
            'has_flex': 'display:' in style and 'flex' in style,
            'has_padding': 'padding' in style,
            'has_margin': 'margin' in style,
            'has_background': 'background' in style or 'bg-' in style,
            'has_color': 'color:' in style,
            'has_width': 'width:' in style,
            'has_position': 'position:' in style,
            'has_radius': 'border-radius' in style,
        })

    return inline_styles


def scan_directory(directory, extensions={'.vue', '.ts', '.scss', '.css'}):
    """扫描目录中所有文件"""
    results = defaultdict(list)

    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '__tests__', 'dist', '.git', 'storybook', '.idea']]

        for file in files:
            if Path(file).suffix in extensions:
                filepath = os.path.join(root, file)
                try:
                    styles = analyze_file(filepath)
                    if styles:
                        results[filepath] = styles
                except Exception as e:
                    print(f"Error reading {filepath}: {e}", file=sys.stderr)

    return results


def classify_pattern(style_text):
    """分类样式模式"""
    patterns = []
    if 'display:' in style_text and ('flex' in style_text or 'grid' in style_text):
        patterns.append('layout-flex')
    if 'margin' in style_text:
        patterns.append('spacing-margin')
    if 'padding' in style_text:
        patterns.append('spacing-padding')
    if 'background' in style_text:
        patterns.append('background')
    if 'color:' in style_text:
        patterns.append('color')
    if 'border' in style_text:
        patterns.append('border')
    if 'border-radius' in style_text:
        patterns.append('radius')
    if 'font-size' in style_text:
        patterns.append('typography')
    if 'width:' in style_text or 'height:' in style_text:
        patterns.append('dimension')
    if 'position' in style_text:
        patterns.append('position')
    return patterns or ['other']


def generate_report(results):
    """生成分析报告"""
    total_styles = sum(len(styles) for styles in results.values())
    total_files = len(results)

    print(f"=== 内联样式迁移分析报告 ===")
    print(f"总计：{total_styles} 处内联样式，分布在 {total_files} 个文件中\n")

    # 按模式分类统计
    pattern_counts = defaultdict(int)
    for filepath, styles in results.items():
        for style in styles:
            for pattern in classify_pattern(style['style']):
                pattern_counts[pattern] += 1

    print("样式模式分布：")
    for pattern, count in sorted(pattern_counts.items(), key=lambda x: -x[1]):
        print(f"  {pattern}: {count}")

    print("\n--- 按文件列出 ---")
    for filepath, styles in sorted(results.items()):
        print(f"\n{filepath} ({len(styles)} 处):")
        for s in styles:
            print(f"  L{s['line']}: {s['style'][:100]}")

    return total_styles, total_files


def main():
    directory = sys.argv[1] if len(sys.argv) > 1 else 'src'

    results = scan_directory(directory)
    total_styles, total_files = generate_report(results)

    # 生成迁移优先级列表
    print("\n=== 迁移优先级建议 ===")
    print("高优先级（核心视图）：")
    priority_dirs = ['views/loginWindow/', 'views/homeWindow/', 'views/settingsWindow/', 'layout/', 'views/']
    for filepath in sorted(results.keys()):
        if any(fp in filepath for fp in priority_dirs):
            print(f"  {filepath} ({len(results[filepath])} 处)")

    print("\n中优先级（通用组件）：")
    for filepath in sorted(results.keys()):
        if 'components/' in filepath and not any(fp in filepath for fp in priority_dirs):
            print(f"  {filepath} ({len(results[filepath])} 处)")

    return 0


if __name__ == '__main__':
    sys.exit(main())
