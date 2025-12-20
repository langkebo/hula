package com.luohuo.flex.im.service.mail;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.ui.freemarker.FreeMarkerTemplateUtils;
import org.springframework.web.servlet.view.freemarker.FreeMarkerConfigurer;

import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;

/**
 * 邮件服务
 *
 * @author HuLa
 * @since 2025-12-20
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MailService {

    private final JavaMailSender mailSender;
    private final FreeMarkerConfigurer freeMarkerConfigurer;
    private final Executor mailExecutor;

    /**
     * 发送简单文本邮件
     *
     * @param to      收件人邮箱
     * @param subject 邮件主题
     * @param content 邮件内容
     */
    public void sendSimpleMail(String to, String subject, String content) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true);

            helper.setFrom(mailSender.getDefaultEncoding());
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(content, true);

            mailSender.send(message);
            log.info("邮件发送成功：to={}, subject={}", to, subject);
        } catch (MessagingException e) {
            log.error("邮件发送失败：to={}, subject={}", to, subject, e);
            throw new RuntimeException("邮件发送失败", e);
        }
    }

    /**
     * 异步发送简单文本邮件
     *
     * @param to      收件人邮箱
     * @param subject 邮件主题
     * @param content 邮件内容
     * @return CompletableFuture
     */
    public CompletableFuture<Void> sendSimpleMailAsync(String to, String subject, String content) {
        return CompletableFuture.runAsync(() -> sendSimpleMail(to, subject, content), mailExecutor)
                .exceptionally(throwable -> {
                    log.error("异步邮件发送失败：to={}, subject={}", to, subject, throwable);
                    return null;
                });
    }

    /**
     * 使用模板发送邮件
     *
     * @param to           收件人邮箱
     * @param subject      邮件主题
     * @param templateName 模板名称（不含扩展名）
     * @param model        模板数据
     */
    public void sendTemplateMail(String to, String subject, String templateName, Map<String, Object> model) {
        try {
            // 获取模板内容
            String content = FreeMarkerTemplateUtils.processTemplateIntoString(
                    freeMarkerConfigurer.getConfiguration().getTemplate(templateName + ".ftl"),
                    model
            );

            // 发送邮件
            sendSimpleMail(to, subject, content);
            log.info("模板邮件发送成功：to={}, subject={}, template={}", to, subject, templateName);
        } catch (Exception e) {
            log.error("模板邮件发送失败：to={}, subject={}, template={}", to, subject, templateName, e);
            throw new RuntimeException("模板邮件发送失败", e);
        }
    }

    /**
     * 异步使用模板发送邮件
     *
     * @param to           收件人邮箱
     * @param subject      邮件主题
     * @param templateName 模板名称
     * @param model        模板数据
     * @return CompletableFuture
     */
    public CompletableFuture<Void> sendTemplateMailAsync(String to, String subject, String templateName, Map<String, Object> model) {
        return CompletableFuture.runAsync(() -> sendTemplateMail(to, subject, templateName, model), mailExecutor)
                .exceptionally(throwable -> {
                    log.error("异步模板邮件发送失败：to={}, subject={}, template={}", to, subject, templateName, throwable);
                    return null;
                });
    }

    /**
     * 发送HTML邮件
     *
     * @param to      收件人邮箱
     * @param subject 邮件主题
     * @param content HTML内容
     */
    public void sendHtmlMail(String to, String subject, String content) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(mailSender.getDefaultEncoding());
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(content, true); // true表示是HTML格式

            mailSender.send(message);
            log.info("HTML邮件发送成功：to={}, subject={}", to, subject);
        } catch (MessagingException e) {
            log.error("HTML邮件发送失败：to={}, subject={}", to, subject, e);
            throw new RuntimeException("HTML邮件发送失败", e);
        }
    }

    /**
     * 发送带附件的邮件
     *
     * @param to       收件人邮箱
     * @param subject  邮件主题
     * @param content  邮件内容
     * @param filename 附件文件名
     * @param bytes    附件内容
     */
    public void sendAttachmentMail(String to, String subject, String content, String filename, byte[] bytes) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(mailSender.getDefaultEncoding());
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(content, true);

            // 添加附件
            helper.addAttachment(filename, new jakarta.activation.DataSource() {
                @Override
                public java.io.InputStream getInputStream() throws java.io.IOException {
                    return new java.io.ByteArrayInputStream(bytes);
                }

                @Override
                public java.io.OutputStream getOutputStream() throws java.io.IOException {
                    throw new java.io.IOException("Read-only data");
                }

                @Override
                public String getContentType() {
                    return "application/octet-stream";
                }

                @Override
                public String getName() {
                    return filename;
                }
            });

            mailSender.send(message);
            log.info("带附件邮件发送成功：to={}, subject={}, attachment={}", to, subject, filename);
        } catch (MessagingException e) {
            log.error("带附件邮件发送失败：to={}, subject={}, attachment={}", to, subject, filename, e);
            throw new RuntimeException("带附件邮件发送失败", e);
        }
    }

    /**
     * 测试邮件连接
     *
     * @return 连接是否成功
     */
    public boolean testConnection() {
        try {
            mailSender.testConnection();
            log.info("邮件服务器连接测试成功");
            return true;
        } catch (Exception e) {
            log.error("邮件服务器连接测试失败", e);
            return false;
        }
    }
}