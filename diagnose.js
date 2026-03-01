#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

const host = process.env.SYNOLOGY_HOST || '192.168.80.88';
const port = process.env.SYNOLOGY_PORT || 5000;
const protocol = process.env.SYNOLOGY_PROTOCOL || 'http';
const username = process.env.SYNOLOGY_USERNAME;
const password = process.env.SYNOLOGY_PASSWORD;

const baseURL = `${protocol}://${host}:${port}/webapi`;

console.log('========================================');
console.log('群晖API诊断工具');
console.log('========================================\n');

console.log('配置信息:');
console.log(`  主机: ${host}`);
console.log(`  协议: ${protocol}`);
console.log(`  端口: ${port}`);
console.log(`  用户名: ${username}`);
console.log(`  密码: ${password ? '***已设置***' : '未设置'}`);
console.log();

// 测试1: 检查API是否可用
console.log('测试1: 检查API可用性...');
axios.get(`${baseURL}/query.cgi?api=SYNO.API.Info&version=1&method=query`)
  .then(res => {
    console.log('✓ API可用');
    console.log(`  Auth API: ${JSON.stringify(res.data.data['SYNO.API.Auth'])}`);
  })
  .catch(err => {
    console.log('✗ API不可用');
    console.log(`  错误: ${err.message}`);
  });

// 测试2: 尝试使用不同版本的登录API
const versions = [3, 4, 5, 6, 7];
console.log('\n测试2: 尝试不同版本的登录API...');

const testLogin = async (version) => {
  try {
    const response = await axios.get(`${baseURL}/entry.cgi`, {
      params: {
        api: 'SYNO.API.Auth',
        version: version,
        method: 'login',
        account: username,
        passwd: password,
        session: 'FileStation'
      }
    });

    if (response.data.success) {
      console.log(`✓ 登录成功 (版本 ${version})`);
      console.log(`  SID: ${response.data.data.sid}`);

      // 登出
      await axios.get(`${baseURL}/entry.cgi`, {
        params: {
          api: 'SYNO.API.Auth',
          version: version,
          method: 'logout',
          session: 'FileStation',
          _sid: response.data.data.sid
        }
      });
      return true;
    } else {
      console.log(`✗ 登录失败 (版本 ${version})`);
      console.log(`  错误代码: ${response.data.error.code}`);
      console.log(`  错误详情: ${JSON.stringify(response.data.error)}`);

      // 显示常见错误的解决方案
      const errorCode = response.data.error.code;
      if (errorCode === 400) {
        console.log(`  可能原因: 密码包含特殊字符需要编码，或账号密码错误`);
      } else if (errorCode === 407) {
        console.log(`  ⚠️  错误407 - 账号访问被拒绝`);
        console.log(`  可能原因:`);
        console.log(`    1. 账号被临时锁定（登录尝试次数过多）`);
        console.log(`    2. 密码不正确`);
        console.log(`    3. 账号启用了双重验证（2FA）`);
        console.log(`  解决方案:`);
        console.log(`    1. 在群晖管理界面检查账号状态`);
        console.log(`    2. 在控制面板 > 用户高级设置 > 安全 > 禁用双重验证`);
        console.log(`    3. 确认密码是否包含特殊字符，尝试简单密码测试`);
      } else if (errorCode === 403) {
        console.log(`  可能原因: 权限不足，确认账号有相关权限`);
      }
      return false;
    }
  } catch (error) {
    console.log(`✗ 请求失败 (版本 ${version})`);
    console.log(`  错误: ${error.message}`);
    if (error.response) {
      console.log(`  响应状态: ${error.response.status}`);
    }
    return false;
  }
};

// 串行测试所有版本
(async () => {
  let success = false;
  for (const version of versions) {
    success = await testLogin(version);
    if (success) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n========================================');
  if (success) {
    console.log('✓ 找到可用的登录配置');
    console.log('========================================\n');
  } else {
    console.log('✗ 所有登录尝试失败');
    console.log('========================================\n');
    console.log('建议操作:');
    console.log('1. 确认群晖DSM版本和控制面板设置');
    console.log('2. 检查账号密码是否正确');
    console.log('3. 在群晖控制面板 > 用户高级设置 > 安全 > 禁用双重验证');
    console.log('4. 在控制面板 > 控制面板 > 登录 > 启用密码强度要求检查');
    console.log('5. 尝试使用简单的测试账号确认API功能\n');
  }
})();
