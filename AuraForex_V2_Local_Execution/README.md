# SMC Forex Bot — Guia de Integração AI Studio

## Ficheiros Entregues
- `smc_forex_bot.js` — Lógica central do bot (Node.js / browser)
- `smc_bot_dashboard.html` — Dashboard interativo para uso no browser / AI Studio

---

## Estratégia SMC Implementada

### Conceitos Smart Money
| Conceito | Descrição |
|---|---|
| **Order Blocks** | Último candle bearish antes de impulso altista (e vice-versa) |
| **Fair Value Gaps** | Gap de preço entre candles 1 e 3 num impulso forte |
| **BOS** | Break of Structure — confirmação de tendência |
| **CHoCH** | Change of Character — primeiro sinal de reversão |
| **Liquidity Pools** | Equal Highs/Lows — zonas de stop hunt |

### Indicadores de Confirmação
| Indicador | Função |
|---|---|
| EMA 50 / 200 | Tendência macro e micro |
| RSI 14 | Momentum, zonas OB/OS (70/30) |
| MACD (12,26,9) | Confirmação de entrada com histograma |
| ATR 14 | SL/TP dinâmico (×1.8 / ×3.2) |
| Bollinger Bands | Volatilidade e reversão |
| Fibonacci | Níveis de suporte/resistência |

### Sistema de Score de Confluência (0–100)
```
SMC Structure (BOS/CHoCH) → 25 pts
Order Block ativo          → 20 pts
Fair Value Gap ativo        → 15 pts
EMA alinhada               → 15 pts
MACD confirma              → 10 pts
RSI confirma               → 10 pts
Sessão ativa               → 5  pts
─────────────────────────
Score mínimo para trade: 55 pts
```

---

## Integração com Google AI Studio (Gemini)

### 1. Instalar dependências (Node.js)
```bash
npm init -y
npm install node-fetch
```

### 2. Código de integração básica
```javascript
const { SMCForexBot, AIStudioIntegration } = require("./smc_forex_bot.js");

const bot = new SMCForexBot();
bot.init(10000);

// Callbacks de eventos
bot.onSignal = (signal) => {
  console.log("NOVO SINAL:", signal);
  // → Enviar para AI Studio UI
};

bot.onTrade = (result) => {
  console.log("TRADE FECHADO:", result);
  // → Atualizar P&L na interface
};

// Sua função de dados de mercado (MT5, OANDA, etc.)
async function fetchMarketData(pair) {
  // Retorne: { candles, currentPrice, atr, htfSummary }
}

// Iniciar com Gemini AI
AIStudioIntegration.runWithAI(
  bot,
  fetchMarketData,
  process.env.GEMINI_API_KEY,
  60000 // 60 segundos
);
```

### 3. Variáveis de ambiente
```
GEMINI_API_KEY=AIza...sua_chave_aqui
```

---

## Fontes de Dados de Mercado (Recomendadas)

| Broker/API | Protocolo | Gratuito |
|---|---|---|
| **MetaTrader 5** | WebSocket/Python | ✅ |
| **OANDA v20 API** | REST | ✅ 100 req/s |
| **Alpha Vantage** | REST | ✅ limitado |
| **FXCM API** | REST/Streaming | ✅ |
| **Interactive Brokers** | TWS API | Requer conta |

---

## Gestão de Risco

- **Risco por trade**: 1.5% do capital (configurável)
- **Máx. trades simultâneos**: 3
- **Perda diária máxima**: 5% (bot para automaticamente)
- **R:R mínimo**: 2.5:1
- **Trailing Stop**: Ativado após 1.5× ATR de lucro

---

## Sessões de Mercado (UTC)

```
Londres:  07:00 → 16:00 UTC
Nova York: 12:00 → 21:00 UTC
Overlap (maior liquidez): 12:00 → 16:00 UTC
```

---

## ⚠️ Aviso Legal

Este bot é para fins **educacionais e de pesquisa**.
Trading forex envolve risco significativo de perda.
Teste sempre em conta demo antes de usar capital real.
Resultados passados não garantem resultados futuros.
