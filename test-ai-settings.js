// 测试AI设置持久化修复的脚本
// 这个脚本测试getAIConfig函数是否能正确从数据库加载用户设置

import { supabase } from '../supabase';
import { getAIConfig } from '../api';

async function testAISettingsPersistence() {
  try {
    // 获取当前用户
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('无法获取用户信息:', userError);
      return;
    }
    
    console.log(`测试用户: ${user.id} (${user.email})`);
    
    // 测试1: 检查是否能从数据库加载AI设置
    console.log('\n测试1: 从数据库加载AI设置...');
    const config = await getAIConfig(user.id);
    console.log('加载的配置:', {
      provider: config.provider,
      apiKey: config.apiKey ? '已设置' : '未设置',
      baseUrl: config.baseUrl,
      textModel: config.textModel,
      imageModel: config.imageModel
    });
    
    // 测试2: 检查配置是否包含API密钥
    console.log('\n测试2: 验证配置完整性...');
    if (!config.apiKey) {
      console.warn('警告: API密钥为空');
    }
    
    if (!config.baseUrl) {
      console.warn('警告: Base URL为空');
    }
    
    // 测试3: 验证默认值
    console.log('\n测试3: 验证默认值...');
    console.log('温度:', config.temperature);
    console.log('Top P:', config.topP);
    console.log('Top K:', config.topK);
    
    console.log('\n✅ AI设置持久化测试完成');
    console.log('如果上述配置显示正确，说明修复成功！');
    
  } catch (error) {
    console.error('测试过程中出错:', error);
  }
}

// 如果在Node.js环境中运行
if (typeof window === 'undefined') {
  testAISettingsPersistence();
}

export { testAISettingsPersistence };