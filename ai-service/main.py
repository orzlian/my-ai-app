from fastapi import FastAPI
from pydantic import BaseModel
from datetime import datetime

app = FastAPI()

class TradeReviewRequest(BaseModel):
    symbol: str
    side: str
    price: float
    quantity: float
    user_thought: str = ""

@app.get('/')
def read_root():
    return {'message': 'Hello World from AI service!'}

@app.post('/api/review')
def generate_review(request: TradeReviewRequest):
    """根据交易信息和用户思考生成AI复盘"""
    symbol = request.symbol
    side = request.side
    price = request.price
    quantity = request.quantity
    user_thought = request.user_thought
    
    # 基础复盘模板（后续可接入真实AI API如OpenAI）
    if user_thought:
        review = f"""【交易复盘 - {symbol}】

交易方向：{side}
成交价格：{price}
交易数量：{quantity}

你的思考：{user_thought}

AI建议：
基于你的交易思考，本次交易体现了{'买入' if side == 'BUY' else '卖出'}的决策逻辑。
建议关注市场趋势变化，合理设置止损止盈点位，控制仓位风险。
持续记录交易思考有助于优化交易策略。"""
    else:
        review = f"""【自动复盘 - {symbol}】

交易方向：{side}
成交价格：{price}
交易数量：{quantity}

AI建议：
这是一笔{'买入' if side == 'BUY' else '卖出'}交易。
建议回顾当时的市场环境和交易逻辑，评估交易是否符合你的交易计划。
建议后续交易前先记录交易思考，有助于提升交易质量。"""
    
    return {
        'review': review,
        'timestamp': datetime.now().isoformat()
    }
