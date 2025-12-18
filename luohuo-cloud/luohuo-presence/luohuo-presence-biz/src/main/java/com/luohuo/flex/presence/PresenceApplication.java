package com.luohuo.flex.presence;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 用户在线状态服务启动类
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@EnableDiscoveryClient
@EnableScheduling
@SpringBootApplication(scanBasePackages = {"com.luohuo.flex.presence", "com.luohuo.basic"})
public class PresenceApplication {

    public static void main(String[] args) {
        SpringApplication.run(PresenceApplication.class, args);
    }

}