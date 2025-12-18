UPDATE config_info SET content = 'luohuo:
  mysql: &db-mysql
    filters: stat,wall
    db-type: mysql   
    validation-query: SELECT \'x\'  
    username: \'root\'
    password: \'h5E45LIXEhmcTw2dRMCcKAYvuX6ekhqu\'
    driverClassName: com.mysql.cj.jdbc.Driver
    url: jdbc:mysql://host.docker.internal:13306/luohuo_dev?serverTimezone=Asia/Shanghai&characterEncoding=utf8&useUnicode=true&useSSL=false&autoReconnect=true&zeroDateTimeBehavior=convertToNull&allowMultiQueries=true&nullCatalogMeansCurrent=true&allowPublicKeyRetrieval=true
  database: 
    multiTenantType: NONE
    isDataScope: true
    isBlockAttack: false
    isIllegalSql: false
    isSeata: false
    p6spy: false
    maxLimit: -1
    overflow: true
    optimizeJoin: true
    id-type: DEFAULT
    hutool-id:
      workerId: 0
      dataCenterId: 0
    default-id:
      time-bits: 41
      worker-bits: 13
      seq-bits: 9
      epochStr: \'2025-02-24\'
      boost-power: 3
      padding-factor: 50

spring:
  autoconfigure:
    exclude: org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration
  datasource:
    url: jdbc:mysql://host.docker.internal:13306/luohuo_dev?serverTimezone=Asia/Shanghai&characterEncoding=utf8&useUnicode=true&useSSL=false&autoReconnect=true&zeroDateTimeBehavior=convertToNull&allowMultiQueries=true&nullCatalogMeansCurrent=true&allowPublicKeyRetrieval=true
    username: \'root\'
    password: \'h5E45LIXEhmcTw2dRMCcKAYvuX6ekhqu\'
    driver-class-name: com.mysql.cj.jdbc.Driver
    dynamic:
      enabled: false
    druid:
      enable: true
      <<: *db-mysql
      initialSize: 10
      minIdle: 10
      maxActive: 200
      max-wait: 60000
      pool-prepared-statements: true
      max-pool-prepared-statement-per-connection-size: 20
      test-on-borrow: false
      test-on-return: false
      test-while-idle: false
      time-between-eviction-runs-millis: 60000
      min-evictable-idle-time-millis: 300000
      filter:
        wall:
          enabled: true
          config:
            strictSyntaxCheck: false
            commentAllow: true
            multiStatementAllow: true
            noneBaseStatementAllow: true
        slf4j:
          enabled: false
          statement-executable-sql-log-enable: true
      web-stat-filter:
        enabled: true
        url-pattern: /*
        exclusions: "*.js , *.gif ,*.jpg ,*.png ,*.css ,*.ico , /druid/*"
        session-stat-max-count: 1000
        profile-enable: true
        session-stat-enable: false
      stat-view-servlet:
        enabled: true
        url-pattern: /druid/*
        reset-enable: true
        login-username: \'\'
        login-password: \'\'
        allow: \'\'

mybatis-plus:
  mapper-locations:
    - classpath*:mapper**/**/**/*Mapper.xml
  typeAliasesPackage: com.luohuo.flex.*.entity;com.luohuo.basic.database.mybatis.typehandler
  typeEnumsPackage: com.luohuo.flex.*.enumeration
  global-config:
    db-config:
      id-type: INPUT
      insert-strategy: NOT_NULL
      update-strategy: NOT_NULL
      where-strategy: NOT_EMPTY
  configuration:
    map-underscore-to-camel-case: true
    cache-enabled: false
    jdbc-type-for-null: \'null\'
    default-enum-type-handler: com.luohuo.basic.database.mybatis.handlers.MybatisEnumTypeHandler
', md5 = '75f653ac3c9c80539583584421703ed4', gmt_modified = NOW() WHERE data_id = 'mysql.yml' AND group_id = 'DEFAULT_GROUP';
