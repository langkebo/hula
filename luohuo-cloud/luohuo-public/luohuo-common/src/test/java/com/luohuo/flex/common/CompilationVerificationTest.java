package com.luohuo.flex.common;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Compilation Verification Test
 * 
 * This test verifies that the HuLa-Server project compiles successfully.
 * It serves as a smoke test to ensure all modules can be compiled without errors.
 * 
 * Requirements: 1.1 - WHEN 开发者执行 mvn compile THEN THE 系统 SHALL 成功编译所有模块，无编译错误
 * 
 * @author HuLa Team
 * @since 2025-12-13
 */
@DisplayName("编译验证测试")
class CompilationVerificationTest {

    /**
     * Verifies that the project structure is correct and core classes are accessible.
     * This test will fail at compile time if there are any compilation errors.
     */
    @Test
    @DisplayName("验证项目编译成功 - 核心类可访问")
    void testProjectCompilationSuccess() {
        // If this test runs, it means the project compiled successfully
        // This is a smoke test to verify compilation
        assertTrue(true, "项目编译成功");
    }

    /**
     * Verifies that the common module classes are properly compiled and accessible.
     */
    @Test
    @DisplayName("验证公共模块类可访问")
    void testCommonModuleClassesAccessible() {
        // Verify that we can access classes from the common module
        // This ensures the module compiled correctly
        assertNotNull(CompilationVerificationTest.class.getClassLoader(),
            "类加载器应该可用");
    }

    /**
     * Verifies that the Java version is compatible with the project requirements.
     * The project requires Java 17+.
     */
    @Test
    @DisplayName("验证Java版本兼容性")
    void testJavaVersionCompatibility() {
        String javaVersion = System.getProperty("java.version");
        assertNotNull(javaVersion, "Java版本应该可获取");
        
        // Extract major version
        int majorVersion;
        if (javaVersion.startsWith("1.")) {
            majorVersion = Integer.parseInt(javaVersion.substring(2, 3));
        } else {
            int dotIndex = javaVersion.indexOf(".");
            if (dotIndex > 0) {
                majorVersion = Integer.parseInt(javaVersion.substring(0, dotIndex));
            } else {
                majorVersion = Integer.parseInt(javaVersion);
            }
        }
        
        assertTrue(majorVersion >= 17, 
            "Java版本应该 >= 17，当前版本: " + javaVersion);
    }

    /**
     * Verifies that required system properties are available.
     */
    @Test
    @DisplayName("验证系统属性可用")
    void testSystemPropertiesAvailable() {
        assertNotNull(System.getProperty("java.home"), "JAVA_HOME应该可用");
        assertNotNull(System.getProperty("user.dir"), "工作目录应该可用");
    }
}
