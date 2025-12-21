# 临时禁用的源文件

这些文件由于缺少依赖导致编译错误，已被临时移出编译目录。

## 禁用原因

### 健康检查服务
- `SystemHealthService.java` - 缺少 spring-data-redis 和 spring-jdbc 依赖
- `HealthCheckEndpoint.java` - 依赖 SystemHealthService

## 修复建议

在 `pom.xml` 中添加以下依赖：

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-jdbc</artifactId>
</dependency>
<dependency>
    <groupId>co.elastic.clients</groupId>
    <artifactId>elasticsearch-java</artifactId>
</dependency>
```

## 恢复步骤

1. 添加上述依赖到 pom.xml
2. 将文件移回 `src/main/java/com/luohuo/flex/monitor/` 对应目录
