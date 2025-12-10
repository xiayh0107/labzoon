#!/usr/bin/env node

// 简单测试 API 端点是否返回 JSON 而不是 HTML

async function testAPIEndpoint() {
  console.log('🧪 测试 API 端点是否返回正确的 JSON 响应...\n');
  
  // 测试 1: 未认证请求应该返回 401 和 JSON 错误消息
  console.log('1. 测试未认证请求...');
  try {
    const response = await fetch('http://localhost:5001/api/user/ai-settings');
    const contentType = response.headers.get('content-type');
    const text = await response.text();
    
    console.log(`状态码: ${response.status}`);
    console.log(`Content-Type: ${contentType}`);
    console.log(`响应前100字符: ${text.substring(0, 100)}`);
    
    if (response.status === 401 && contentType && contentType.includes('application/json')) {
      console.log('✅ 测试通过: 未认证请求返回 401 和 JSON');
    } else {
      console.log('❌ 测试失败: 期望 401 和 JSON，但得到不同结果');
    }
  } catch (error) {
    console.log(`❌ 请求失败: ${error.message}`);
  }
  
  console.log('\n测试完成！');
}

testAPIEndpoint();