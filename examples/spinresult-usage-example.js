/**
 * SpinResult 统一格式使用示例
 * 
 * 这个文件展示了如何在游戏各系统中使用统一的 SpinResult 格式
 */

// ==================== 示例 1: ResultBank 生成结果 ====================

import { resultBank } from '../src/systems/ResultBank.js';

console.log('=== 示例 1: ResultBank 生成结果 ===\n');

// 获取第 1 关的转轮结果
const result1 = resultBank.getResult(1);
console.log('第 1 关结果：');
console.log(JSON.stringify(result1, null, 2));
console.log('');

// 获取第 5 关的转轮结果（更难，命中率更低）
const result5 = resultBank.getResult(5);
console.log('第 5 关结果：');
console.log(JSON.stringify(result5, null, 2));
console.log('');

// ==================== 示例 2: 解析 SpinResult ====================

console.log('=== 示例 2: 解析 SpinResult ===\n');

function analyzeSpinResult(spinResult) {
  console.log('网格布局:');
  console.log('  列0  列1  列2');
  for (let r = 0; r < 3; r++) {
    const row = [
      spinResult.grid[0][r],
      spinResult.grid[1][r],
      spinResult.grid[2][r]
    ];
    console.log(`行${r}:  ${row.join('    ')}`);
  }
  console.log('');

  console.log(`中奖线数量: ${spinResult.wins.length}`);
  console.log(`总倍率: ${spinResult.totalMul}x`);
  console.log('');

  if (spinResult.wins.length > 0) {
    console.log('中奖详情:');
    spinResult.wins.forEach((win, idx) => {
      const symbolNames = win.symbols.map(s => {
        const map = { 0: 'EMPTY', 1: 'BULLET', 2: 'GRENADE', 3: 'MISSILE', 4: 'WILD' };
        return map[s] || '?';
      });
      console.log(`  线 ${win.lineIndex}: [${symbolNames.join(', ')}] -> ${win.payoutMul}x`);
    });
  } else {
    console.log('未中奖 (MISS)');
  }
  console.log('');
}

analyzeSpinResult(result1);

// ==================== 示例 3: TurnPlanner 处理结果 ====================

console.log('=== 示例 3: TurnPlanner 处理结果 ===\n');

// 模拟 TurnPlanner 的处理逻辑
function simulateTurnPlanner(spinResult, bet = 10) {
  const events = [];
  
  for (const w of spinResult.wins || []) {
    const symbols = w.symbols || [];
    
    const bulletCount = symbols.filter(s => s === 1).length;
    const grenadeCount = symbols.filter(s => s === 2).length;
    const missileCount = symbols.filter(s => s === 3).length;
    const wildCount = symbols.filter(s => s === 4).length;
    
    if (bulletCount > 0) {
      events.push({ type: "Shoot", dmg: bet * 1, count: bulletCount });
    }
    
    if (grenadeCount > 0) {
      events.push({ type: "Grenade", dmg: bet * 2, radius: 90 });
    }
    
    if (missileCount > 0) {
      events.push({ type: "Missile", dmg: bet * 3, splash: 120 });
    }
    
    if (wildCount > 0) {
      events.push({ type: "WildBonus", multiplier: 1 + wildCount * 0.5, count: wildCount });
    }
  }
  
  return { spin: spinResult, events };
}

const bet = 10;
const plan = simulateTurnPlanner(result1, bet);

console.log(`下注金额: ${bet}`);
console.log(`总赢分: ${plan.spin.totalMul * bet}`);
console.log('生成的战斗事件:');
if (plan.events.length > 0) {
  plan.events.forEach((event, idx) => {
    console.log(`  ${idx + 1}. ${event.type}:`);
    console.log(`     ${JSON.stringify(event, null, 6)}`);
  });
} else {
  console.log('  无战斗事件 (未中奖)');
}
console.log('');

// ==================== 示例 4: 统计分析 ====================

console.log('=== 示例 4: 统计分析 (1000次转轮) ===\n');

function runStatistics(level, rounds = 1000) {
  let totalWins = 0;
  let totalMiss = 0;
  let totalMultiplier = 0;
  const symbolCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  
  for (let i = 0; i < rounds; i++) {
    const result = resultBank.getResult(level);
    
    if (result.wins.length > 0) {
      totalWins++;
      totalMultiplier += result.totalMul;
      
      // 统计符号出现次数
      result.wins.forEach(win => {
        win.symbols.forEach(sym => {
          if (symbolCounts[sym] !== undefined) {
            symbolCounts[sym]++;
          }
        });
      });
    } else {
      totalMiss++;
    }
  }
  
  const winRate = (totalWins / rounds * 100).toFixed(2);
  const avgMultiplier = totalWins > 0 ? (totalMultiplier / totalWins).toFixed(2) : 0;
  const rtp = (totalMultiplier / rounds * 100).toFixed(2);
  
  console.log(`关卡 ${level} 统计结果 (${rounds} 次):`);
  console.log(`  中奖率: ${winRate}%`);
  console.log(`  未中奖: ${totalMiss} 次`);
  console.log(`  平均倍率: ${avgMultiplier}x (仅中奖局)`);
  console.log(`  理论 RTP: ${rtp}%`);
  console.log(`  符号分布:`);
  console.log(`    BULLET (1):  ${symbolCounts[1]} 次`);
  console.log(`    GRENADE (2): ${symbolCounts[2]} 次`);
  console.log(`    MISSILE (3): ${symbolCounts[3]} 次`);
  console.log(`    WILD (4):    ${symbolCounts[4]} 次`);
  console.log('');
}

// 运行不同关卡的统计
runStatistics(1, 1000);
runStatistics(5, 1000);
runStatistics(10, 1000);

console.log('=== 完成 ===');

