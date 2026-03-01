require('dotenv').config();
const SynologyAPI = require('./synology-api');

async function testNewAuthFlow() {
  console.log('========================================');
  console.log('测试新的完整认证流程');
  console.log('========================================\n');

  const api = new SynologyAPI();

  try {
    // 登录（测试新的认证流程）
    const loginResult = await api.login();

    if (!loginResult) {
      console.log('✗ 新认证流程测试失败');
      return;
    }

    // 测试文件列表
    console.log('\n测试文件列表功能...');
    const listResult = await api.listFiles('/', 0, 20);
    if (listResult.success) {
      console.log(`✓ 成功列出 ${listResult.total} 个项目`);
      if (listResult.files.length > 0) {
        console.log('前几个项目:');
        listResult.files.slice(0, 3).forEach((file, idx) => {
          console.log(`  ${idx + 1}. ${file.isdir ? '[文件夹]' : '[文件]'} ${file.name}`);
        });
      }
    } else {
      console.log(`✗ 列出文件失败: ${listResult.message}`);
    }

    console.log('\n========================================');
    console.log('✓ 新认证流程测试完成');
    console.log('========================================');

  } catch (error) {
    console.error('\n✗ 测试过程中发生错误:', error.message);
  } finally {
    await api.logout();
  }
}

// 运行测试
testNewAuthFlow();
