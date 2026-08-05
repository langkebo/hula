#!/usr/bin/env python3
"""审计 public/icon.js 中 SVG sprite 的 data-follow-* 硬编码颜色。

背景（docs/icon-strategy-evaluation.md §3.3）：sprite 图标颜色应通过
currentColor 跟随上下文/主题；仅品牌装饰类固定视觉语义图标可保留硬编码色，
且必须登记在下方 WHITELIST（总数 <= MAX_WHITELIST）。

退出码：
  0 - 非白名单 symbol 无 data-follow-*="#hex" 硬编码，且白名单合规
  1 - 存在非白名单硬编码，或白名单超限/登记了不存在/无硬编码的 symbol

用法：python3 scripts/audit-icon-colors.py [-v]
"""

import re
import sys
from pathlib import Path

ICON_JS = Path(__file__).resolve().parent.parent / "public" / "icon.js"

MAX_WHITELIST = 5
MAX_RESIDUAL = 5  # 白名单内残留硬编码总处数上限（G4 验收口径）

# 白名单：品牌装饰类固定视觉语义图标（key 为 symbol id，value 为保留理由）。
WHITELIST = {
    # 双色调品牌成功标识（#13987f 描边 + #AFDBD2 底色）。在 CaptchaVerify、
    # MobileCaptchaVerify、TjgSpaceJoinCta、TjgMessageMeta、MessageForwardDialog、
    # renderMessage/index 等 6+ 处作为固定的“成功/已选”品牌标记使用，多数引用方
    # 不设置颜色上下文；转为 currentColor 会使绿色成功标识退化为文本色，损失品牌语义。
    "success": "双色调品牌成功标识，多处引用无颜色上下文，转 currentColor 丢失品牌视觉语义",
}

SYMBOL_RE = re.compile(r'<symbol id="([^"]+)"[^>]*>(.*?)</symbol>', re.S)
FOLLOW_HEX_RE = re.compile(r'data-follow-(fill|stroke)="(#[0-9a-fA-F]+)"')


def audit() -> int:
    if not ICON_JS.is_file():
        print(f"[FAIL] 未找到审计文件: {ICON_JS}")
        return 1
    text = ICON_JS.read_text(encoding="utf-8")
    symbols = SYMBOL_RE.findall(text)

    violations: dict[str, list[str]] = {}
    whitelisted_hits: dict[str, list[str]] = {}

    for symbol_id, body in symbols:
        hits = [f"data-follow-{kind}={color}" for kind, color in FOLLOW_HEX_RE.findall(body)]
        if not hits:
            continue
        if symbol_id in WHITELIST:
            whitelisted_hits[symbol_id] = hits
        else:
            violations[symbol_id] = hits

    print(f"审计文件: {ICON_JS.relative_to(ICON_JS.parents[2])}（{len(symbols)} 个 symbol）")

    ok = True

    if violations:
        ok = False
        total = sum(len(v) for v in violations.values())
        print(f"\n[FAIL] 非白名单硬编码 {total} 处，分布在 {len(violations)} 个 symbol：")
        for symbol_id, hits in sorted(violations.items()):
            print(f"  - {symbol_id} ({len(hits)} 处): {', '.join(hits)}")
        print("  修复：替换为 currentColor，或确认品牌装饰语义后登记 WHITELIST。")
    else:
        print("\n[OK] 非白名单 symbol 无 data-follow-* 硬编码颜色。")

    stale = sorted(set(WHITELIST) - {sid for sid, _ in symbols})
    if stale:
        ok = False
        print(f"\n[FAIL] 白名单登记了不存在的 symbol: {', '.join(stale)}")

    ineffective = sorted(set(WHITELIST) - set(whitelisted_hits) - set(stale))
    if ineffective:
        ok = False
        print(f"\n[FAIL] 白名单 symbol 已无硬编码，应移出白名单: {', '.join(ineffective)}")

    residual = sum(len(v) for v in whitelisted_hits.values())
    print(f"\n白名单 {len(WHITELIST)}/{MAX_WHITELIST} 个 symbol，残留硬编码 {residual} 处：")
    for symbol_id, hits in sorted(whitelisted_hits.items()):
        print(f"  - {symbol_id} ({len(hits)} 处): {', '.join(hits)}")
        print(f"    理由: {WHITELIST[symbol_id]}")
    if len(WHITELIST) > MAX_WHITELIST:
        ok = False
        print(f"[FAIL] 白名单超出上限 {MAX_WHITELIST} 个。")
    if residual > MAX_RESIDUAL:
        ok = False
        print(f"[FAIL] 白名单残留硬编码 {residual} 处，超出上限 {MAX_RESIDUAL} 处。")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(audit())
