require('dotenv').config();
const SynologyAPI = require('./synology-api');

async function testSynologyAPI() {
  console.log('========================================');
  console.log('开始测试群晖API');
  console.log('========================================\n');

  const api = new SynologyAPI();

  try {
    // 1. 测试登录
    console.log('1. 测试登录...');
    const loginResult = await api.login();
    if (!loginResult) {
      console.log('✗ 登录失败，请检查.env配置');
      return;
    }

    // 2. 测试列出文件
    console.log('\n2. 测试列出文件...');
    const listResult = await api.listFiles('/', 0, 20);
    console.log(`找到 ${listResult.total} 个项目`);
    if (listResult.files.length > 0) {
      console.log('前几个项目:');
      listResult.files.slice(0, 5).forEach((file, idx) => {
        console.log(`  ${idx + 1}. ${file.isdir ? '[文件夹]' : '[文件]'} ${file.name}${file.isdir ? '' : ` (${(file.size / 1024).toFixed(2)} KB)`}`);
      });
    }

    // 3. 测试创建文件夹
    console.log('\n3. 测试创建文件夹...');
    const testFolderName = 'TestFolder_' + Date.now();
    const createResult = await api.createFolder(process.env.UPLOAD_FOLDER || '/home', testFolderName);
    if (createResult.success) {
      console.log(`✓ 成功创建文件夹: ${testFolderName}`);
      const testFolderPath = `${process.env.UPLOAD_FOLDER || '/home'}/${testFolderName}`;

      // 4. 测试上传文件
      console.log('\n4. 测试上传文件...');
      const testData = Buffer.from('这是一个测试文件的内容\n测试时间: ' + new Date().toLocaleString('zh-CN'));
      const uploadResult = await api.uploadFile(testData, 'test_file.txt', testFolderPath);

      if (uploadResult.success) {
        console.log('✓ 文件上传成功');
        const uploadedFilePath = `${testFolderPath}/test_file.txt`;

        // 5. 测试读取文件列表
        console.log('\n5. 测试读取新上传的文件夹内容...');
        const folderContent = await api.listFiles(testFolderPath);
        if (folderContent.success && folderContent.files.length > 0) {
          console.log(`✓ 文件夹内容: ${folderContent.files[0].name}`);
        }

        // 6. 测试获取文件信息
        console.log('\n6. 测试获取文件信息...');
        const infoResult = await api.getFileInfo(uploadedFilePath);
        if (infoResult.success) {
          console.log(`✓ 文件信息: ${JSON.stringify(infoResult.data, null, 2)}`);
        }

        // 7. 测试下载文件
        console.log('\n7. 测试下载文件...');
        const downloadResult = await api.downloadFile(uploadedFilePath);
        if (downloadResult.success) {
          const content = downloadResult.data.toString('utf8');
          console.log(`✓ 文件下载成功，内容: ${content.substring(0, 50)}...`);
        }

        // 8. 测试删除文件
        console.log('\n8. 测试删除文件...');
        const deleteFileResult = await api.deleteFile(uploadedFilePath);
        if (deleteFileResult.success) {
          console.log('✓ 文件删除成功');
        }

        // 9. 测试删除文件夹
        console.log('\n9. 测试删除文件夹...');
        const deleteFolderResult = await api.deleteFile(testFolderPath);
        if (deleteFolderResult.success) {
          console.log('✓ 文件夹删除成功');
        }
      }
    } else {
      console.log('✗ 创建文件夹失败:', createResult.message);
    }

    console.log('\n========================================');
    console.log('✓ 所有测试完成');
    console.log('========================================');

  } catch (error) {
    console.error('\n✗ 测试过程中发生错误:', error.message);
  } finally {
    // 登出
    await api.logout();
  }
}

// 运行测试
testSynologyAPI();
