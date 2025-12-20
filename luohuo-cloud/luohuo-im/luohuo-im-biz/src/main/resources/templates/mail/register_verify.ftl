<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>注册验证 - Hula-IM</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background-color: #007bff;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 28px;
            font-weight: 500;
        }
        .content {
            padding: 40px;
        }
        .welcome {
            text-align: center;
            margin-bottom: 30px;
        }
        .welcome h2 {
            color: #333333;
            font-size: 24px;
            margin-bottom: 10px;
        }
        .welcome p {
            color: #666666;
            font-size: 16px;
            margin: 0;
        }
        .verify-button {
            display: block;
            width: 200px;
            margin: 30px auto;
            padding: 12px 0;
            background-color: #007bff;
            color: #ffffff;
            text-decoration: none;
            border-radius: 5px;
            text-align: center;
            font-size: 16px;
            font-weight: 500;
            transition: background-color 0.3s;
        }
        .verify-button:hover {
            background-color: #0056b3;
        }
        .verify-link {
            text-align: center;
            margin: 20px 0;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 5px;
        }
        .verify-link p {
            color: #666666;
            font-size: 14px;
            margin: 5px 0;
        }
        .verify-link code {
            color: #007bff;
            background-color: #e9ecef;
            padding: 2px 5px;
            border-radius: 3px;
            word-break: break-all;
        }
        .footer {
            padding: 30px;
            background-color: #f8f9fa;
            text-align: center;
        }
        .footer p {
            color: #999999;
            font-size: 12px;
            margin: 5px 0;
        }
        .footer a {
            color: #007bff;
            text-decoration: none;
        }
        .footer a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Hula-IM</h1>
        </div>

        <div class="content">
            <div class="welcome">
                <h2>欢迎注册Hula-IM！</h2>
                <p>感谢您选择我们的即时通讯服务</p>
            </div>

            <p style="text-align: center; color: #333; font-size: 16px;">
                请点击下方按钮验证您的邮箱地址，以完成注册：
            </p>

            <a href="${verifyUrl}" class="verify-button">验证邮箱</a>

            <div class="verify-link">
                <p>如果按钮无法点击，请复制以下链接到浏览器地址栏：</p>
                <p><code>${verifyUrl}</code></p>
            </div>

            <p style="text-align: center; color: #666; font-size: 14px;">
                该验证链接有效期为 <strong>24小时</strong>，请尽快完成验证。
            </p>
        </div>

        <div class="footer">
            <p>此邮件由系统自动发送，请勿回复</p>
            <p>如有疑问，请联系客服：<a href="mailto:656042408@qq.com">656042408@qq.com</a></p>
            <p>&copy; 2025 Hula-IM. All rights reserved.</p>
        </div>
    </div>
</body>
</html>