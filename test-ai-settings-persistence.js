#!/usr/bin/env node

// 测试用户 AI 设置持久化功能
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// 从 .env 文件读取配置
const envFile = readFileSync('.env', 'utf8');
const envLines = envFile.split('\n');
const envVars = {};

envLines.forEach(line => {
  const match = line.match(/^VITE_(\w+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2];
  }
});

const supabaseUrl = envVars.SUPABASE_URL;
const supabaseAnonKey = envVars.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ 缺少 Supabase 配置');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUserAISettings() {
  console.log('🧪 测试用户 AI 设置持久化功能...\n');
  
  try {
    // 1. 创建测试用户（如果不存在）
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'test123456'
    });
    
    if (signInError) {
      console.log('❌ 登录失败:', signInError.message);
      console.log('请确保测试用户已存在，或者创建一个新用户');
      return;
    }
    
    console.log('✅ 用户登录成功');
    const userId = signInData.user.id;
    console.log(`用户 ID: ${userId}\n`);
    
    // 2. 测试获取 AI 设置
    console.log('📖 测试获取 AI 设置...');
    const response = await fetch('http://localhost:5001/api/user/ai-settings', {
      headers: {
        'Authorization': `Bearer ${signInData.session.access_token}`
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.log('❌ 获取 AI 设置失败:', error);
    } else {
      const data = await response.json();
      console.log('✅ 获取 AI 设置成功');
      console.log('当前设置:', JSON.stringify(data.data || 'null', null, 2));
    }
    
    // 3. 测试保存 AI 设置
    console.log('\n💾 测试保存 AI 设置...');
    const testConfig = {
      provider: 'google',
      api_key: 'test-api-key',
      base_url: 'https://test.googleapis.com',
      text_model: 'gemini-test',
      image_model: 'gemini-test-image',
      temperature: 0.5,
      top_p: 0.8,
      top_k: 50,
      max_output_tokens: 4000
    };
    
    const saveResponse = await fetch('http://localhost:5001/api/user/ai-settings', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${signInData.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testConfig)
    });
    
    if (!saveResponse.ok) {
      const error = await saveResponse.json();
      console.log('❌ 保存 AI 设置失败:', error);
    } else {
      console.log('✅ 保存 AI 设置成功');
    }
    
    // 4. 再次获取设置验证保存
    console.log('\n🔍 验证设置是否已保存...');
    const verifyResponse = await fetch('http://localhost:5001/api/user/ai-settings', {
      headers: {
        'Authorization': `Bearer ${signInData.session.access_token}`
      }
    });
    
    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      console.log('❌ 验证 AI 设置失败:', error);
    } else {
      const data = await verifyResponse.json();
      console.log('✅ 验证 AI 设置成功');
      console.log('已保存的设置:', JSON.stringify(data.data, null, 2));
      
      // 检查是否与我们保存的值匹配
      const saved = data.data;
      if (saved && saved.provider === testConfig.provider && 
          saved.api_key === testConfig.api_key &&
          saved.text_model === testConfig.text_model) {
        console.log('✅ 设置持久化验证成功！');
      } else {
        console.log('❌ 设置持久化验证失败，保存的值与预期不符');
      }
    }
    
    console.log('\n🎉 测试完成！');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

testUserAISettings();