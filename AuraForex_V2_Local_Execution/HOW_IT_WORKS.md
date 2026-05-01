# Como Funciona o AuraForex SMC Pro?

Este guia explica o ciclo de vida de uma operação, desde a análise do mercado até ao fecho do trade. O bot opera num ciclo contínuo (default: a cada 60 segundos) seguindo estes 8 passos fundamentais:

---

### Passo 1: Aquisição de Dados (Market Data)
O bot liga-se à corretora (via **Apex Broker**) e descarrega o histórico de preços (velas/candles) em múltiplos timeframes:
- **HTF (H4)**: Define a tendência macro.
- **MTF (H1)**: Contexto intermédio.
- **LTF (M15)**: Onde a execução e as entradas acontecem.

---

### Passo 2: Cálculo de Indicadores Técnicos
Antes da análise SMC, o sistema calcula indicadores matemáticos puros:
- **EMA 50/200**: Para alinhar com a tendência institucional.
- **ATR (Average True Range)**: Para medir a volatilidade e definir SL/TP dinâmicos.
- **RSI & MACD**: Para validar o momentum e exaustão do preço.

---

### Passo 3: Motor de Análise SMC (Smart Money)
Aqui reside a inteligência do bot. Ele procura por padrões institucionais:
- **Order Blocks (OB)**: Encontra a última vela contrária antes de um movimento forte, marcando-a como zona de interesse (POI).
- **Fair Value Gaps (FVG)**: Deteta ineficiências de preço que o mercado tende a vir preencher.
- **Estrutura (BOS/CHoCH)**: Identifica quebras de estrutura que confirmam a continuação ou reversão da tendência.

---

### Passo 4: Validação com Inteligência Artificial (Gemini)
Os dados técnicos são enviados para o **Google Gemini**. A IA atua como um "segundo par de olhos", analisando o sentimento do mercado e confirmando se o "Bias" (viés) é Bullish, Bearish ou Neutro. Se a IA não concordar com o sinal técnico, o trade pode ser descartado.

---

### Passo 5: Geração do Sinal e Score de Confluência
O bot atribui pontos a cada sinal. Um trade só é executado se atingir o **score mínimo (ex: 55/100)**.
- Tendência alinhada? +15 pts
- Preço dentro de um Order Block? +20 pts
- Gap de valor (FVG) aberto? +15 pts
- Cruzamento de Médias? +15 pts

---

### Passo 6: Gestão de Risco "Expert Logic"
Antes de enviar a ordem, o bot calcula o **tamanho do lote (Position Sizing)**:
- **Risco Fixo**: Calcula o lote exato para que, se o Stop Loss for atingido, percas apenas X% (ex: 1.5%) do saldo.
- **Proteção de Margem**: Verifica se tens margem livre suficiente para abrir a posição sem risco de Margin Call.
- **Normalização**: Ajusta o preço para o "Tick Size" da FBS ou de outros brokers para evitar rejeições.

---

### Passo 7: Execução via Apex Broker
A ordem é enviada via Bridge para o MetaTrader 4/5 ou Oanda. O bot utiliza métodos de "Expert Execution" que incluem comentários de ordem e Magic Numbers para rastreio futuro.

---

### Passo 8: Monitorização e Trailing Stop
Uma vez o trade aberto, o bot não para. Ele monitoriza o preço em tempo real:
- **Trailing Stop**: Se o preço avançar a favor (ex: 1.5x o ATR), o Stop Loss é movido para o Break Even ou lucro para proteger a operação.
- **Gestão de Saída**: O trade fecha automaticamente ao atingir o Take Profit (TP) ou Stop Loss (SL).

---

### Resumo do Fluxo de Trabalho
1. **Verificar** -> 2. **Calcular** -> 3. **Detetar** -> 4. **AI Bias** -> 5. **Validar Score** -> 6. **Calcular Risco** -> 7. **Executar** -> 8. **Gerir**
