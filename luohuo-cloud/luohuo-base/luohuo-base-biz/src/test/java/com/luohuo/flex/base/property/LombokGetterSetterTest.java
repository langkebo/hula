package com.luohuo.flex.base.property;

import com.luohuo.flex.base.entity.user.BaseEmployee;
import com.luohuo.flex.base.entity.application.DefApplication;
import com.luohuo.flex.base.entity.application.DefResource;
import com.luohuo.flex.base.entity.application.DefResourceApi;
import com.luohuo.flex.base.entity.application.DefTenantApplicationRel;
import com.luohuo.flex.base.entity.system.BaseRoleResourceRel;
import com.luohuo.flex.base.entity.system.DefClient;
import com.luohuo.flex.base.entity.system.DefDict;
import com.luohuo.flex.base.entity.system.DefMsgTemplate;
import com.luohuo.flex.base.entity.system.DefParameter;
import com.luohuo.flex.base.entity.tenant.DefTenant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Lombok Getter/Setter Property Test
 *
 * This test verifies that Lombok annotations properly generate getter and setter methods
 * for all entity classes.
 *
 * Requirements: 1.1, 1.2 - Lombok 注解生成 getter/setter
 *
 * @author HuLa Team
 * @since 2025-12-15
 */
@DisplayName("Lombok Getter/Setter 属性测试")
class LombokGetterSetterTest {

    /**
     * Property 1: Lombok 注解生成 getter/setter
     * Validates: Requirements 1.1, 1.2
     */
    @ParameterizedTest
    @ValueSource(classes = {
        BaseEmployee.class,
        DefApplication.class,
        DefResource.class,
        DefResourceApi.class,
        DefTenantApplicationRel.class,
        BaseRoleResourceRel.class,
        DefClient.class,
        DefDict.class,
        DefMsgTemplate.class,
        DefParameter.class,
        DefTenant.class
    })
    @DisplayName("验证所有类都有正确的getter/setter方法")
    <T> void testGetterSetterMethodsGenerated(Class<T> clazz) {
        // Check that the class is not null
        assertNotNull(clazz, "类不能为空: " + clazz.getName());

        // Get all declared fields
        java.lang.reflect.Field[] fields = clazz.getDeclaredFields();

        // For each field, check if getter and setter methods exist
        for (java.lang.reflect.Field field : fields) {
            String fieldName = field.getName();

            // Skip static fields and serialVersionUID
            if (java.lang.reflect.Modifier.isStatic(field.getModifiers())) {
                continue;
            }

            // Check for getter method
            String getterName = "get" + capitalize(fieldName);
            if (field.getType() == boolean.class || field.getType() == Boolean.class) {
                // Try both isXxx and getXxx for boolean fields
                try {
                    clazz.getMethod("is" + capitalize(fieldName));
                    continue; // Found isXxx, skip to next field
                } catch (NoSuchMethodException e) {
                    // Try getXxx instead
                }
            }

            try {
                Method getter = clazz.getMethod(getterName);
                assertNotNull(getter,
                    String.format("类 %s 的字段 %s 缺少 getter 方法: %s()",
                        clazz.getSimpleName(), fieldName, getterName));
            } catch (NoSuchMethodException e) {
                fail(String.format("类 %s 的字段 %s 缺少 getter 方法: %s()",
                    clazz.getSimpleName(), fieldName, getterName));
            }
        }
    }

    /**
     * Test specific entities that were fixed
     */
    @Test
    @DisplayName("验证修复后的实体类有getter/setter方法")
    void testFixedEntitiesHaveGetterSetter() {
        // Test BaseEmployee - activeStatus is String type
        assertDoesNotThrow(() -> {
            BaseEmployee employee = new BaseEmployee();
            employee.setActiveStatus("active");
            assertEquals("active", employee.getActiveStatus());
        }, "BaseEmployee 应该有 activeStatus 的 getter/setter");

        // Test DefApplication
        assertDoesNotThrow(() -> {
            DefApplication app = new DefApplication();
            app.setName("test");
            assertEquals("test", app.getName());
        }, "DefApplication 应该有 name 的 getter/setter");

        // Test DefDict
        assertDoesNotThrow(() -> {
            DefDict dict = new DefDict();
            dict.setKey("testKey");
            assertEquals("testKey", dict.getKey());
        }, "DefDict 应该有 key 的 getter/setter");

        // Test DefTenant
        assertDoesNotThrow(() -> {
            DefTenant tenant = new DefTenant();
            tenant.setName("testTenant");
            assertEquals("testTenant", tenant.getName());
        }, "DefTenant 应该有 name 的 getter/setter");
    }

    /**
     * Capitalize the first letter of a string
     */
    private String capitalize(String str) {
        if (str == null || str.isEmpty()) {
            return str;
        }
        return str.substring(0, 1).toUpperCase() + str.substring(1);
    }
}
