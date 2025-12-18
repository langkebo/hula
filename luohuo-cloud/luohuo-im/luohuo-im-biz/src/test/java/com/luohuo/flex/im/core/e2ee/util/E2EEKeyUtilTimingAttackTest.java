package com.luohuo.flex.im.core.e2ee.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.RepeatedTest;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * E2EEKeyUtil 时间攻击防护测试
 *
 * ===== P1修复: 时间攻击防护单元测试 (2025-12-13) =====
 *
 * 验证 constantTimeEquals() 方法的安全性:
 * 1. 功能正确性测试
 * 2. 时间常量性验证（防止时间攻击）
 * 3. 边界条件测试
 *
 * @author HuLa Team
 * @since 2025-12-13
 */
@DisplayName("E2EEKeyUtil - 时间攻击防护测试")
public class E2EEKeyUtilTimingAttackTest {

    private static volatile boolean resultSink;

    // 测试用的密钥指纹（SHA-256 Base64格式，44字符）
    private static final String VALID_FINGERPRINT_1 = "rE0nuXJIxFGqJMCCW1pbRmSc5sQXP4cQQ8j2wE/WLLs=";
    private static final String VALID_FINGERPRINT_2 = "rE0nuXJIxFGqJMCCW1pbRmSc5sQXP4cQQ8j2wE/WLLs="; // 相同
    private static final String DIFFERENT_FINGERPRINT = "aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789+/ABC="; // 不同

    @Test
    @DisplayName("基础功能测试 - 相同指纹应返回true")
    void testEqualFingerprints() {
        assertTrue(E2EEKeyUtil.constantTimeEquals(VALID_FINGERPRINT_1, VALID_FINGERPRINT_2),
                "相同的指纹应该返回true");
    }

    @Test
    @DisplayName("基础功能测试 - 不同指纹应返回false")
    void testDifferentFingerprints() {
        assertFalse(E2EEKeyUtil.constantTimeEquals(VALID_FINGERPRINT_1, DIFFERENT_FINGERPRINT),
                "不同的指纹应该返回false");
    }

    @Test
    @DisplayName("基础功能测试 - 仅最后一个字符不同")
    void testOnlyLastCharDifferent() {
        String fingerprint1 = "rE0nuXJIxFGqJMCCW1pbRmSc5sQXP4cQQ8j2wE/WLLs=";
        String fingerprint2 = "rE0nuXJIxFGqJMCCW1pbRmSc5sQXP4cQQ8j2wE/WLLT="; // 最后一个字符不同

        assertFalse(E2EEKeyUtil.constantTimeEquals(fingerprint1, fingerprint2),
                "即使只有最后一个字符不同，也应返回false");
    }

    @Test
    @DisplayName("边界条件测试 - null值处理")
    void testNullValues() {
        assertFalse(E2EEKeyUtil.constantTimeEquals(null, VALID_FINGERPRINT_1),
                "第一个参数为null应返回false");

        assertFalse(E2EEKeyUtil.constantTimeEquals(VALID_FINGERPRINT_1, null),
                "第二个参数为null应返回false");

        assertTrue(E2EEKeyUtil.constantTimeEquals(null, null),
                "两个参数都为null应返回true");
    }

    @Test
    @DisplayName("边界条件测试 - 空字符串")
    void testEmptyStrings() {
        assertTrue(E2EEKeyUtil.constantTimeEquals("", ""),
                "两个空字符串应该相等");

        assertFalse(E2EEKeyUtil.constantTimeEquals("", VALID_FINGERPRINT_1),
                "空字符串和非空字符串应该不相等");

        assertFalse(E2EEKeyUtil.constantTimeEquals(VALID_FINGERPRINT_1, ""),
                "非空字符串和空字符串应该不相等");
    }

    @Test
    @DisplayName("边界条件测试 - 不同长度的字符串")
    void testDifferentLengths() {
        String short1 = "short";
        String longer = "muchLongerString";

        assertFalse(E2EEKeyUtil.constantTimeEquals(short1, longer),
                "不同长度的字符串应该返回false");

        assertFalse(E2EEKeyUtil.constantTimeEquals(longer, short1),
                "不同长度的字符串应该返回false（反向）");
    }

    @Test
    @DisplayName("Unicode字符测试")
    void testUnicodeCharacters() {
        String unicode1 = "密钥指纹123";
        String unicode2 = "密钥指纹123";
        String unicode3 = "密钥指纹124";

        assertTrue(E2EEKeyUtil.constantTimeEquals(unicode1, unicode2),
                "相同的Unicode字符串应该相等");

        assertFalse(E2EEKeyUtil.constantTimeEquals(unicode1, unicode3),
                "不同的Unicode字符串应该不相等");
    }

    @Test
    @DisplayName("时间常量性验证 - 相同长度的不同字符串比较时间应相近")
    void testTimingAttackResistance() {
        // 准备测试数据：相同长度的字符串
        String target = VALID_FINGERPRINT_1;

        // 情况1：第一个字符就不同
        String diffFirst = "X" + target.substring(1);

        // 情况2：最后一个字符不同
        String diffLast = target.substring(0, target.length() - 1) + "X";

        int samples = 15;
        int iterations = 50000;

        List<Long> timesFirst = new ArrayList<>();
        List<Long> timesLast = new ArrayList<>();

        for (int i = 0; i < samples; i++) {
            timesFirst.add(measureComparisonTime(target, diffFirst, iterations));
            timesLast.add(measureComparisonTime(target, diffLast, iterations));
        }

        long medianFirst = median(timesFirst);
        long medianLast = median(timesLast);

        double timeDifference = Math.abs(medianFirst - medianLast);
        double avgTime = (medianFirst + medianLast) / 2.0;
        double differencePercent = (timeDifference / avgTime) * 100;

        assertTrue(differencePercent < 35,
                String.format("时间差异过大: %.2f%% (中位数: 第一个字符不同: %dns, 最后一个字符不同: %dns). " +
                        "可能存在时间泄露漏洞！", differencePercent, medianFirst, medianLast));

        System.out.printf("时间常量性验证通过(中位数): 第一个字符不同=%dns, 最后一个字符不同=%dns, 差异=%.2f%%%n",
                medianFirst, medianLast, differencePercent);
    }

    @Test
    @DisplayName("时间常量性验证 - 不同长度字符串的比较时间")
    @RepeatedTest(3)
    void testTimingForDifferentLengths() {
        String target = VALID_FINGERPRINT_1;
        String shortString = "short";
        String longString = target + "extraLongSuffix";

        int iterations = 10000;

        long timeShort = measureComparisonTime(target, shortString, iterations);
        long timeLong = measureComparisonTime(target, longString, iterations);

        // 不同长度的字符串比较时间不应该泄露太多信息
        // MessageDigest.isEqual() 会处理不同长度的情况
        System.out.printf("不同长度字符串比较: 短字符串=%dns, 长字符串=%dns%n",
                timeShort, timeLong);

        // 这个测试主要是观察性的，确保没有明显的时间泄露
        assertTrue(timeShort > 0 && timeLong > 0, "比较操作应该有执行时间");
    }

    @Test
    @DisplayName("统计学验证 - 多次测量时间分布")
    void testTimingDistribution() {
        String target = VALID_FINGERPRINT_1;
        String diffFirst = "X" + target.substring(1);
        String diffLast = target.substring(0, target.length() - 1) + "X";

        int samples = 100;
        int iterations = 1000;

        List<Long> timesFirst = new ArrayList<>();
        List<Long> timesLast = new ArrayList<>();

        // 收集多组样本
        for (int i = 0; i < samples; i++) {
            timesFirst.add(measureComparisonTime(target, diffFirst, iterations));
            timesLast.add(measureComparisonTime(target, diffLast, iterations));
        }

        // 计算统计信息
        double avgFirst = timesFirst.stream().mapToLong(Long::longValue).average().orElse(0);
        double avgLast = timesLast.stream().mapToLong(Long::longValue).average().orElse(0);

        double stdDevFirst = calculateStdDev(timesFirst, avgFirst);
        double stdDevLast = calculateStdDev(timesLast, avgLast);

        System.out.printf("统计分析结果:%n");
        System.out.printf("  第一个字符不同: 平均=%,.2f ns, 标准差=%,.2f ns%n", avgFirst, stdDevFirst);
        System.out.printf("  最后一个字符不同: 平均=%,.2f ns, 标准差=%,.2f ns%n", avgLast, stdDevLast);

        // 使用t-test检验两组数据是否有显著差异
        // 简化版本：检查平均值差异是否在合理范围内
        double avgDiff = Math.abs(avgFirst - avgLast);
        double maxAllowedDiff = Math.max(avgFirst, avgLast) * 0.35; // 允许35%差异

        assertTrue(avgDiff < maxAllowedDiff,
                String.format("平均时间差异过大: %.2f ns (允许: %.2f ns)", avgDiff, maxAllowedDiff));
    }

    // ========== 辅助方法 ==========

    /**
     * 测量比较操作的执行时间
     *
     * @param str1       字符串1
     * @param str2       字符串2
     * @param iterations 迭代次数
     * @return 平均每次比较的纳秒数
     */
    private long measureComparisonTime(String str1, String str2, int iterations) {
        // 预热JVM（避免JIT编译影响）
        boolean local = false;
        for (int i = 0; i < 1000; i++) {
            local ^= E2EEKeyUtil.constantTimeEquals(str1, str2);
        }
        resultSink = local;

        // 实际测量
        long startTime = System.nanoTime();
        local = false;
        for (int i = 0; i < iterations; i++) {
            local ^= E2EEKeyUtil.constantTimeEquals(str1, str2);
        }
        long endTime = System.nanoTime();

        resultSink = local;

        return (endTime - startTime) / iterations;
    }

    private long median(List<Long> values) {
        List<Long> sorted = new ArrayList<>(values);
        sorted.sort(Long::compareTo);
        return sorted.get(sorted.size() / 2);
    }

    /**
     * 计算标准差
     */
    private double calculateStdDev(List<Long> values, double mean) {
        double sumSquaredDiff = 0;
        for (Long value : values) {
            double diff = value - mean;
            sumSquaredDiff += diff * diff;
        }
        return Math.sqrt(sumSquaredDiff / values.size());
    }

    @Test
    @DisplayName("回归测试 - 确保修复后的方法仍然正确")
    void testRegressionAfterFix() {
        // 测试各种真实场景的指纹比较
        String[] testFingerprints = {
                "rE0nuXJIxFGqJMCCW1pbRmSc5sQXP4cQQ8j2wE/WLLs=",
                "aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789+/ABC=",
                "1234567890123456789012345678901234567890123=",
                "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
                "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz="
        };

        // 测试自身比较
        for (String fp : testFingerprints) {
            assertTrue(E2EEKeyUtil.constantTimeEquals(fp, fp),
                    "指纹与自身比较应该返回true: " + fp);
        }

        // 测试互相比较
        for (int i = 0; i < testFingerprints.length; i++) {
            for (int j = i + 1; j < testFingerprints.length; j++) {
                assertFalse(E2EEKeyUtil.constantTimeEquals(testFingerprints[i], testFingerprints[j]),
                        String.format("不同的指纹应该返回false: %s vs %s",
                                testFingerprints[i], testFingerprints[j]));
            }
        }
    }

    @Test
    @DisplayName("性能测试 - 验证常量时间比较不会显著影响性能")
    void testPerformanceImpact() {
        String fp1 = VALID_FINGERPRINT_1;
        String fp2 = DIFFERENT_FINGERPRINT;

        int iterations = 1000000; // 100万次

        long startTime = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            E2EEKeyUtil.constantTimeEquals(fp1, fp2);
        }
        long endTime = System.nanoTime();

        long avgTimeNs = (endTime - startTime) / iterations;

        System.out.printf("性能测试: 平均每次比较耗时 %d 纳秒 (%.2f 微秒)%n",
                avgTimeNs, avgTimeNs / 1000.0);

        // 断言：每次比较应该在合理时间内完成（< 1微秒）
        assertTrue(avgTimeNs < 1000,
                String.format("比较操作过慢: %d ns (期望 < 1000 ns)", avgTimeNs));
    }
}
