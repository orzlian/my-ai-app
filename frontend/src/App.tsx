import { useState, useEffect } from 'react';
import './App.css';

// 获取API地址（支持环境变量配置）
const getApiUrl = () => import.meta.env.VITE_API_URL || 'http://localhost:3001';
const getAiUrl = () => import.meta.env.VITE_AI_URL || 'http://localhost:8000';

interface Trade {
  id: number;
  trade_id: string;
  symbol: string;
  side: string;
  price: number;
  quantity: number;
  timestamp: number;
}

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [uid, setUid] = useState<number|null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTrade, setNewTrade] = useState<Trade | null>(null);
  const [thought, setThought] = useState('');
  const [lastTradeId, setLastTradeId] = useState<number>(0);

  // 登录/注册
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    try {
      const resp = await fetch(`${getApiUrl()}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await resp.json();
      if (resp.ok) {
        setMsg(data.message);
        setUid(data.uid);
      } else {
        setMsg(data.message || '请求失败');
      }
    } catch(err: any) {
      setMsg(`网络错误: ${err.message || '无法连接到后端服务，请确认后端服务已启动'}`);
      console.error('登录错误:', err);
    }
  };

  // 保存API密钥
  const handleSaveKeys = async () => {
    if (!uid || !apiKey || !apiSecret) {
      setMsg('请填写完整的API密钥信息');
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`${getApiUrl()}/api/binance/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, apiKey, apiSecret }),
      });
      const data = await resp.json();
      setMsg(data.message || '保存成功');
    } catch(err) {
      setMsg('保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 拉取交易数据
  const handleFetchTrades = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const resp = await fetch(`${getApiUrl()}/api/binance/fetch-trades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, hours: 24 }),
      });
      const data = await resp.json();
      setMsg(data.message || '拉取完成');
      // 刷新交易列表
      if (uid) {
        const tradesResp = await fetch(`${getApiUrl()}/api/trades/${uid}`);
        const tradesData = await tradesResp.json();
        setTrades(tradesData);
      }
    } catch(err) {
      setMsg('拉取失败');
    } finally {
      setLoading(false);
    }
  };

  // 提交交易思考
  const handleSubmitThought = async () => {
    if (!newTrade) return;
    setLoading(true);
    try {
      const resp = await fetch(`${getApiUrl()}/api/trades/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId: newTrade.id, userThought: thought }),
      });
      const data = await resp.json();
      setMsg('复盘已生成');
      setNewTrade(null);
      setThought('');
      // 刷新交易列表
      if (uid) {
        const tradesResp = await fetch(`${getApiUrl()}/api/trades/${uid}`);
        const tradesData = await tradesResp.json();
        setTrades(tradesData);
      }
    } catch(err) {
      setMsg('提交失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载交易列表
  useEffect(() => {
    if (uid) {
      fetch(`http://localhost:3001/api/trades/${uid}`)
        .then(res => res.json())
        .then(data => {
          setTrades(data);
          if (data.length > 0) {
            setLastTradeId(data[0].id);
          }
        })
        .catch(() => {});
    }
  }, [uid]);

  // 轮询检测新交易
  useEffect(() => {
    if (!uid || !apiKey) return;
    const interval = setInterval(async () => {
      try {
        const resp = await fetch(`${getApiUrl()}/api/trades/new/${uid}?lastTradeId=${lastTradeId}`);
        const newTrades = await resp.json();
        if (newTrades.length > 0 && !newTrade) {
          // 发现新交易，显示弹窗
          const latestTrade = newTrades[0];
          setNewTrade(latestTrade);
          setLastTradeId(latestTrade.id);
          // 1分钟后自动关闭并生成简短复盘
          setTimeout(async () => {
            setNewTrade((currentTrade) => {
              if (currentTrade && currentTrade.id === latestTrade.id) {
                // 自动提交（无思考）
                fetch(`${getApiUrl()}/api/trades/review`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tradeId: latestTrade.id, userThought: '' }),
                }).then((_resp) => {
                  setMsg('已自动生成简短复盘');
                  if (uid) {
                    fetch(`http://localhost:3001/api/trades/${uid}`)
                      .then(res => res.json())
                      .then(data => setTrades(data));
                  }
                });
                return null;
              }
              return currentTrade;
            });
          }, 60000);
        }
      } catch(err) {
        // 忽略错误
      }
    }, 5000); // 每5秒检查一次
    return () => clearInterval(interval);
  }, [uid, apiKey, lastTradeId, newTrade]);

  // 登录界面
  if (!uid) {
    return (
      <div style={{ maxWidth: 400, margin: '3em auto', padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
        <h2>注册 / 登录</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <input type="email" placeholder="邮箱" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} style={{width:'100%',padding:8}} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <input type="password" placeholder="密码" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} style={{width:'100%',padding:8}} />
          </div>
          <button type="submit" style={{width:'100%',padding:8}}>马上体验</button>
        </form>
        <div style={{marginTop:16,minHeight:24, color: msg==='登录成功'||msg==='注册成功' ? 'green' : 'red'}}>
          {msg && <>{msg}{uid&&<span>，UID:{uid}</span>}</>}
        </div>
      </div>
    );
  }

  // 主界面
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '1em', minHeight: '100vh' }}>
      {/* 交易弹窗 */}
      {newTrade && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: 24,
            borderRadius: 8,
            maxWidth: 500,
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3>新交易提醒</h3>
            <div style={{ marginBottom: 16 }}>
              <div><strong>{newTrade.symbol}</strong> {newTrade.side}</div>
              <div>价格: {newTrade.price} | 数量: {newTrade.quantity}</div>
              <div style={{ fontSize: '0.9em', color: '#666' }}>{new Date(newTrade.timestamp).toLocaleString()}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <textarea
                placeholder="请输入你的交易思考..."
                value={thought}
                onChange={e => setThought(e.target.value)}
                style={{ width: '100%', minHeight: 100, padding: 8 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSubmitThought} disabled={loading} style={{ flex: 1, padding: 8 }}>
                提交并生成复盘
              </button>
              <button onClick={() => { setNewTrade(null); setThought(''); }} style={{ flex: 1, padding: 8 }}>
                稍后处理
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: '0.9em', color: '#666' }}>
              1分钟内未输入将自动生成简短复盘
            </div>
          </div>
        </div>
      )}
      <h2>交易复盘助手</h2>
      <div style={{ marginBottom: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
        <h3>Binance API 设置</h3>
        <div style={{ marginBottom: 12 }}>
          <input type="text" placeholder="API Key" value={apiKey} onChange={e => setApiKey(e.target.value)} style={{width:'100%',padding:8,marginBottom:8}} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input type="password" placeholder="API Secret" value={apiSecret} onChange={e => setApiSecret(e.target.value)} style={{width:'100%',padding:8,marginBottom:8}} />
        </div>
        <button onClick={handleSaveKeys} disabled={loading} style={{width:'100%',padding:8,marginBottom:8}}>保存密钥</button>
        <button onClick={handleFetchTrades} disabled={loading} style={{width:'100%',padding:8}}>拉取交易数据</button>
      </div>
      <div style={{ marginTop: 24 }}>
        <h3>交易记录 ({trades.length})</h3>
        {trades.length === 0 ? (
          <p>暂无交易记录</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {trades.map(trade => (
              <div key={trade.id} style={{ padding: 12, border: '1px solid #ddd', borderRadius: 4 }}>
                <div><strong>{trade.symbol}</strong> {trade.side} @ {trade.price}</div>
                <div style={{ fontSize: '0.9em', color: '#666' }}>数量: {trade.quantity} | {new Date(trade.timestamp).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {msg && (
        <div style={{marginTop:16, padding:8, background: msg.includes('成功') ? '#d4edda' : '#f8d7da', borderRadius:4, color: msg.includes('成功') ? '#155724' : '#721c24'}}>
          {msg}
        </div>
      )}
    </div>
  );
}

export default App;
