require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');

class SynologyAPI {
  constructor() {
    this.host = process.env.SYNOLOGY_HOST || '192.168.80.88';
    this.port = process.env.SYNOLOGY_PORT || 5000;
    this.protocol = process.env.SYNOLOGY_PROTOCOL || 'http';
    this.username = process.env.SYNOLOGY_USERNAME;
    this.password = process.env.SYNOLOGY_PASSWORD;
    this.otpCode = process.env.SYNO_OTP_CODE || null; // OTP验证码（可选）
    this.sid = null;
    this.apiKey = null;
    this.apiVersion = '7'; // 默认使用最新版本

    this.baseURL = `${this.protocol}://${this.host}:${this.port}/webapi`;

    // 支持的认证方式
    this.authMethods = {
      'standard': this._loginStandard.bind(this),
      'with_encryption': this._loginWithEncryption.bind(this),
      'otp_auth': this._loginWithOTP.bind(this)
    };
  }

  /**
   * 查询系统API信息
   * 参考博客中的查询方法
   */
  async queryAPIInfo() {
    try {
      const response = await axios.get(`${this.baseURL}/query.cgi`, {
        params: {
          api: 'SYNO.API.Info',
          version: '1',
          method: 'query',
          query: 'SYNO.API.Auth,SYNO.API.Auth.Key,SYNO.API.Auth.Key.Code,SYNO.FileStation.List'
        }
      });
      return response.data;
    } catch (error) {
      console.error('✗ 查询API信息失败:', error.message);
      throw error;
    }
  }

  /**
   * 获取API密钥
   * 用于加密密码登录
   */
  async getAPIKey() {
    try {
      const response = await axios.get(`${this.baseURL}/entry.cgi`, {
        params: {
          api: 'SYNO.API.Auth.Key',
          version: '7',
          method: 'get',
          session: 'FileStation',
          format: 'cookie'
        }
      });

      if (response.data.success && response.data.data) {
        this.apiKey = response.data.data.apiKey || response.data.data.key;
        console.log(`✓ 获取API密钥成功: ${this.apiKey ? this.apiKey.substring(0, 8) + '...' : 'N/A'}`);
        return this.apiKey;
      } else {
        console.log('ℹ 系统不支持加密登录，将使用标准登录');
        return null;
      }
    } catch (error) {
      console.log('ℹ 获取API密钥失败，将使用标准登录');
      return null;
    }
  }

  /**
   * 主登录方法
   * 自动选择最佳的认证方式
   */
  async login() {
    console.log('========================================');
    console.log('开始群晖认证流程');
    console.log('========================================\n');

    try {
      // 步骤1: 查询API信息
      console.log('步骤1: 查询API信息...');
      const apiInfo = await this.queryAPIInfo();
      const authAPI = apiInfo.data['SYNO.API.Auth'];

      if (authAPI) {
        console.log(`  ✓ Auth API版本: ${authAPI.minVersion} - ${authAPI.maxVersion}`);
        this.apiVersion = Math.min(authAPI.maxVersion, 7).toString();
        console.log(`  ✓ 使用Auth API版本: ${this.apiVersion}`);
      }

      // 步骤2: 尝试获取API密钥
      console.log('\n步骤2: 尝试获取API密钥...');
      const apiKey = await this.getAPIKey();

      // 步骤3: 根据支持的功能选择认证方式
      console.log('\n步骤3: 执行登录认证...');

      // 认证方式优先级：
      // 1. 使用API密钥加密登录（最安全）
      // 2. 标准登录
      // 3. OTP验证登录（如果提供了OTP码）

      let loginSuccess = false;

      if (apiKey) {
        console.log('  尝试加密登录方式...');
        loginSuccess = await this.authMethods['with_encryption']();
      }

      if (!loginSuccess) {
        console.log('  尝试标准登录方式...');
        loginSuccess = await this.authMethods['standard']();
      }

      if (!loginSuccess && this.otpCode) {
        console.log('  尝试OTP验证登录...');
        loginSuccess = await this.authMethods['otp_auth']();
      }

      if (loginSuccess) {
        console.log('\n========================================');
        console.log(`✓ 登录成功`);
        console.log(`  SID: ${this.sid}`);
        console.log('========================================\n');
        return true;
      } else {
        console.log('\n========================================');
        console.log('✗ 所有认证方式均失败');
        console.log('========================================\n');
        return false;
      }

    } catch (error) {
      console.error('\n✗ 登录过程异常:', error.message);
      return false;
    }
  }

  /**
   * 标准登录方法
   * 参考博客和官方文档的基础登录
   */
  async _loginStandard() {
    // 尝试多种登录路径和参数组合
    const loginVariants = [
      // 变体1: 使用auth.cgi（旧版本路径）
      {
        path: `${this.baseURL}/auth.cgi`,
        params: {
          api: 'SYNO.API.Auth',
          version: '3',
          method: 'login',
          account: this.username,
          passwd: this.password,
          session: 'FileStation',
          format: 'sid'
        }
      },
      // 变体2: 使用entry.cgi（新版本路径）
      {
        path: `${this.baseURL}/entry.cgi`,
        params: {
          api: 'SYNO.API.Auth',
          version: '3',
          method: 'login',
          account: this.username,
          passwd: this.password,
          session: 'FileStation',
          format: 'cookie'
        }
      },
      // 变体3: 使用entry.cgi，格式为sid
      {
        path: `${this.baseURL}/entry.cgi`,
        params: {
          api: 'SYNO.API.Auth',
          version: '3',
          method: 'login',
          account: this.username,
          passwd: this.password,
          session: 'FileStation',
          format: 'sid'
        }
      },
      // 变体4: 使用entry.cgi，不指定format
      {
        path: `${this.baseURL}/entry.cgi`,
        params: {
          api: 'SYNO.API.Auth',
          version: '3',
          method: 'login',
          account: this.username,
          passwd: this.password,
          session: 'FileStation'
        }
      }
    ];

    for (let i = 0; i < loginVariants.length; i++) {
      const variant = loginVariants[i];
      try {
        console.log(`      尝试登录方式 ${i + 1}: ${variant.path.split('/').pop()}...`);

        const response = await axios.get(variant.path, {
          params: variant.params,
          paramsSerializer: {
            indexes: null,
            serialize: function(params) {
              // 自定义参数序列化，确保特殊字符正确处理
              return Object.keys(params)
                .map(key => {
                  const value = params[key];
                  return `${key}=${value}`;
                })
                .join('&');
            }
          },
          timeout: 10000
        });

        if (response.data.success) {
          this.sid = response.data.data.sid;
          console.log(`      ✓ 登录成功 (方式 ${i + 1})`);
          return true;
        } else {
          const errorCode = response.data.error?.code || response.data.error_code;
          console.log(`      ✗ 方式 ${i + 1} 失败: 错误码 ${errorCode}`);
        }
      } catch (error) {
        console.log(`      ✗ 方式 ${i + 1} 异常: ${error.message}`);
      }
    }

    console.error(`  ✗ 所有标准登录尝试均失败`);
    return false;
  }

  /**
   * 使用API密钥加密登录（推荐方法）
   * 更安全的认证方式
   */
  async _loginWithEncryption() {
    if (!this.apiKey) {
      return false;
    }

    try {
      // 使用API密钥加密密码
      const encryptedPassword = this._encryptWithApiKey(this.password, this.apiKey);

      const response = await axios.get(`${this.baseURL}/entry.cgi`, {
        params: {
          api: 'SYNO.API.Auth',
          version: this.apiVersion,
          method: 'login',
          account: this.username,
          passwd: encryptedPassword,
          session: 'FileStation',
          format: 'cookie',
          enable_syno_token: 'yes'
        },
        timeout: 10000
      });

      if (response.data.success) {
        this.sid = response.data.data.sid;
        console.log('      ✓ 加密登录成功');
        return true;
      } else {
        const errorCode = response.data.error.code || response.data.error_code;
        console.error(`  ✗ 加密登录失败: 错误码 ${errorCode}`);
        console.log(`     ${this.getErrorMessage(errorCode)}`);
        return false;
      }
    } catch (error) {
      console.error(`  ✗ 加密登录异常: ${error.message}`);
      return false;
    }
  }

  /**
   * OTP验证登录
   * 用于双重验证场景
   */
  async _loginWithOTP() {
    if (!this.otpCode) {
      return false;
    }

    try {
      // 两步登录：先获取OTP会话，然后提交OTP码
      const loginResponse = await axios.get(`${this.baseURL}/entry.cgi`, {
        params: {
          api: 'SYNO.API.Auth',
          version: this.apiVersion,
          method: 'login',
          account: this.username,
          passwd: this.password,
          session: 'FileStation',
          format: 'cookie',
          otp_code: this.otpCode,
          enable_syno_token: 'yes'
        },
        timeout: 10000
      });

      if (loginResponse.data.success) {
        this.sid = loginResponse.data.data.sid;
        console.log('      ✓ OTP登录成功');
        return true;
      } else {
        const errorCode = loginResponse.data.error.code || loginResponse.data.error_code;
        console.error(`  ✗ OTP登录失败: 错误码 ${errorCode}`);
        console.log(`     ${this.getErrorMessage(errorCode)}`);
        return false;
      }
    } catch (error) {
      console.error(`  ✗ OTP登录异常: ${error.message}`);
      return false;
    }
  }

  /**
   * 使用API密钥加密密码
   * 参考官方文档的加密算法
   */
  _encryptWithApiKey(password, apiKey) {
    // SHA256哈希
    const hash = crypto.createHash('sha256');
    hash.update(password);
    const hashedPassword = hash.digest('hex');

    // 与API密钥组合
    const combined = hashedPassword + apiKey;

    // 再次哈希
    const finalHash = crypto.createHash('sha256');
    finalHash.update(combined);
    return finalHash.digest('hex');
  }

  /**
   * 登出群晖
   */
  async logout() {
    if (!this.sid) return;

    try {
      await axios.get(`${this.baseURL}/entry.cgi`, {
        params: {
          api: 'SYNO.API.Auth',
          version: this.apiVersion,
          method: 'logout',
          session: 'FileStation',
          _sid: this.sid
        }
      });
      console.log('✓ 登出成功');
      this.sid = null;
    } catch (error) {
      console.error('✗ 登出错误:', error.message);
    }
  }

  /**
   * 确保已登录
   */
  async ensureLoggedIn() {
    if (!this.sid) {
      const success = await this.login();
      if (!success) {
        throw new Error('无法登录群晖服务器');
      }
    }
    return this.sid;
  }

  /**
   * 列出文件夹内容
   * @param {string} folderPath - 文件夹路径，例如: /home
   * @param {number} offset - 起始位置
   * @param {number} limit - 限制返回数量
   */
  async listFiles(folderPath = '/', offset = 0, limit = 100) {
    await this.ensureLoggedIn();

    try {
      const response = await axios.get(`${this.baseURL}/entry.cgi`, {
        params: {
          api: 'SYNO.FileStation.List',
          version: '2',
          method: 'list',
          folder_path: folderPath,
          offset,
          limit,
          sort_by: 'name',
          sort_direction: 'asc',
          _sid: this.sid
        }
      });

      if (response.data.success) {
        const files = response.data.data.files || [];
        return {
          success: true,
          total: response.data.data.total || 0,
          files
        };
      } else {
        return {
          success: false,
          error: response.data.error_code,
          message: this.getErrorMessage(response.data.error_code)
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: '请求失败'
      };
    }
  }

  /**
   * 上传文件
   * @param {Buffer} fileBuffer - 文件buffer
   * @param {string} fileName - 文件名
   * @param {string} folderPath - 目标文件夹路径
   * @param {object} overwriteOptions - 覆盖选项
   */
  async uploadFile(fileBuffer, fileName, folderPath, overwriteOptions = {}) {
    await this.ensureLoggedIn();
    
    console.log('上传参数:', {
      fileName,
      folderPath,
      overwriteOptions
    });

    try {
      const formData = new FormData();
      
      // 参数在 form-data 中，文件是最后一个 part
      formData.append('api', 'SYNO.FileStation.Upload');
      formData.append('version', '2');
      formData.append('method', 'upload');
      formData.append('path', folderPath);
      formData.append('create_parents', 'true');
      formData.append('overwrite', String(overwriteOptions.overwrite || 'false'));
      
      // 文件必须是最后一个 part
      const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
      formData.append('file', buffer, {
        filename: fileName,
        contentType: 'application/octet-stream'
      });
      
      const response = await axios.post(
        `${this.baseURL}/entry.cgi`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            // 关键：使用 cookie 方式传递 session
            'Cookie': `id=${this.sid}`
          },
          timeout: 120000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      console.log('响应:', JSON.stringify(response.data));

      if (response.data.success) {
        return {
          success: true,
          message: '文件上传成功',
          data: response.data.data
        };
      } else {
        const errorCode = response.data.error?.code || response.data.error_code;
        return {
          success: false,
          error: errorCode,
          message: this.getErrorMessage(errorCode)
        };
      }
    } catch (error) {
      console.error('上传错误:', error.message);
      if (error.response) {
        console.error('状态码:', error.response.status);
        console.error('响应:', error.response.data);
      }
      return {
        success: false,
        error: error.message,
        message: `上传失败: ${error.message}`
      };
    }
  }

  /**
   * 下载文件
   * @param {string} filePath - 文件路径
   */
  async downloadFile(filePath) {
    await this.ensureLoggedIn();
    
    try {
      const fileInfo = await this.getFileInfo(filePath);
      if (!fileInfo.success) {
        return {
          success: false,
          message: '文件不存在'
        };
      }

      const response = await axios.get(`${this.baseURL}/entry.cgi`, {
        params: {
          api: 'SYNO.FileStation.Download',
          version: '2',
          method: 'download',
          path: filePath,
          mode: 'open',
          _sid: this.sid
        },
        responseType: 'arraybuffer'
      });

      return {
        success: true,
        message: '文件下载成功',
        fileName: fileInfo.data.name,
        size: fileInfo.data.size,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `下载失败: ${error.message}`
      };
    }
  }

  /**
   * 获取文件信息
   * @param {string} filePath - 文件路径
   */
  async getFileInfo(filePath) {
    await this.ensureLoggedIn();

    try {
      const response = await axios.get(`${this.baseURL}/entry.cgi`, {
        params: {
          api: 'SYNO.FileStation.List',
          version: '2',
          method: 'getinfo',
          path: filePath,
          _sid: this.sid
        }
      });

      if (response.data.success) {
        const files = response.data.data.files || [];
        return {
          success: true,
          data: files[0]
        };
      } else {
        return {
          success: false,
          error: response.data.error_code,
          message: this.getErrorMessage(response.data.error_code)
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: '获取文件信息失败'
      };
    }
  }

  /**
   * 删除文件或文件夹
   * @param {string} path - 文件或文件夹路径
   * @param {boolean} recursive - 是否递归删除文件夹
   */
  async deleteFile(path, recursive = true) {
    await this.ensureLoggedIn();

    try {
      const response = await axios.get(`${this.baseURL}/entry.cgi`, {
        params: {
          api: 'SYNO.FileStation.Delete',
          version: '2',
          method: 'delete',
          path: Array.isArray(path) ? path.join(',') : path,
          recursive: recursive ? 'true' : 'false',
          _sid: this.sid
        }
      });

      if (response.data.success) {
        return {
          success: true,
          message: '删除成功',
          data: response.data.data
        };
      } else {
        return {
          success: false,
          error: response.data.error_code,
          message: this.getErrorMessage(response.data.error_code)
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `删除失败: ${error.message}`
      };
    }
  }

  /**
   * 创建文件夹
   * @param {string} folderPath - 文件夹路径
   * @param {string} name - 文件夹名称
   */
  async createFolder(folderPath, name) {
    await this.ensureLoggedIn();

    try {
      const response = await axios.get(`${this.baseURL}/entry.cgi`, {
        params: {
          api: 'SYNO.FileStation.CreateFolder',
          version: '2',
          method: 'create',
          folder_path: folderPath,
          name,
          force_parent: 'true',
          _sid: this.sid
        }
      });

      if (response.data.success) {
        return {
          success: true,
          message: '文件夹创建成功',
          data: response.data.data
        };
      } else {
        return {
          success: false,
          error: response.data.error_code,
          message: this.getErrorMessage(response.data.error_code)
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `创建失败: ${error.message}`
      };
    }
  }

  /**
   * 获取错误信息
   * @param {number} errorCode - 错误代码
   */
  getErrorMessage(errorCode) {
    const errorMessages = {
      0: '无错误',
      100: '未知错误',
      101: '参数无效',
      102: 'API不存在',
      103: '方法不存在',
      104: '版本不支持',
      105: '登录失败',
      106: '会话超时',
      107: '权限不足',
      108: '会话中断',
      109: '重新登录',
      400: '参数无效或密码错误',
      403: '权限不足',
      404: '文件不存在',
      405: '用户配额已满',
      406: '磁盘空间不足',
      407: '账号访问被拒绝',
      408: '文件已存在',
      409: '无效的文件名',
      410: '文件传输失败',
      411: '源文件夹和目标文件夹相同',
      412: '无效的复制选项',
      413: '无效的移动选项',
      414: '无效的重命名选项',
      415: '无法删除根目录',
      416: '无法删除非空文件夹',
      417: '文件正在被使用',
      418: '无效的文件或文件夹路径',
      599: '操作超时',
      600: '未知错误'
    };

    return errorMessages[errorCode] || `未知错误 (${errorCode})`;
  }
}

module.exports = SynologyAPI;