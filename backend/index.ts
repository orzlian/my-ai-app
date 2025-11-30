import express from 'express';
import cors from 'cors';
import db from './db.js';
import { getRecentTrades, getBinanceTrades } from './binance.js';

const app = express();
const port = process.env.PORT || 3001;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

app.use(cors());
app.use(express.json());

// 注册/登录接口
app.post('/api/auth', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: '邮箱和密码不能为空' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  if (user) {
    // 登录
    if (user.password === password) {
      return res.json({ message: '登录成功', uid: user.id });
    } else {
      return res.status(401).json({ message: '密码错误' });
    }
  } else {
    // 注册
    const info = db.prepare('INSERT INTO users(email, password) VALUES (?, ?)').run(email, password);
    return res.json({ message: '注册成功', uid: info.lastInsertRowid });
  }
});

// 保存用户Binance API密钥
app.post('/api/binance/keys', (req, res) => {
  const { userId, apiKey, apiSecret } = req.body;
  if (!userId || !apiKey || !apiSecret) {
    return res.status(400).json({ message: '参数不完整' });
  }
  try {
    // 检查是否已存在
    const existing = db.prepare('SELECT * FROM user_api_keys WHERE user_id = ?').get(userId);
    if (existing) {
      db.prepare('UPDATE user_api_keys SET api_key = ?, api_secret = ? WHERE user_id = ?').run(apiKey, apiSecret, userId);
    } else {
      db.prepare('INSERT INTO user_api_keys(user_id, api_key, api_secret) VALUES (?, ?, ?)').run(userId, apiKey, apiSecret);
    }
    res.json({ message: 'API密钥保存成功' });
  } catch (error: any) {
    res.status(500).json({ message: '保存失败: ' + error.message });
  }
});

// 拉取交易数据
app.post('/api/binance/fetch-trades', async (req, res) => {
  const { userId, hours } = req.body;
  if (!userId) {
    return res.status(400).json({ message: '用户ID不能为空' });
  }
  try {
    const apiKeys = db.prepare('SELECT * FROM user_api_keys WHERE user_id = ?').get(userId) as any;
    if (!apiKeys) {
      return res.status(400).json({ message: '请先设置Binance API密钥' });
    }
    const trades = await getRecentTrades(apiKeys.api_key, apiKeys.api_secret, hours || 24);
    // 保存交易到数据库
    const insertTrade = db.prepare('INSERT OR IGNORE INTO trades(user_id, trade_id, symbol, side, price, quantity, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)');
    let newTrades = 0;
    for (const trade of trades) {
      try {
        insertTrade.run(userId, trade.id, trade.symbol, trade.side, trade.price, trade.qty, trade.time);
        newTrades++;
      } catch (e) {
        // 忽略重复交易
      }
    }
    res.json({ message: `成功拉取${trades.length}条交易，新增${newTrades}条` });
  } catch (error: any) {
    res.status(500).json({ message: '拉取失败: ' + error.message });
  }
});

// 获取用户交易记录
app.get('/api/trades/:userId', (req, res) => {
  const { userId } = req.params;
  try {
    const trades = db.prepare('SELECT * FROM trades WHERE user_id = ? ORDER BY timestamp DESC').all(userId);
    res.json(trades);
  } catch (error: any) {
    res.status(500).json({ message: '查询失败: ' + error.message });
  }
});

// 保存交易思考和AI复盘
app.post('/api/trades/review', async (req, res) => {
  const { tradeId, userThought } = req.body;
  if (!tradeId) {
    return res.status(400).json({ message: '交易ID不能为空' });
  }
  try {
    const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId) as any;
    if (!trade) {
      return res.status(404).json({ message: '交易不存在' });
    }
    // 调用AI服务生成复盘
    const aiResp = await fetch(`${AI_SERVICE_URL}/api/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: trade.symbol,
        side: trade.side,
        price: trade.price,
        quantity: trade.quantity,
        user_thought: userThought || '',
      }),
    });
    const aiData = await aiResp.json();
    // 保存到数据库
    db.prepare('INSERT INTO trade_thoughts(trade_id, user_thought, ai_review) VALUES (?, ?, ?)').run(
      tradeId,
      userThought || null,
      aiData.review
    );
    res.json({ message: '复盘保存成功', review: aiData.review });
  } catch (error: any) {
    res.status(500).json({ message: '保存失败: ' + error.message });
  }
});

// 获取新交易（用于前端轮询检测）
app.get('/api/trades/new/:userId', (req, res) => {
  const { userId } = req.params;
  const { lastTradeId } = req.query;
  try {
    let query = 'SELECT * FROM trades WHERE user_id = ?';
    const params: any[] = [userId];
    if (lastTradeId) {
      query += ' AND id > ?';
      params.push(lastTradeId);
    }
    query += ' ORDER BY timestamp DESC LIMIT 10';
    const trades = db.prepare(query).all(...params);
    res.json(trades);
  } catch (error: any) {
    res.status(500).json({ message: '查询失败: ' + error.message });
  }
});

app.get('/', (req, res) => {
  res.send('Hello World from Backend!');
});

// 定时检测新交易（每30秒检查一次）
async function checkNewTrades() {
  try {
    const users = db.prepare('SELECT DISTINCT user_id FROM user_api_keys').all() as any[];
    for (const user of users) {
      const apiKeys = db.prepare('SELECT * FROM user_api_keys WHERE user_id = ?').get(user.user_id) as any;
      if (!apiKeys) continue;
      
      try {
        // 只拉取最近5分钟的交易
        const trades = await getRecentTrades(apiKeys.api_key, apiKeys.api_secret, 5 / 60);
        const insertTrade = db.prepare('INSERT OR IGNORE INTO trades(user_id, trade_id, symbol, side, price, quantity, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)');
        
        for (const trade of trades) {
          try {
            const result = insertTrade.run(user.user_id, trade.id, trade.symbol, trade.side, trade.price, trade.qty, trade.time);
            // 如果是新交易，自动生成简短复盘
            if (result.changes > 0) {
              const newTrade = db.prepare('SELECT * FROM trades WHERE trade_id = ? AND user_id = ?').get(trade.id, user.user_id) as any;
              if (newTrade) {
                // 自动生成简短复盘（1分钟后如果用户没输入思考）
                setTimeout(async () => {
                  const thought = db.prepare('SELECT * FROM trade_thoughts WHERE trade_id = ?').get(newTrade.id);
                  if (!thought) {
                    // 用户1分钟内没输入，自动生成简短复盘
                    const aiResp = await fetch(`${AI_SERVICE_URL}/api/review`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        symbol: newTrade.symbol,
                        side: newTrade.side,
                        price: newTrade.price,
                        quantity: newTrade.quantity,
                        user_thought: '',
                      }),
                    });
                    const aiData = await aiResp.json();
                    db.prepare('INSERT INTO trade_thoughts(trade_id, ai_review) VALUES (?, ?)').run(newTrade.id, aiData.review);
                  }
                }, 60000); // 1分钟后
              }
            }
          } catch (e) {
            // 忽略重复交易
          }
        }
      } catch (error: any) {
        console.error(`用户 ${user.user_id} 交易检测失败:`, error.message);
      }
    }
  } catch (error: any) {
    console.error('定时检测交易失败:', error.message);
  }
}

// 启动定时任务
setInterval(checkNewTrades, 30000); // 每30秒检查一次

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
  console.log('定时交易检测已启动（每30秒检查一次）');
});
