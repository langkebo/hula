package com.luohuo.flex.im.controller;

import com.luohuo.basic.base.R;
import com.luohuo.flex.im.api.PushService;
import com.luohuo.flex.im.api.PushStatistics;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

/**
 * 推送控制器
 *
 * @author HuLa
 */
@Slf4j
@RestController
@RequestMapping("/api/push")
@RequiredArgsConstructor
@Tag(name = "推送管理", description = "推送相关接口")
public class PushController {

    private final PushService pushService;

    @PostMapping("/user/{userId}")
    @Operation(summary = "推送消息给用户", description = "向指定用户推送推送通知")
    public R<Boolean> pushToUser(
            @Parameter(description = "用户ID", required = true) @PathVariable Long userId,
            @Parameter(description = "标题", required = true) @RequestParam String title,
            @Parameter(description = "内容", required = true) @RequestParam String content,
            @Parameter(description = "扩展信息") @RequestBody(required = false) Object extra) {

        boolean success = pushService.pushToUser(userId, title, content, extra);
        return R.success(success);
    }

    @PostMapping("/batch")
    @Operation(summary = "批量推送", description = "向多个用户批量推送消息")
    public R<Integer> pushToUsers(
            @Parameter(description = "用户ID列表", required = true) @RequestParam java.util.List<Long> userIds,
            @Parameter(description = "标题", required = true) @RequestParam String title,
            @Parameter(description = "内容", required = true) @RequestParam String content,
            @Parameter(description = "扩展信息") @RequestBody(required = false) Object extra) {

        int successCount = pushService.pushToUsers(userIds, title, content, extra);
        return R.success(successCount);
    }

    @PostMapping("/broadcast")
    @Operation(summary = "广播推送", description = "向所有用户广播推送消息")
    public R<Boolean> pushToAll(
            @Parameter(description = "标题", required = true) @RequestParam String title,
            @Parameter(description = "内容", required = true) @RequestParam String content,
            @Parameter(description = "扩展信息") @RequestBody(required = false) Object extra) {

        boolean success = pushService.pushToAll(title, content, extra);
        return R.success(success);
    }

    @PostMapping("/group/{groupId}")
    @Operation(summary = "群组推送", description = "向群组成员推送消息")
    public R<Integer> pushToGroup(
            @Parameter(description = "群组ID", required = true) @PathVariable Long groupId,
            @Parameter(description = "排除的用户ID") @RequestParam(required = false) Long excludeUserId,
            @Parameter(description = "标题", required = true) @RequestParam String title,
            @Parameter(description = "内容", required = true) @RequestParam String content,
            @Parameter(description = "扩展信息") @RequestBody(required = false) Object extra) {

        int successCount = pushService.pushToGroup(groupId, excludeUserId, title, content, extra);
        return R.success(successCount);
    }

    @PostMapping("/notification")
    @Operation(summary = "推送系统通知", description = "向用户推送系统通知")
    public R<Boolean> pushNotification(
            @Parameter(description = "用户ID", required = true) @RequestParam Long userId,
            @Parameter(description = "通知类型", required = true) @RequestParam String type,
            @Parameter(description = "内容", required = true) @RequestParam String content,
            @Parameter(description = "扩展信息") @RequestBody(required = false) Object extra) {

        boolean success = pushService.pushNotification(userId, type, content, extra);
        return R.success(success);
    }

    @GetMapping("/statistics")
    @Operation(summary = "获取推送统计", description = "获取指定时间范围内的推送统计信息")
    public R<PushStatistics> getStatistics(
            @Parameter(description = "开始时间戳") @RequestParam(required = false) Long startTime,
            @Parameter(description = "结束时间戳") @RequestParam(required = false) Long endTime) {

        PushStatistics statistics = pushService.getStatistics(startTime, endTime);
        return R.success(statistics);
    }
}