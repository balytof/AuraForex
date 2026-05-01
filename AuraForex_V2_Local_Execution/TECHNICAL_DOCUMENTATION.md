# Documentação Técnica — AuraForex SMC Pro (v2.5.1)

Este documento fornece uma visão geral técnica completa do ecossistema AuraForex, abrangendo a arquitetura do servidor, a lógica de trading Smart Money Concepts (SMC) e a infraestrutura de integração com corretoras.

---

## 1. Visão Geral do Sistema

O AuraForex é uma plataforma de trading automatizada e semi-automatizada baseada em **Smart Money Concepts (SMC)**. O sistema foi desenhado para operar em dois modos:
- **Modo SaaS (Dashboard)**: Interface web completa com gestão de utilizadores, licenças e monitorização em tempo real via MetaApi.
- **Modo Standalone (Bot)**: Script Node.js de alta performance para execução contínua em servidor (VPS).

---

## 2. Arquitetura Técnica

### Core Stack
- **Backend**: Node.js (Express)
- **Base de Dados**: PostgreSQL com Prisma ORM
- **Segurança**: JWT (JSON Web Tokens), Encriptação AES-256 para credenciais, Helmet & Rate Limiting.
- **Frontend**: HTML5/CSS3 (Vanilla) com comunicações via REST API.

### Módulos Principais
- `server.js`: Orquestrador central, gestão de rotas, autenticação e broker bridge.
- `apex_broker.js`: Factory universal de brokers. Gere a comunicação com MetaApi (MT4/5), Oanda e Capital.com.
- `smc_forex_bot.js`: Motor de análise SMC de alta precisão.
- `ai/gemini.js`: Integração com Google Gemini para análise de bias macro-económico.

---

## 3. Estratégia de Trading: SMC Pro

O bot utiliza uma abordagem institucional para identificar liquidez e pontos de interesse (POI).

### Conceitos Implementados:
- **Order Blocks (OB)**: Identificação de zonas de oferta e procura institucionais.
- **Fair Value Gaps (FVG)**: Deteção de desequilíbrios de preço (ineficiências).
- **Market Structure**: Análise de tendências via BOS (Break of Structure) e CHoCH (Change of Character).
- **Liquidity Pools**: Identificação de Equal Highs/Lows para evitar *stop hunts*.

### Confluência (Score System):
Cada sinal é validado por um sistema de pontuação (0-100 pts):
- Estrutura (BOS/CHoCH) -> 25 pts
- Order Block Ativo -> 20 pts
- FVG Ativo -> 15 pts
- EMA Trend Alignment -> 15 pts
- RSI/MACD Momentum -> 20 pts
- *Mínimo para execução: 55 pts*

---

## 4. Gestão de Risco & Execução

O sistema prioriza a preservação de capital através de algoritmos de "Expert Logic".

### Funcionalidades de Segurança:
- **Cálculo de Lote Dinâmico**: Ajuste automático baseado no risco % (ex: 1.5% por trade).
- **Contract Size Sensing**: Diferenciação automática entre Forex (100k) e Ouro (100).
- **Margin Guard**: Bloqueio de ordens se a margem livre for insuficiente (1 lote por 500$ de margem).
- **Normalização de Tick**: Arredondamento automático de SL/TP para evitar rejeições da corretora.
- **Emergency Stop Expansion**: Reajuste automático de stops se violarem o *stop level* do broker.

---

## 5. Integração com Corretoras (Apex Bridge)

O sistema utiliza a tecnologia **Apex Bridge** para conectividade multi-broker:
- **MetaApi**: Conexão RPC estável para MT4/MT5 com suporte a sufixos FBS (`.m`, `.pro`).
- **Oanda v20**: Integração nativa via REST API.
- **Capital.com**: Suporte para trading de CFD via API oficial.

---

## 6. Estrutura de Ficheiros

```text
/AuraForex
├── server.js               # Servidor SaaS e API
├── apex_broker.js          # Driver Universal de Brokers
├── smc_forex_bot.js        # Lógica de análise SMC
├── /ai
│   └── gemini.js           # Inteligência Artificial
├── /data
│   └── broker.js           # Wrapper de compatibilidade
├── /execution
│   └── execution.js        # Módulo de execução de ordens
├── /risk
│   └── risk.js             # Gestor de risco e PnL
├── /signals
│   └── signals.js          # Gerador de sinais
├── /indicators
│   └── indicators.js       # Biblioteca matemática de indicadores
└── /prisma
    └── schema.prisma       # Definição da Base de Dados
```

---

## 7. Instalação e Execução

### Requisitos
- Node.js v18+
- PostgreSQL
- MetaApi Token (para MT4/5)

### Setup
1. Instalar dependências: `npm install`
2. Configurar `.env` (DATABASE_URL, JWT_SECRET, GEMINI_API_KEY).
3. Sincronizar DB: `npx prisma db push`
4. Iniciar: `npm run dev`

---

## 8. Manutenção e Logs
Todos os eventos críticos são registados em `server_log.txt`. Para diagnóstico em tempo real, o servidor emite logs prefixados com `[EXPERT-MA]` para execução de broker e `[DIAGNOSTIC]` para integridade do sistema.

---
**Documento gerado em:** 28 de Abril de 2026.
**Estado:** Estável (v2.5.1)
