# 群晖API登录故障排查指南

## 诊断结果

根据诊断工具测试：
- ✅ API服务可用
- ✅ 网络连接正常
- ❌ **登录失败 - 错误码：407（账号访问被拒绝）**

## 错误407的可能原因

### 1. 密码包含特殊字符（最可能）
您的密码 `Fgl6JL#3` 包含特殊字符 `#`，可能导致API认证失败。

### 2. 账号被临时锁定
多次登录失败可能导致账号被临时锁定。

### 3. 账号启用了双重验证（2FA）
API不支持OAuth/OTP验证方式，需要禁用2FA。

### 4. 群晖安全设置限制
某些安全策略可能阻止非浏览器访问。

## 解决方案

### 方案1: 修改密码（推荐）

1. 登录群晖管理界面
2. 控制面板 > 用户 > 选择admin用户
3. 修改密码为不包含特殊字符的简单密码，例如：
   ```
   Synology123
   Nas2024!
   Admin@2024
   ```
4. 修改后更新 `.env` 文件：
   ```env
   SYNOLOGY_PASSWORD=新密码
   ```

### 方案2: 禁用双重验证

1. 登录群晖管理界面
2. 控制面板 > 用户高级设置 > 安全
3. 取消勾选"允许用户使用双重验证"
4. 移除已设置的Google Authenticator

### 方案3: 创建专用API账号

1. 控制面板 > 用户 > 新增
2. 创建新用户，例如 `api_user`
3. 设置简单密码
4. 分配FileStation权限
5. 更新 `.env` 使用新账号

### 方案4: 调整安全设置

1. 控制面板 > 安全
2. **防火墙**：确保允许本地IP访问
3. **登录防护**：检查是否有自动封锁机制
4. **密码强度要求**：临时降低要求以测试

## 验证步骤

修改配置后，运行诊断工具：
```bash
cd synology-file-manager
node diagnose.js
```

成功后会显示：
```
✓ 登录成功 (版本 X)
  SID: xxxxxxxx
```

## 如果仍然失败

### 检查DSM版本

控制面板 > 信息中心 > DSM信息
- DSM 6.0+: API完全支持
- DSM 5.x: 部分功能不支持

### 检查FileStation权限

1. 控制面板 > 权限 > 共享文件夹
2. 确保 `home` 文件夹存在
3. 给用户分配读写权限

### 测试不同的端口

修改 `.env` 尝试不同的端口：
```env
# 尝试HTTPS端口
SYNOLOGY_PORT=5001
SYNOLOGY_PROTOCOL=https

# 或者尝试默认HTTP端口
SYNOLOGY_PORT=80
```

### 使用HTTP Basic Auth（旧版兼容）

某些旧版DSM支持Basic Auth，修改 `synology-api.js` 的login方法：
```javascript
// 添加Authorization头
const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
axios.get(`${this.baseURL}/auth.cgi`, {
  headers: {
    'Authorization': `Basic ${auth}`
  },
  params: { ... }
});
```

## 服务器已启动

当前服务器状态：
- 🟢 服务器运行中
- 🟢 Web界面可访问: http://localhost:3000/index.html
- 🔴 群晖API连接失败 (需要解决407错误)

## 快速测试配置

解决407问题后，测试API：
```bash
# 测试健康检查
curl http://localhost:3000/health

# 测试文件列表
curl "http://localhost:3000/api/files?path=/"
```

## 查看详细错误

如果仍有问题，可以在浏览器中：
1. 打开 http://localhost:3000/index.html
2. 按F12打开开发者工具
3. 查看Console标签的错误详情
4. 查看Network标签的请求/响应

## 支持资源

- [群晖官方API文档](https://global.download.synology.com/download/Document/Software/DeveloperGuide/Package/FileStation/All/enu/Synology_File_Station_API_Guide.pdf)
- [群晖知识库](https://kb.synology.cn/zh-cn/search?query=API)

---

**提示**：大多数情况下，修改为不包含特殊字符的密码即可解决问题。
