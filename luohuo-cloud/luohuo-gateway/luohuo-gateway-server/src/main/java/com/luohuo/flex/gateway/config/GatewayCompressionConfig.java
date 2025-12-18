package com.luohuo.flex.gateway.config;

import org.springframework.boot.web.embedded.netty.NettyReactiveWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import reactor.netty.http.server.HttpServer;
import io.netty.channel.ChannelOption;
import io.netty.handler.codec.http.HttpContentCompressor;
import io.netty.handler.codec.http.HttpContentDecompressor;

import java.time.Duration;

/**
 * 网关压缩配置
 * 启用 GZIP 压缩减少传输量
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Configuration
public class GatewayCompressionConfig {

    @Bean
    public WebServerFactoryCustomizer<NettyReactiveWebServerFactory> compressionCustomizer() {
        return factory -> factory.addServerCustomizers(httpServer -> httpServer
            // 启用压缩
            .compress(true)
            // 设置连接超时
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, (int) Duration.ofSeconds(30).toMillis())
            // 设置 keep-alive
            .childOption(ChannelOption.SO_KEEPALIVE, true)
            // 设置 TCP_NODELAY
            .childOption(ChannelOption.TCP_NODELAY, true)
        );
    }
}
