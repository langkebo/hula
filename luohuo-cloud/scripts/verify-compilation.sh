#!/bin/bash
# Compilation Verification Script
# This script verifies that the HuLa-Server project compiles successfully
# Requirements: 1.1 - WHEN 开发者执行 mvn compile THEN THE 系统 SHALL 成功编译所有模块，无编译错误

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "HuLa-Server Compilation Verification"
echo "=========================================="
echo "Project Root: $PROJECT_ROOT"
echo "Date: $(date)"
echo ""

# Change to project root
cd "$PROJECT_ROOT"

# Check Maven is available
if ! command -v mvn &> /dev/null; then
    echo "ERROR: Maven is not installed or not in PATH"
    exit 1
fi

echo "Maven Version:"
mvn --version
echo ""

# Run compilation
echo "Starting compilation..."
echo ""

# Compile with error output
if mvn compile -DskipTests -Dcheckstyle.skip=true -Dpmd.skip=true -Dspotbugs.skip=true 2>&1; then
    echo ""
    echo "=========================================="
    echo "✅ COMPILATION SUCCESSFUL"
    echo "=========================================="
    echo "All modules compiled without errors."
else
    echo ""
    echo "=========================================="
    echo "❌ COMPILATION FAILED"
    echo "=========================================="
    echo "Please check the error messages above."
    exit 1
fi

# Run verification tests (optional)
if [ "$1" == "--with-tests" ]; then
    echo ""
    echo "=========================================="
    echo "Running Compilation Verification Tests..."
    echo "=========================================="
    
    if mvn test -pl luohuo-public/luohuo-common -Dtest=CompilationVerificationTest 2>&1; then
        echo ""
        echo "=========================================="
        echo "✅ VERIFICATION TESTS PASSED"
        echo "=========================================="
    else
        echo ""
        echo "=========================================="
        echo "❌ VERIFICATION TESTS FAILED"
        echo "=========================================="
        exit 1
    fi
fi

echo ""
echo "=========================================="
echo "✅ ALL VERIFICATIONS PASSED"
echo "=========================================="
exit 0
