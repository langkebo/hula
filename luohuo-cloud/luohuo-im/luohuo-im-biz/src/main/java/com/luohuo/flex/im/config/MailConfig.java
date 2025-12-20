package com.luohuo.flex.im.config;

import freemarker.template.TemplateException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.ui.freemarker.FreeMarkerConfigurationFactory;

import java.io.IOException;
import java.util.Properties;

/**
 * 邮件配置
 *
 * @author HuLa
 * @since 2025-12-20
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
@ConfigurationProperties(prefix = "spring.mail")
public class MailConfig {

    private String host;
    private Integer port;
    private String username;
    private String password;
    private String protocol = "smtp";
    private Boolean auth = true;
    private Boolean starttls = true;
    private String from;

    /**
     * 配置邮件发送器
     */
    @Bean
    public JavaMailSender javaMailSender() {
        JavaMailSenderImpl mailSender = new JavaMailSenderImpl();

        // 基本配置
        mailSender.setHost(host);
        mailSender.setPort(port);
        mailSender.setUsername(username);
        mailSender.setPassword(password);
        mailSender.setProtocol(protocol);

        // 设置默认发件人
        if (from != null) {
            mailSender.setDefaultEncoding("UTF-8");
            Properties props = mailSender.getJavaMailProperties();
            props.put("mail.from", from);
        }

        // 编码设置
        mailSender.setDefaultEncoding("UTF-8");
        mailSender.setJavaMailProperties(getMailProperties());

        log.info("MailSender configured with host: {}, port: {}, username: {}", host, port, username);

        return mailSender;
    }

    /**
     * 配置邮件属性
     */
    private Properties getMailProperties() {
        Properties props = new Properties();

        // 认证配置
        props.put("mail.smtp.auth", auth);
        props.put("mail.smtp.starttls.enable", starttls);

        // SSL配置（如果需要）
        if (port == 465) {
            props.put("mail.smtp.ssl.enable", true);
            props.put("mail.smtp.socketFactory.port", port);
            props.put("mail.smtp.socketFactory.class", "javax.net.ssl.SSLSocketFactory");
        }

        // 连接超时设置
        props.put("mail.smtp.connectiontimeout", "30000");
        props.put("mail.smtp.timeout", "30000");
        props.put("mail.smtp.writetimeout", "30000");

        // 调试模式（开发环境）
        if (log.isDebugEnabled()) {
            props.put("mail.debug", "true");
        }

        return props;
    }

    /**
     * 配置FreeMarker模板引擎（用于邮件模板）
     */
    @Bean
    public freemarker.template.Configuration freemarkerConfiguration() throws IOException, TemplateException {
        FreeMarkerConfigurationFactory factory = new FreeMarkerConfigurationFactory();
        factory.setTemplateLoaderPath("classpath:/templates/mail/");
        factory.setDefaultEncoding("UTF-8");
        freemarker.template.Configuration configuration = factory.createConfiguration();

        // 配置模板设置
        configuration.setNumberFormat("0.######");
        configuration.setClassicCompatible(true);

        log.info("FreeMarker configuration initialized for email templates");

        return configuration;
    }

    // Getters and Setters
    public String getHost() {
        return host;
    }

    public void setHost(String host) {
        this.host = host;
    }

    public Integer getPort() {
        return port;
    }

    public void setPort(Integer port) {
        this.port = port;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getProtocol() {
        return protocol;
    }

    public void setProtocol(String protocol) {
        this.protocol = protocol;
    }

    public Boolean getAuth() {
        return auth;
    }

    public void setAuth(Boolean auth) {
        this.auth = auth;
    }

    public Boolean getStarttls() {
        return starttls;
    }

    public void setStarttls(Boolean starttls) {
        this.starttls = starttls;
    }

    public String getFrom() {
        return from;
    }

    public void setFrom(String from) {
        this.from = from;
    }
}