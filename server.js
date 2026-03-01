require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const SynologyAPI = require('./synology-api');

const app = express();
const PORT = process.env.PORT || 3000;

// 初始化群晖API
const synology = new SynologyAPI();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(__dirname));

const axios = require('axios');  // 添加axios以便代理HTTP请求到群晖NAS

// 创建uploads临时目录
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
// 添加一个代理路由来处理向Synology NAS的请求
app.post('/proxy/synology', async (req, res) => {
  try {
    const { url, params, method = 'GET' } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Must provide target URL'
      });
    }
    
    const axiosConfig = {
      method: method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };
    
    if (method.toUpperCase() === 'GET') {
      axiosConfig.params = params;
    } else if (method.toUpperCase() === 'POST') {
      // For POST requests, we send params as form data
      axiosConfig.data = new URLSearchParams(params).toString();
      axiosConfig.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    
    // Send request to Synology NAS
    const synologyResponse = await axios(`${url}?${new URLSearchParams(params).toString()}`);
    
    res.json(synologyResponse.data);
    
  } catch (error) {
    console.error('Proxy request error:', error);
    res.status(500).json({
      success: false,
      message: `Request failed: ${error.message}`
    });
  }
});


// 配置multer用于文件上传
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 1024 * 1024 * 1024 // 1GB
  }
});

// 首页
app.get('/', (req, res) => {
  res.json({
    message: '群晖文件管理API',
    version: '1.0.0',
    endpoints: {
      'GET /health': '健康检查',
      'GET /api/files': '列出文件列表',
      'GET /api/files/info': '获取文件信息',
      'POST /api/upload': '上传文件',
      'GET /api/download': '下载文件',
      'DELETE /api/files': '删除文件',
      'POST /api/folders': '创建文件夹'
    },
    documentation: '查看README.md了解详细使用方法'
  });
});

// 健康检查
app.get('/health', async (req, res) => {
  try {
    await synology.ensureLoggedIn();
    res.json({
      status: 'ok',
      sid: synology.sid ? '已连接' : '未连接',
      host: process.env.SYNOLOGY_HOST
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// 列出文件列表
app.get('/api/files', async (req, res) => {
  try {
    const { path = '/', offset = 0, limit = 100 } = req.query;

    const result = await synology.listFiles(path, parseInt(offset), parseInt(limit));

    if (result.success) {
      res.json({
        success: true,
        path,
        total: result.total,
        files: result.files
      });
    } else {
      // 返回详细的错误信息包括错误代码
      res.status(400).json({
        success: false,
        error: result.error,
        message: result.message,
        errorCode: result.error_code,
        // 407错误的特殊提示
        troubleshooting: result.error_code === 407 ? {
          error: '账号访问被拒绝',
          possibleCauses: [
            '账号被临时锁定（登录尝试次数过多）',
            '密码不正确',
            '账号启用了双重验证（2FA），需要在控制面板中禁用或使用OTP方式登录'
          ],
          suggestions: [
            '1. 请确认账号密码是否正确',
            '2. 在群晖DSM控制面板 > 用户高级设置 > 安全 > 禁用双重验证',
            '3. 如果账号被锁定，请等待几分钟或联系管理员解锁',
            '4. 尝试在浏览器中登录群晖管理界面确认账号状态'
          ]
        } : null
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: error.toString()
    });
  }
});

// 获取文件信息
app.get('/api/files/info', async (req, res) => {
  try {
    const { path: filePath } = req.query;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: '请提供文件路径'
      });
    }

    const result = await synology.getFileInfo(filePath);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 上传文件
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const { file } = req;
    const { folder, overwrite, mode } = req.body;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的文件'
      });
    }

    // 读取文件buffer
    const fileBuffer = fs.readFileSync(file.path);
    const folderPath = folder || process.env.UPLOAD_FOLDER || '/home';

    const result = await synology.uploadFile(
      fileBuffer,
      file.originalname,
      folderPath,
      { overwrite, mode }
    );

    // 删除临时文件
    fs.unlinkSync(file.path);

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 批量上传文件
app.post('/api/upload/batch', upload.array('files', 10), async (req, res) => {
  try {
    const { files } = req;
    const { folder, overwrite, mode } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的文件'
      });
    }

    const folderPath = folder || process.env.UPLOAD_FOLDER || '/home';
    const results = [];

    for (const file of files) {
      const fileBuffer = fs.readFileSync(file.path);
      const result = await synology.uploadFile(
        fileBuffer,
        file.originalname,
        folderPath,
        { overwrite, mode }
      );
      results.push({
        fileName: file.originalname,
        ...result
      });
      fs.unlinkSync(file.path);
    }

    const successCount = results.filter(r => r.success).length;

    res.json({
      success: successCount > 0,
      message: `上传完成: ${successCount}/${files.length}`,
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 下载文件
app.get('/api/download', async (req, res) => {
  try {
    const { path: filePath } = req.query;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: '请提供文件路径'
      });
    }

    const result = await synology.downloadFile(filePath);

    if (result.success) {
      // 直接返回文件流
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.fileName)}"`);
      res.send(result.data);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 删除文件
app.delete('/api/files', async (req, res) => {
  try {
    const { path: filePath, recursive = 'true' } = req.query;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: '请提供文件路径'
      });
    }

    // 支持多个路径，用逗号分隔
    const paths = filePath.split(',').map(p => p.trim());
    const result = await synology.deleteFile(paths, recursive === 'true');

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 创建文件夹
app.post('/api/folders', async (req, res) => {
  try {
    const { path: folderPath, name } = req.body;

    if (!folderPath || !name) {
      return res.status(400).json({
        success: false,
        message: '请提供文件夹路径和名称'
      });
    }

    const result = await synology.createFolder(folderPath, name);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 登出
app.post('/api/logout', async (req, res) => {
  await synology.logout();
  res.json({
    success: true,
    message: '已登出'
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: err.message
  });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log(`群晖文件管理服务已启动`);
  console.log(`服务器地址: http://localhost:${PORT}`);
  console.log(`外部访问: http://192.168.80.187:${PORT}`);
  console.log(`群晖地址: ${process.env.SYNOLOGY_HOST}:${process.env.SYNOLOGY_PORT}`);
  console.log('========================================');
  console.log('\nAPI 端点:');
  console.log(`  GET  /health           - 健康检查`);
  console.log(`  GET  /api/files        - 列出文件列表`);
  console.log(`  GET  /api/files/info   - 获取文件信息`);
  console.log(`  POST /api/upload       - 上传文件`);
  console.log(`  POST /api/upload/batch - 批量上传文件`);
  console.log(`  GET  /api/download     - 下载文件`);
  console.log(`  DELETE /api/files      - 删除文件`);
  console.log(`  POST /api/folders      - 创建文件夹`);
  console.log(`  POST /api/logout       - 登出`);
  console.log('========================================\n');
});

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n正在关闭服务...');
  await synology.logout();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n正在关闭服务...');
  await synology.logout();
  process.exit(0);
});