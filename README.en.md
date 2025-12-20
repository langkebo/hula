<p align="center">
  <img width="350px" height="150px" src="preview/hula.png" />
</p>

<p align="center">An instant messaging system server built with SpringCloud, SpringBoot3, Netty, MyBatis-Plus and RocketMQ</p>

<div align="center">
  <img src="https://img.shields.io/badge/Spring_Cloud-2024-blue?logo=springcloud&logoColor=white">
  <img src="https://img.shields.io/badge/spring-boot3-brightgreen?logo=spring">
  <img src="https://img.shields.io/badge/Netty-343434?logo=netty&logoColor=white">
  <img src="https://img.shields.io/badge/MyBatis--Plus-00A1E9?logo=mybatis&logoColor=white">
  <img src="https://img.shields.io/badge/RocketMQ-D77310?logo=apacherocketmq&logoColor=white">
  <img src="https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white">
  <img src="https://img.shields.io/badge/MySQL-4479A1?logo=mysql&logoColor=white">
  <img src="https://img.shields.io/badge/WebSocket-010101?logo=websocket&logoColor=white">
  <img src="https://img.shields.io/badge/Java21-FF0000?logo=openjdk&logoColor=white">
  <img src="https://img.shields.io/badge/Maven-C71A36?logo=apachemaven&logoColor=white">
</div>

<p align="center">
  gitee：<a href="https://gitee.com/HulaSpark/HuLa-Server/stargazers"><img src="https://gitee.com/HulaSpark/HuLa-Server/badge/star.svg?theme=gvp" alt="star"></a>
  github：<a href="https://github.com/langkebo/hula/stargazers"><img src="https://img.shields.io/github/stars/langkebo/hula" alt="star"></a>
  gitcode：<a href="https://gitcode.com/HuLaSpark/HuLa-Server"><img src="https://gitcode.com/HuLaSpark/HuLa-Server/star/badge.svg" alt="star"></a>
</p>
<p align="center">
  WeChat: <img src="https://img.shields.io/badge/cy2439646234-07C160?logo=wechat&logoColor=fff">
</p>

<p align="center">
  🖥️ Client：<a href="https://github.com/langkebo/hula">github HuLa-Server</a> | <a href="https://gitee.com/HulaSpark/HuLa-Server">gitee HuLa-Server</a>
</p>

<p align="center">English | <a href="README.md">中文</a></p>

## 🚀 Quick Deployment (Ubuntu)

Simply download the source code and run the one-click deployment script:

```bash
git clone https://github.com/langkebo/hula.git
cd hula
bash deploy.sh
```

The script will automatically:
1. Install Docker, JDK 21, Maven and other dependencies
2. Compile the project source code
3. Start MySQL, Redis, Nacos, RocketMQ and other infrastructure
4. Start all application services

📖 **Detailed Documentation**: [Comprehensive Deployment Guide](docs/COMPREHENSIVE_DEPLOYMENT_GUIDE.md) - Includes troubleshooting, production configuration and more

## Project Introduction

HuLa-Server is a high-performance instant messaging system server built with SpringCloud, SpringBoot3, Netty, MyBatis-Plus and RocketMQ. It adopts a microservice architecture design, providing high-performance real-time communication capabilities, supporting core features such as private chat, group chat, and message push. The system has high scalability and reliability, suitable for various instant messaging scenarios.

## Core Advantages

- **Modular & High Cohesion**: Services are split into independent modules by function (gateway, authentication, IM, ws, base, system, presence, etc.), clearly isolated through <modules>, reducing coupling and improving development and maintenance efficiency.

- **Elastic Scaling**: WebFlux asynchronous architecture, built on Spring Cloud 2024 & Spring Boot 3.x, supports dynamic scaling. For example, luohuo-gateway can handle high concurrent traffic by adding nodes.

- **Unified Technology Stack Management**: luohuo-dependencies-parent centrally manages dependency versions, avoiding conflicts and improving collaboration efficiency.

## Technology Stack

- **Redis**: High-performance in-memory database for storing user session information, message cache, and other data, providing high-speed data access capabilities.

- **MySQL**: Reliable relational database for storing user information, message records, and other persistent data.

- **Netty**: Reactor threading model, high concurrent connection management, zero-copy optimization, supporting real-time message push.

- **RocketMQ**: High-performance message middleware, key to decoupling between services, implementing transaction message guarantee and sequential consumption in IM scenarios.

## Full-chain Distributed Capabilities

- **Gateway Layer**: luohuo-gateway implements routing authentication, supports OAuth2.0 security authentication, SA-Token permission framework + XSS filtering (luohuo-xss-starter) to ensure system security.

- **Communication Layer**: WebFlux + Netty asynchronous model, based on Reactor reactive programming model, fingerprint-level mapping of user online status, low-latency real-time message push.

- **Data Layer**: MyBatis-Plus + Dynamic Datasource supports multi-tenant database sharding.



## 🏗️ System Architecture

### 🚪 luohuo-gateway - Gateway Service
🔐 API Gateway | 🛡️ Security Protection | 🔄 Service Routing
- **Route Forwarding:** Intelligent routing to backend microservices
- **Unified Authentication:** JWT token verification and permission checking
- **Service Discovery:** Integrated with Nacos for dynamic service discovery
- **Traffic Control:** Rate limiting, circuit breaking, degradation protection
- **Security Filtering:** XSS protection, SQL injection protection
- **Logging:** Request logs, audit logs

### 🏗️ luohuo-base - Base Service
🏢 Tenant Management | 👥 Organization Structure | 🔧 Resource Center
- **Multi-tenant Architecture:** Supports multi-tenant data isolation
- **Organization Management:** Department, position, level management
- **Role Permissions:** RBAC permission model, fine-grained control
- **Application Module:** Unified application management platform

### 🔐 luohuo-oauth - Authentication Service
- **Multiple Login Methods:** Account password, SMS verification, email, QR code login
- **Dynamic QR Code:** Real-time generation of QR codes for scan login
- **Token Issuance:** Token, RefreshToken generation
- **Session Management:** Distributed session storage and verification
- **Permission Control:** Fine-grained permission management based on roles

### 💬 luohuo-im - IM Business Service
👥 Instant Messaging | 🏘️ Group Management | 💾 Message Storage
- **Message Management:** Private/group message storage and forwarding
- **Group Management:** Create groups, member management, permission control
- **Friend Relations:** Friend adding, deletion, blacklist management
- **Session Management:** Session list, pinning, message status

### 📡 luohuo-presence - Online Status Service
🟢 Status Tracking | 📊 Real-time Statistics | 🔔 Status Push
- **User Status:** Real-time tracking of online/offline status
- **Group Statistics:** Group member online status statistics

### 📶 luohuo-ws - WebSocket Service
🔗 Long Connection Management | 🚀 Real-time Push | 📞 Audio/Video Calls
- **Connection Management:** Establish and maintain fingerprint-level session mapping, automatic reconnection on crash
- **WebFlux Async Architecture:** Based on Netty, improving concurrent performance
- **Message Routing:** Intelligent message routing to target clients, combined with fingerprint mapping to solve message storms
- **P2P Calls, SRS Direct:** WebRTC one-on-one audio/video calls

### ⚙️ luohuo-system - Backend Service
🖥️ System Management | 📈 Data Statistics | 🔍 Monitoring & Audit
- **System Configuration:** IM system parameter configuration management
- **User Management:** User information maintenance, ban/unban
- **Data Statistics:** User activity, message volume statistics
- **System Monitoring:** Service health status monitoring
- **Content Audit:** Message content security audit filtering

## 📊 Message Execution Flow Steps

1. **Client sends message to gateway**
2. **Gateway routes to corresponding IM service**
3. **IM service persists the message**
4. **Calls IM internal PushService for message distribution**
5. **PushService queries routing table to get target user's WS node**
6. **Gets node-device-user mapping relationship**
7. **Directly distributes to each WS node's dedicated topic**
8. **Target WS node consumes distributed topic messages**
9. **Looks up local session mapping table**
10. **Pushes message to specific client**
11. **Client returns ACK confirmation**
12. **Updates message status to delivered**
![messageFlow.png](preview/messageFlow.png)

## 🌐 Performance Comparison (WS Service)
| Metric | Broadcast Mode | Precise Routing Mode | Improvement | Performance Indicator | Description |
|:--- |:---:|:---:|---:|---:|---:|
| **Network Messages** | O(N) | O(k) | 10-100x | - | |
| **CPU Consumption** | High | Low | 5-20x | CPU<70% under high concurrency | |
| **Memory Usage** | All nodes cache | Target node only | 3-10x | <50KB per connection | |
| **Latency** | Unstable | Stable low latency | 2-5x | Average <50ms | |

## 🚀 System Scalability - Linear Scaling Capability
- **User Growth:** Adding users doesn't increase the complexity of a single message
- **Node Expansion:** Adding nodes doesn't increase the push cost of a single message
- **Traffic Growth:** System throughput grows linearly with the number of nodes

## Client Preview

![img.png](preview/img.png)

![img_1.png](preview/img_1.png)

![img_2.png](preview/img_2.png)

![img_3.png](preview/img_3.png)

<div style="padding: 28px; display: inline-block;">
  <img src="preview/img_4.png" alt="img_4.png" style="border-radius: 8px; display: block;"  />
</div>

<div style="padding: 28px; display: inline-block;">
  <img src="preview/img_5.png" alt="img_5.png" style="border-radius: 8px; display: block;"  />
</div>

<div style="padding: 28px; display: inline-block;">
  <img src="preview/img_6.png" alt="img_6.png" style="border-radius: 8px; display: block;"  />
</div>

<div style="padding: 28px; display: inline-block;">
  <img src="preview/img_7.png" alt="img_7.png" style="border-radius: 8px; display: block;"  />
</div>

<div style="padding: 28px; display: inline-block;">
  <img src="preview/img_8.png" alt="img_8.png" style="border-radius: 8px; display: block;"  />
</div>

## Core Features

- Instant Messaging: Supports basic communication functions such as private chat, group chat, and message push
- Message Management: Supports message storage, history query, message recall, and other functions
- User System: Provides user registration, login, personal information management, and other functions
- Group Management: Supports group creation, member management, group announcements, and other functions
- Friend System: Supports friend adding, deletion, grouping, and other functions
- Message Notification: Supports offline messages, system notifications, and other functions
- Moments: Supports moments posting, liking, commenting, sharing, and other functions

Under continuous development...

## Disclaimer

1. This project is provided as an open-source project, and the developer does not provide any express or implied warranties for the functionality, security, or suitability of the software within the scope permitted by law
2. Users expressly understand and agree that the use of this software is entirely at their own risk, and the software is provided on an "as is" and "as available" basis. The developer provides no warranties of any kind, whether express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, and non-infringement
3. In no event shall the developer or its suppliers be liable for any direct, indirect, incidental, special, punitive, or consequential damages, including but not limited to loss of profits, business interruption, personal information leakage, or other commercial damages or losses arising from the use of this software
4. All users who conduct secondary development on this project must commit to using this software for legal purposes and are responsible for complying with local laws and regulations
5. The developer reserves the right to modify the software's features or characteristics, as well as any part of this disclaimer at any time, and these modifications may be reflected in software updates

**The final interpretation right of this disclaimer belongs to the developer**

## Sponsor HuLa
If you find HuLa helpful, welcome to sponsor HuLa. Your support is our motivation to keep moving forward

<div style="display: flex;">
<img src="preview/zs.jpg" width="260" height="280" alt="Sponsor QR Code" style="border-radius: 12px;" />

<img src="preview/zfb.png" width="260" height="280" alt="Sponsor QR Code" style="border-radius: 12px; margin-left: 40px" />
</div>

## 💬 Join the Community

<div align="center">
  <h3>🤝 HuLa Community Discussion Group</h3>
  <p><em>Communicate and discuss with developers and users, get the latest news and technical support</em></p>

  <div style="display: flex; justify-content: center; gap: 20px;">
    <img src="preview/wx.png" width="260" height="340" alt="WeChat Group QR Code">
    <img src="preview/qq.jpg" width="260" height="340" alt="QQ Group QR Code">
  </div>
</div>

## 🙏 Thanks to Sponsors

<div align="center">
  <h3>Contributors Honor List</h3>
  <p><em>Thanks to the following friends for their generous support of the HuLa project!</em></p>
</div>

### 💎 Diamond Sponsors (¥1000+)
| 💝 Date | 👤 Sponsor | 💰 Amount | 🏷️ Platform |
|---------|----------|--------|---------|
| 2025-09-12 | **Zhai Ke** | `¥1688` | ![WeChat](https://img.shields.io/badge/WeChat-07C160?style=flat&logo=wechat&logoColor=white) |

### 🏆 Gold Sponsors (¥100+)
| 💝 Date | 👤 Sponsor | 💰 Amount | 🏷️ Platform |
|---------|----------|--------|---------|
| 2025-09-03 | **Zhu Huo** | `¥500` | ![WeChat](https://img.shields.io/badge/WeChat-07C160?style=flat&logo=wechat&logoColor=white) |
| 2025-09-05 | **Orion** | `¥200` | ![WeChat](https://img.shields.io/badge/WeChat-07C160?style=flat&logo=wechat&logoColor=white) |
| 2025-08-26 | **Tang Yong** | `¥200` | ![WeChat](https://img.shields.io/badge/WeChat-07C160?style=flat&logo=wechat&logoColor=white) |
| 2025-04-25 | **Shangguan Junbin** | `¥200` | ![WeChat](https://img.shields.io/badge/WeChat-07C160?style=flat&logo=wechat&logoColor=white) |
| 2025-05-27 | **Lin'an Jushi** | `¥188` | ![WeChat](https://img.shields.io/badge/WeChat-07C160?style=flat&logo=wechat&logoColor=white) |
| 2025-04-20 | **Jiang Xing (Simon)** | `¥188` | ![WeChat](https://img.shields.io/badge/WeChat-07C160?style=flat&logo=wechat&logoColor=white) |
| 2025-02-17 | **He Shuo** | `¥168` | ![Alipay](https://img.shields.io/badge/Alipay-1677FF?style=flat&logo=alipay&logoColor=white) |
| 2025-08-13 | **zhongjing** | `¥100` | ![WeChat](https://img.shields.io/badge/WeChat-07C160?style=flat&logo=wechat&logoColor=white) |
| 2025-07-15 | **Pink Rabbit** | `¥100` | ![WeChat](https://img.shields.io/badge/WeChat-07C160?style=flat&logo=wechat&logoColor=white) |
| 2025-02-8 | **Boom....** | `¥100` | ![WeChat](https://img.shields.io/badge/WeChat-07C160?style=flat&logo=wechat&logoColor=white) |

### 🥈 Silver Sponsors (¥50-99)
| 💝 Date | 👤 Sponsor | 💰 Amount | 🏷️ Platform |
|---------|----------|--------|---------|
| 2025-06-26 | **m udDy🐖** | `¥88` | ![WeChat](https://img.shields.io/badge/WeChat-07C160?style=flat&logo=wechat&logoColor=white) |
| 2025-05-09 | **Hesitation leads to defeat** | `¥88` | ![WeChat](https://img.shields.io/badge/WeChat-07C160?style=flat&logo=wechat&logoColor=white) |
| 2025-04-01 | **Mo** | `¥88.88` | ![WeChat](https://img.shields.io/badge/WeChat-07C160?style=flat&logo=wechat&logoColor=white) |
| 2025-02-8 | **Deng Wei** | `¥88` | ![WeChat](https://img.shields.io/badge/WeChat-07C160?style=flat&logo=wechat&logoColor=white) |
| 2025-02-7 | **dennis** | `¥80` | ![Gitee](https://img.shields.io/badge/Gitee-C71D23?style=flat&logo=gitee&logoColor=white) |
| 2025-02-6 | **Xiao Er** | `¥62` | ![WeChat](https://img.shields.io/badge/WeChat-07C160?style=flat&logo=wechat&logoColor=white) |
| 2025-05-15 | **Gu Hong Ying** | `¥56` | ![WeChat](https://img.shields.io/badge/WeChat-07C160?style=flat&logo=wechat&logoColor=white) |

### 🥉 Bronze Sponsors (¥20-49)
| 💝 Date | 👤 Sponsor | 💰 Amount | 🏷️ Platform |
|---------|----------|--------|---------|
| 2025-08-12 | ***Chi** | `¥20` | ![Alipay](https://img.shields.io/badge/Alipay-1677FF?style=flat&logo=alipay&logoColor=white) |
| 2025-06-03 | **Hong Liu** | `¥20` | ![WeChat](https://img.shields.io/badge/WeChat-07C160?style=flat&logo=wechat&logoColor=white) |
| 2025-05-27 | **Liu Qicheng** | `¥20` | ![WeChat](https://img.shields.io/badge/WeChat-07C160?style=flat&logo=wechat&logoColor=white) |
| 2025-05-20 | **Anonymous Sponsor** | `¥20` | ![WeChat](https://img.shields.io/badge/WeChat-07C160?style=flat&logo=wechat&logoColor=white) |

<div align="center">
  <br>

> 📝 **Note**
> This list is manually updated. If you have sponsored but are not shown in the list, please contact us:
> 🐛 [GitHub Issue](https://github.com/langkebo/hula/issues) | 📧 Email: `2439646234@qq.com` | 💬 WeChat: `cy2439646234`

  <br>
</div>

---

## 📄 Open Source License

<div align="center">
  <h3>⚖️ License Information</h3>

  <p>
    <a href="https://app.fossa.com/projects/git%2Bgithub.com%2Flangkebo%2Fhula?ref=badge_large">
      <img src="https://app.fossa.com/api/projects/git%2Bgithub.com%2Flangkebo%2Fhula.svg?type=large" alt="FOSSA Status" style="max-width: 100%; border-radius: 8px;">
    </a>
  </p>

  <p><em>This project follows the open source license agreement. Please check the license report above for details</em></p>
</div>

---

<div align="center">
  <h3>🌟 Thanks for Your Attention</h3>
  <p>
    <em>If you find HuLa valuable, please give us a ⭐ Star, it's the greatest encouragement for us!</em>
  </p>
  <p>
    <strong>Let's build a better instant messaging experience together 🚀</strong>
  </p>
</div>
