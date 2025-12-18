package com.luohuo.flex.userinfo.resolver;

import cn.hutool.core.util.BooleanUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.MethodParameter;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import com.luohuo.basic.annotation.user.LoginUser;
import com.luohuo.basic.base.R;
import com.luohuo.basic.context.ContextUtil;
import com.luohuo.basic.utils.SpringUtils;
import com.luohuo.flex.model.entity.system.SysUser;
import com.luohuo.flex.model.vo.result.UserQuery;
import com.luohuo.flex.userinfo.service.UserResolverService;

/**
 * Token转化SysUser
 *
 * @author 乾乾
 * @date 2018/12/21
 */
@Slf4j
public class ContextArgumentResolver implements HandlerMethodArgumentResolver {

    private UserResolverService userResolverService;

    /**
     * 入参筛选
     *
     * @param mp 参数集合
     * @return 格式化后的参数
     */
    @Override
    public boolean supportsParameter(MethodParameter mp) {
        return mp.hasParameterAnnotation(LoginUser.class) && mp.getParameterType().equals(SysUser.class);
    }

    private UserResolverService get() {
        UserResolverService urService;
        if (userResolverService == null) {
            urService = SpringUtils.getBean(UserResolverService.class);
            userResolverService = urService;
        } else {
            urService = userResolverService;
        }
        return urService;
    }

    /**
     * @param mp                    入参集合
     * @param modelAndViewContainer model 和 view
     * @param nativeWebRequest      web相关
     * @param webDataBinderFactory  入参解析
     * @return 包装对象
     */
    @Override
    public Object resolveArgument(@NonNull MethodParameter mp,
                                  ModelAndViewContainer modelAndViewContainer,
                                  @NonNull NativeWebRequest nativeWebRequest,
                                  WebDataBinderFactory webDataBinderFactory) {
        Long userId = ContextUtil.getUserId();
        Long uid = ContextUtil.getUid();
        //以下代码为 根据 @LoginUser 注解来注入 SysUser 对象
        SysUser user = createSysUserWithReflection(uid, userId);
		// 如果非后台系统，那么直接返回用户的双id
        if (userId == null || "2".equals(ContextUtil.getSystemType())) {
            return user;
        }
        try {
            LoginUser loginUser = mp.getParameterAnnotation(LoginUser.class);
            if (loginUser == null) {
                return user;
            }

            boolean isQuery = BooleanUtil.or(loginUser.isFull(), loginUser.isEmployee(), loginUser.isPosition(), loginUser.isOrg(),
                    loginUser.isRoles(), loginUser.isResource(), loginUser.isUser());
            if (isQuery) {
                UserResolverService urService = get();

                UserQuery query = new UserQuery()
                        .setUserId(userId)
                        .setEmployeeId(uid)
                        .setFull(loginUser.isFull())
                        .setOrg(loginUser.isOrg())
                        .setCurrentOrg(loginUser.isMainOrg())
                        .setUser(loginUser.isUser())
                        .setPosition(loginUser.isPosition())
                        .setRoles(loginUser.isRoles())
                        .setResource(loginUser.isResource())
                        .setEmployee(loginUser.isEmployee());

                R<SysUser> result = urService.getById(query);
                if (result.getsuccess() && result.getData() != null) {
                    return result.getData();
                }
            }
        } catch (Exception e) {
            System.err.println("注入登录人信息时，发生异常. --> " + user + ", " + e.getMessage());
        }
        return user;
    }

    /**
     * 使用反射创建SysUser实例（避免缺少Lombok注解的问题）
     */
    private SysUser createSysUserWithReflection(Long uid, Long userId) {
        try {
            SysUser user = new SysUser();
            // 使用反射设置字段
            user.getClass().getDeclaredField("id").setAccessible(true);
            user.getClass().getDeclaredField("id").set(user, userId);

            user.getClass().getDeclaredField("employeeId").setAccessible(true);
            user.getClass().getDeclaredField("employeeId").set(user, uid);

            return user;
        } catch (Exception e) {
            throw new RuntimeException("创建SysUser失败", e);
        }
    }

}
