package com.luohuo.flex.im.controller;

import com.luohuo.flex.im.service.mail.MailService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * 邮件发送控制器
 *
 * @author HuLa
 * @since 2025-12-20
 */
@Slf4j
@RestController
@RequestMapping("/api/mail")
@RequiredArgsConstructor
@Tag(name = "邮件发送", description = "邮件发送相关接口")
public class MailController {

    private final MailService mailService;

    /**
     * 发送测试邮件
     */
    @PostMapping("/test")
    @Operation(summary = "发送测试邮件")
    public String sendTestMail(
            @Parameter(description = "收件人邮箱", required = true)
            @RequestParam String toEmail) {

        try {
            String subject = "Hula-IM 测试邮件";
            String content = """
                <h2>这是一封测试邮件</h2>
                <p>恭喜！Hula-IM邮件服务配置成功！</p>
                <p>系统时间：<span style="color: blue;">%s</span></p>
                <p>祝您使用愉快！</p>
                """.formatted(java.time.LocalDateTime.now());

            mailService.sendHtmlMail(toEmail, subject, content);

            log.info("测试邮件发送成功：to={}", toEmail);
            return "测试邮件发送成功！";
        } catch (Exception e) {
            log.error("测试邮件发送失败：to={}", toEmail, e);
            return "测试邮件发送失败：" + e.getMessage();
        }
    }

    /**
     * 发送注册验证邮件
     */
    @PostMapping("/register-verify")
    @Operation(summary = "发送注册验证邮件")
    public String sendRegisterVerifyMail(
            @Parameter(description = "收件人邮箱", required = true)
            @RequestParam String toEmail,
            @Parameter(description = "验证链接", required = true)
            @RequestParam String verifyUrl) {

        try {
            // 准备模板数据
            Map<String, Object> model = new HashMap<>();
            model.put("verifyUrl", verifyUrl);
            model.put("currentTime", java.time.LocalDateTime.now());

            String subject = "欢迎注册Hula-IM - 请验证您的邮箱";

            // 异步发送邮件
            CompletableFuture<Void> future = mailService.sendTemplateMailAsync(
                    toEmail,
                    subject,
                    "register_verify",
                    model
            );

            future.whenComplete((result, throwable) -> {
                if (throwable != null) {
                    log.error("注册验证邮件发送失败：to={}", toEmail, throwable);
                } else {
                    log.info("注册验证邮件发送成功：to={}", toEmail);
                }
            });

            return "注册验证邮件已发送，请查收！";
        } catch (Exception e) {
            log.error("注册验证邮件发送失败：to={}", toEmail, e);
            return "注册验证邮件发送失败：" + e.getMessage();
        }
    }

    /**
     * 测试邮件服务器连接
     */
    @GetMapping("/test-connection")
    @Operation(summary = "测试邮件服务器连接")
    public Map<String, Object> testConnection() {
        Map<String, Object> result = new HashMap<>();

        try {
            boolean isConnected = mailService.testConnection();
            result.put("success", isConnected);
            result.put("message", isConnected ? "邮件服务器连接成功" : "邮件服务器连接失败");

            if (isConnected) {
                result.put("serverInfo", Map.of(
                        "host", "smtp.qq.com",
                        "port", 587,
                        "username", "656042408@qq.com",
                        "protocol", "SMTP"
                ));
            }
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "连接测试异常：" + e.getMessage());
            log.error("邮件服务器连接测试异常", e);
        }

        return result;
    }

    /**
     * 发送简单文本邮件
     */
    @PostMapping("/simple")
    @Operation(summary = "发送简单文本邮件")
    public String sendSimpleMail(
            @Parameter(description = "收件人邮箱", required = true)
            @RequestParam String toEmail,
            @Parameter(description = "邮件主题", required = true)
            @RequestParam String subject,
            @Parameter(description = "邮件内容", required = true)
            @RequestParam String content) {

        try {
            mailService.sendSimpleMail(toEmail, subject, content);
            return "邮件发送成功！";
        } catch (Exception e) {
            log.error("邮件发送失败：to={}", toEmail, e);
            return "邮件发送失败：" + e.getMessage();
        }
    }

    /**
     * 发送系统通知邮件
     */
    @PostMapping("/notice")
    @Operation(summary = "发送系统通知邮件")
    public String sendNoticeMail(
            @Parameter(description = "收件人邮箱", required = true)
            @RequestParam String toEmail,
            @Parameter(description = "通知标题", required = true)
            @RequestParam String title,
            @Parameter(description = "通知内容", required = true)
            @RequestParam String noticeContent) {

        try {
            String subject = "Hula-IM系统通知 - " + title;

            String content = String.format("""
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>系统通知</title>
                </head>
                <body style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #333;">系统通知</h2>
                    <p>尊敬的用户：</p>
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        %s
                    </div>
                    <p>如有任何疑问，请及时联系我们。</p>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                    <p style="color: #666; font-size: 12px;">
                        此邮件由系统自动发送，请勿回复。<br>
                        Hula-IM团队<br>
                        客服邮箱：656042408@qq.com
                    </p>
                </body>
                </html>
                """, noticeContent.replace("\n", "<br>"));

            mailService.sendHtmlMail(toEmail, subject, content);
            return "系统通知邮件发送成功！";
        } catch (Exception e) {
            log.error("系统通知邮件发送失败：to={}", toEmail, e);
            return "系统通知邮件发送失败：" + e.getMessage();
        }
    }
}