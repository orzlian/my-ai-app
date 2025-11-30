import crypto from 'crypto';

export interface BinanceTrade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  qty: number;
  time: number;
}

// Binance Futures API签名生成
function generateSignature(queryString: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
}

// 调用Binance Futures API
async function callBinanceFuturesAPI(
  apiKey: string,
  apiSecret: string,
  endpoint: string,
  params: Record<string, any> = {}
): Promise<any> {
  const baseURL = 'https://fapi.binance.com';
  const timestamp = Date.now();
  
  const queryParams = new URLSearchParams({
    ...params,
    timestamp: timestamp.toString(),
  });
  
  const signature = generateSignature(queryParams.toString(), apiSecret);
  queryParams.append('signature', signature);
  
  const url = `${baseURL}${endpoint}?${queryParams.toString()}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-MBX-APIKEY': apiKey,
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.msg || `API请求失败: ${response.statusText}`);
  }
  
  return response.json();
}

// 获取用户所有交易对
async function getUserSymbols(apiKey: string, apiSecret: string): Promise<string[]> {
  try {
    // 获取账户信息，从中提取有交易的交易对
    const account = await callBinanceFuturesAPI(apiKey, apiSecret, '/fapi/v2/account');
    // 从持仓中获取所有交易对
    const symbols = new Set<string>();
    if (account.positions) {
      for (const pos of account.positions) {
        if (parseFloat(pos.positionAmt) !== 0) {
          symbols.add(pos.symbol);
        }
      }
    }
    // 如果持仓为空，尝试获取最近有交易的交易对（通过获取所有交易对列表）
    if (symbols.size === 0) {
      const exchangeInfo = await callBinanceFuturesAPI(apiKey, apiSecret, '/fapi/v1/exchangeInfo');
      // 返回前20个常用交易对作为备选
      return exchangeInfo.symbols
        .filter((s: any) => s.status === 'TRADING')
        .slice(0, 20)
        .map((s: any) => s.symbol);
    }
    return Array.from(symbols);
  } catch (error: any) {
    console.error('获取交易对失败:', error.message);
    // 如果失败，返回常用交易对列表
    return ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
  }
}

export async function getBinanceTrades(
  apiKey: string,
  apiSecret: string,
  startTime?: number,
  endTime?: number
): Promise<BinanceTrade[]> {
  try {
    // 先获取用户的所有交易对
    const symbols = await getUserSymbols(apiKey, apiSecret);
    const allTrades: BinanceTrade[] = [];
    
    // 为每个交易对拉取交易记录
    for (const symbol of symbols) {
      try {
        const params: Record<string, any> = { symbol };
        if (startTime) params.startTime = startTime;
        if (endTime) params.endTime = endTime;
        params.limit = 1000; // 每个交易对最多拉取1000条
        
        const trades = await callBinanceFuturesAPI(apiKey, apiSecret, '/fapi/v1/userTrades', params);
        
        const mappedTrades = trades.map((trade: any) => ({
          id: trade.id.toString(),
          symbol: trade.symbol,
          side: trade.side === 'BUY' ? 'BUY' : 'SELL',
          price: parseFloat(trade.price),
          qty: parseFloat(trade.qty),
          time: trade.time,
        }));
        
        allTrades.push(...mappedTrades);
      } catch (error: any) {
        console.error(`拉取 ${symbol} 交易失败:`, error.message);
        // 继续拉取其他交易对
      }
    }
    
    // 按时间排序
    allTrades.sort((a, b) => a.time - b.time);
    
    return allTrades;
  } catch (error: any) {
    console.error('Binance Futures API Error:', error.message);
    throw new Error(`拉取交易数据失败: ${error.message}`);
  }
}

export async function getRecentTrades(apiKey: string, apiSecret: string, hours: number = 24): Promise<BinanceTrade[]> {
  const endTime = Date.now();
  const startTime = endTime - (hours * 60 * 60 * 1000);
  return getBinanceTrades(apiKey, apiSecret, startTime, endTime);
}

