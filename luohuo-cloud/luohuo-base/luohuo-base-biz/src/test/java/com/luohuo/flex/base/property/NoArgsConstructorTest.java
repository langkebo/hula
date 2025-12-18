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

import static org.junit.jupiter.api.Assertions.*;

/**
 * No-ArgsConstructor Property Test
 *
 * This test verifies that all entity and VO classes have a no-argument constructor.
 *
 * Requirements: 1.4, 4.1, 4.2 - 无参构造器可用性
 *
 * @author HuLa Team
 * @since 2025-12-15
 */
@DisplayName("无参构造器属性测试")
class NoArgsConstructorTest {

    /**
     * Property 2: 无参构造器可用性
     * Validates: Requirements 1.4, 4.1, 4.2
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
    @DisplayName("验证所有类都有无参构造器")
    <T> void testNoArgsConstructorExists(Class<T> clazz) {
        // Check that the class is not null
        assertNotNull(clazz, "类不能为空: " + clazz.getName());

        // Try to create an instance using no-argument constructor
        try {
            T instance = clazz.getDeclaredConstructor().newInstance();
            assertNotNull(instance,
                String.format("类 %s 的无参构造器应该能创建实例", clazz.getSimpleName()));
        } catch (NoSuchMethodException e) {
            fail(String.format("类 %s 缺少无参构造器", clazz.getSimpleName()));
        } catch (Exception e) {
            // Other exceptions might occur during instantiation (e.g., field initialization)
            // We're just testing that the constructor exists
            try {
                clazz.getDeclaredConstructor();
            } catch (NoSuchMethodException e2) {
                fail(String.format("类 %s 缺少无参构造器", clazz.getSimpleName()));
            }
        }
    }

    /**
     * Test specific entities that were fixed to have no-argument constructors
     */
    @Test
    @DisplayName("验证修复后的实体类有无参构造器")
    void testFixedEntitiesHaveNoArgsConstructor() {
        // Test that entities can be instantiated via reflection
        assertDoesNotThrow(() -> {
            BaseEmployee employee = BaseEmployee.class.getDeclaredConstructor().newInstance();
            assertNotNull(employee);
        }, "BaseEmployee 应该有无参构造器");

        assertDoesNotThrow(() -> {
            DefApplication application = DefApplication.class.getDeclaredConstructor().newInstance();
            assertNotNull(application);
        }, "DefApplication 应该有无参构造器");

        assertDoesNotThrow(() -> {
            DefResource resource = DefResource.class.getDeclaredConstructor().newInstance();
            assertNotNull(resource);
        }, "DefResource 应该有无参构造器");

        assertDoesNotThrow(() -> {
            DefResourceApi resourceApi = DefResourceApi.class.getDeclaredConstructor().newInstance();
            assertNotNull(resourceApi);
        }, "DefResourceApi 应该有无参构造器");

        assertDoesNotThrow(() -> {
            DefTenantApplicationRel rel = DefTenantApplicationRel.class.getDeclaredConstructor().newInstance();
            assertNotNull(rel);
        }, "DefTenantApplicationRel 应该有无参构造器");

        assertDoesNotThrow(() -> {
            BaseRoleResourceRel roleResourceRel = BaseRoleResourceRel.class.getDeclaredConstructor().newInstance();
            assertNotNull(roleResourceRel);
        }, "BaseRoleResourceRel 应该有无参构造器");

        assertDoesNotThrow(() -> {
            DefClient client = DefClient.class.getDeclaredConstructor().newInstance();
            assertNotNull(client);
        }, "DefClient 应该有无参构造器");

        assertDoesNotThrow(() -> {
            DefDict dict = DefDict.class.getDeclaredConstructor().newInstance();
            assertNotNull(dict);
        }, "DefDict 应该有无参构造器");

        assertDoesNotThrow(() -> {
            DefMsgTemplate template = DefMsgTemplate.class.getDeclaredConstructor().newInstance();
            assertNotNull(template);
        }, "DefMsgTemplate 应该有无参构造器");

        assertDoesNotThrow(() -> {
            DefParameter parameter = DefParameter.class.getDeclaredConstructor().newInstance();
            assertNotNull(parameter);
        }, "DefParameter 应该有无参构造器");

        assertDoesNotThrow(() -> {
            DefTenant tenant = DefTenant.class.getDeclaredConstructor().newInstance();
            assertNotNull(tenant);
        }, "DefTenant 应该有无参构造器");
    }

    /**
     * Verify that the no-argument constructor is public or at least accessible
     */
    @Test
    @DisplayName("验证无参构造器的可访问性")
    void testNoArgsConstructorAccessibility() {
        Class<?>[] classes = {
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
        };

        for (Class<?> clazz : classes) {
            try {
                java.lang.reflect.Constructor<?> constructor = clazz.getDeclaredConstructor();

                // Check if constructor exists (it should at this point)
                assertNotNull(constructor,
                    String.format("类 %s 应该有无参构造器", clazz.getSimpleName()));

                // The constructor should be accessible (either public or package-private)
                // We don't require it to be public, just accessible
                assertTrue(java.lang.reflect.Modifier.isPublic(constructor.getModifiers()) ||
                          java.lang.reflect.Modifier.isProtected(constructor.getModifiers()),
                    String.format("类 %s 的无参构造器应该是可访问的", clazz.getSimpleName()));

            } catch (NoSuchMethodException e) {
                fail(String.format("类 %s 缺少无参构造器", clazz.getSimpleName()));
            }
        }
    }
}
