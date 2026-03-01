# 群晖文件管理API

一个基于Node.js的Web应用，通过群晖FileStation API实现文件的上传、下载、读取、删除等操作。

## ⚠️ 常见问题

### 如果遇到登录失败（错误407）：

1. 运行诊断工具：`node diagnose.js`
2. 修改群晖账号密码为**不包含特殊字符**的简单密码
3. 禁用群晖的双重验证（2FA）
4. 详细解决方案请查看：[TROUBLESHOOT.md](./TROUBLESHOOT.md)

### 快速诊断：
```bash
cd synology-file-manager
node diagnose.js
```

## 功能特性

- ✅ 用户认证（自动登录/登出）
- ✅ 文件列表浏览
- ✅ 单文件/批量文件上传
- ✅ 文件下载
- ✅ 文件/文件夹删除
- ✅ 创建文件夹
- ✅ 获取文件信息

## 系统要求

- Node.js >= 14.x
- 群晖NAS (DSM 6.x 或以上)
- 群晖Web Station (可选，仅用于访问群晖API)

## 安装配置

### 1. 克隆或下载项目

```bash
git clone <repository-url>
cd synology-file-manager
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并修改配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 群晖服务器配置
SYNOLOGY_HOST=192.168.80.88
SYNOLOGY_PROTOCOL=http
SYNOLOGY_PORT=5000

# 账号信息（必须修改）
SYNOLOGY_USERNAME=admin
SYNOLOGY_PASSWORD=your_password

# 上传默认目标文件夹
UPLOAD_FOLDER=/home

# 服务器配置
PORT=3000
```

**重要配置说明：**
- `SYNOLOGY_HOST`: 群晖服务器IP地址
- `SYNOLOGY_PORT`: 群晖HTTP端口（默认5000或5001）
- `SYNOLOGY_USERNAME/PASSWORD`: 群晖管理员账号密码
- `UPLOAD_FOLDER`: 默认上传目标文件夹路径

## 使用方法

### 启动服务器

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

服务器将在 `http://localhost:3000` 启动

### 运行测试

```bash
node test.js
```

测试脚本会执行以下操作：
1. 登录群晖
2. 列出根目录文件
3. 创建测试文件夹
4. 上传测试文件
5. 读取文件信息
6. 下载文件
7. 删除文件和文件夹
8. 登出

## API 接口文档

### 基础信息

```
Base URL: http://localhost:3000
```

### 1. 健康检查

```http
GET /health
```

响应示例：
```json
{
  "status": "ok",
  "sid": "已连接",
  "host": "192.168.80.88"
}
```

### 2. 列出文件列表

```http
GET /api/files?path=/&offset=0&limit=100
```

查询参数：
- `path`: 文件夹路径，默认 `/`
- `offset`: 起始位置，默认 0
- `limit`: 返回数量限制，默认 100

响应示例：
```json
{
  "success": true,
  "path": "/",
  "total": 25,
  "files": [
    {
      "name": "Documents",
      "path": "/Documents",
      "isdir": true,
      "size": 4096
    },
    {
      "name": "photo.jpg",
      "path": "/photo.jpg",
      "isdir": false,
      "size": 2048576
    }
  ]
}
```

### 3. 获取文件信息

```http
GET /api/files/info?path=/path/to/file.txt
```

查询参数：
- `path`: 文件或文件夹路径（必需）

响应示例：
```json
{
  "success": true,
  "data": {
    "name": "file.txt",
    "path": "/home/file.txt",
    "isdir": false,
    "size": 1024,
    "time": "1704067200"
  }
}
```

### 4. 单文件上传

```http
POST /api/upload
Content-Type: multipart/form-data
```

表单字段：
- `file`: 文件（必需）
- `folder`: 目标文件夹路径（可选，默认 `.env` 中的 `UPLOAD_FOLDER`）
- `overwrite`: 是否覆盖（true/false，可选）
- `mode`: 权限模式（可选）

使用 curl 示例：
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@/path/to/local/file.txt" \
  -F "folder=/home"
```

使用 JavaScript (FormData) 示例：
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('folder', '/home');
formData.append('overwrite', 'true');

fetch('http://localhost:3000/api/upload', {
  method: 'POST',
  body: formData
}).then(res => res.json());
```

### 5. 批量文件上传

```http
POST /api/upload/batch
Content-Type: multipart/form-data
```

表单字段：
- `files`: 多个文件（必需）
- `folder`: 目标文件夹路径（可选）
- `overwrite`: 是否覆盖（可选）
- `mode`: 权限模式（可选）

响应示例：
```json
{
  "success": true,
  "message": "上传完成: 2/2",
  "results": [
    {
      "fileName": "file1.txt",
      "success": true,
      "message": "文件上传成功"
    },
    {
      "fileName": "file2.txt",
      "success": true,
      "message": "文件上传成功"
    }
  ]
}
```

### 6. 下载文件

```http
GET /api/download?path=/home/file.txt
```

查询参数：
- `path`: 文件路径（必需）

响应：文件二进制流

使用 curl 示例：
```bash
curl -X GET "http://localhost:3000/api/download?path=/home/file.txt" \
  --output downloaded_file.txt
```

### 7. 删除文件

```http
DELETE /api/files?path=/home/file.txt&recursive=true
```

查询参数：
- `path`: 文件或文件夹路径（必需，多个路径用逗号分隔）
- `recursive`: 是否递归删除（true/false，默认true）

示例：
```bash
# 删除单个文件
curl -X DELETE "http://localhost:3000/api/files?path=/home/file.txt"

# 删除文件夹
curl -X DELETE "http://localhost:3000/api/files?path=/home/folder&recursive=true"

# 删除多个文件
curl -X DELETE "http://localhost:3000/api/files?path=/home/file1.txt,/home/file2.txt"
```

### 8. 创建文件夹

```http
POST /api/folders
Content-Type: application/json
```

请求体：
```json
{
  "path": "/home",
  "name": "NewFolder"
}
```

响应示例：
```json
{
  "success": true,
  "message": "文件夹创建成功",
  "data": {
    "path": "/home/NewFolder"
  }
}
```

### 9. 登出

```http
POST /api/logout
```

响应：
```json
{
  "success": true,
  "message": "已登出"
}
```

## 使用示例

### 列出所有文件

```bash
curl http://localhost:3000/api/files?path=/
```

### 上传文件

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@/path/to/local/file.txt" \
  -F "folder=/home/Documents"
```

### 下载文件

```bash
curl "http://localhost:3000/api/download?path=/home/Documents/file.txt" \
  -o downloaded.txt
```

### 删除文件

```bash
curl -X DELETE "http://localhost:3000/api/files?path=/home/Documents/file.txt"
```

### 创建文件夹

```bash
curl -X POST http://localhost:3000/api/folders \
  -H "Content-Type: application/json" \
  -d '{"path": "/home", "name": "MyNewFolder"}'
```

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 100 | 未知错误 |
| 404 | 文件不存在 |
| 403 | 权限不足 |
| 405 | 用户配额已满 |
| 406 | 磁盘空间不足 |
| 407 | 目标文件夹不存在 |
| 408 | 文件已存在 |

## 注意事项

1. **安全性**：不要在公开网络中使用该服务，建议在局域网内使用或添加身份验证
2. **权限**：确保使用的群晖账号有足够的文件操作权限
3. **文件大小**：单文件上传限制为 1GB，可根据需要调整 `server.js` 中的 multer 配置
4. **路径**：文件夹路径必须以 `/` 开头
5. **连接池**：API使用长连接Session，会话超时后会自动重新登录

## 故障排查

### 登录失败

- 检查 `.env` 中的账号密码是否正确
- 确认群晖Web服务端口（默认5000或5001）
- 确认群晖支持DSM API访问

### 文件上传失败

- 检查目标文件夹是否存在且有写入权限
- 确认磁盘空间充足
- 查看返回的错误码和错误信息

### 无法连接

- 确认同一网络下可以访问群晖IP
- 检查群晖防火墙设置
- 尝试在浏览器访问 `http://192.168.80.88:5000`

## 项目结构

```
synology-file-manager/
├── server.js              # Express服务器主文件
├── synology-api.js        # 群晖API封装模块
├── test.js                # 测试脚本
├── package.json           # 项目配置
├── .env                   # 环境变量配置
├── .env.example           # 环境变量示例
├── uploads/               # 临时上传目录（自动创建）
└── README.md              # 本说明文档
```

## 技术栈

- **Node.js**: 运行时环境
- **Express**: Web框架
- **Axios**: HTTP客户端
- **Multer**: 文件上传处理
- **Form-Data**: 表单数据处理

## 许可证

MIT

## 贡献

欢迎提交Issue和Pull Request！

## 参考资料

- [Synology FileStation API](https://global.download.synology.com/download/Document/Software/DeveloperGuide/Synology_File_Station_API_Guide.pdf)
- [DSM API Documentation](https://developer.synology.com/docs)
