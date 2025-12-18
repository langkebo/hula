# HuLa-Server Gateway Dockerfile
# 基于 Eclipse Temurin JDK 21 (推荐的生产环境JDK)

FROM eclipse-temurin:21-jre-alpine

LABEL maintainer="HuLa Team"
LABEL version="3.0.6"
LABEL description="HuLa-Server API Gateway"

# 设置时区
ENV TZ=Asia/Shanghai
RUN apk add --no-cache tzdata \
    && cp /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone \
    && apk del tzdata

# 创建应用目录
WORKDIR /app

# 创建非root用户
RUN addgroup -S hula && adduser -S hula -G hula

# 复制应用
ARG JAR_FILE=target/*.jar
COPY ${JAR_FILE} app.jar

# 设置权限
RUN chown -R hula:hula /app

# 切换到非root用户
USER hula

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:18760/actuator/health || exit 1

# JVM参数
ENV JAVA_OPTS="-Xms1600m -Xmx2048m -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -Djava.security.egd=file:/dev/./urandom"

# 暴露端口
EXPOSE 18760

# 启动命令
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
CMD ["--spring.profiles.active=docker"]
