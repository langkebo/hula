import json
import subprocess
import sys

result = subprocess.run(
    ["npx", "biome", "check", "--max-diagnostics=300", "--reporter=json"],
    capture_output=True,
    text=True,
    cwd="/Users/ljf/Desktop/hu_ts/hula",
)
data = json.loads(result.stdout)

diag = data.get("diagnostics", [])
results = {}
for d in diag:
    category = d.get("category", "")
    if "noUnusedVariables" not in category and "noUnusedImports" not in category:
        continue
    msg = d.get("message", "")
    rule = "import" if "Import" in category else "var"
    loc = d.get("location", {})
    start = loc.get("start", {})
    start_line = start.get("line", 0) + 1
    f = loc.get("path", "")
    results.setdefault(f, []).append((start_line, rule, msg))

for f in sorted(results):
    print("FILE:", f)
    for ln, rule, msg in sorted(results[f]):
        print("  line", ln, f"[{rule}]", msg)
print("TOTAL", sum(len(v) for v in results.values()))
