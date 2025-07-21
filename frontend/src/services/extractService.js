// src/services/extractService.js
export async function extractRequirementsFromReport(report) {
  // 模拟 delay
  await new Promise((res) => setTimeout(res, 500));

  // 使用报告 content 做 mock 输入（将来可接 LLM 提取）
  console.log('[Mock 提取内容]', report.content);

  return [
    {
      id: 'req-001',
      requirement: '保温材料应具有导热系数不大于 0.045 W/(m·K)。',
      method: '采用热流计法按照 GB/T 10294-2008 进行导热系数测试。'
    },
    {
      id: 'req-002',
      requirement: '材料表面应无裂纹、气泡、杂质等可见缺陷。',
      method: '采用目测和放大镜检查，必要时使用扫描电镜辅助分析。'
    },
    {
      id: 'req-003',
      requirement: '保温材料密度应在 40~60 kg/m³ 范围内。',
      method: '按 GB/T 6343-2009 规定的试样制备与称重方法测定。'
    }
  ];
}