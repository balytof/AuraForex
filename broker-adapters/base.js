/**
 * ============================================================
 *  BrokerAdapter — Base Class
 *  Interface padrão para todas as corretoras
 * ============================================================
 */

class BrokerAdapter {
  constructor(name, type) {
    this.name = name;       // "OANDA", "Capital.com", "MetaTrader"
    this.type = type;       // "oanda", "capital", "metaapi"
    this.connected = false;
    this.accountInfo = null;
    this.credentials = null;
  }

  /**
   * Liga à corretora
   * @param {Object} credentials - credenciais específicas da corretora
   * @returns {Object} { success, accountInfo, error }
   */
  async connect(credentials) {
    throw new Error(`connect() não implementado em ${this.name}`);
  }

  /**
   * Desliga da corretora
   */
  async disconnect() {
    this.connected = false;
    this.accountInfo = null;
    this.credentials = null;
  }

  /**
   * Obtém informações da conta
   * @returns {Object} { balance, equity, currency, accountType, accountId, broker }
   */
  async getAccountInfo() {
    throw new Error(`getAccountInfo() não implementado em ${this.name}`);
  }

  /**
   * Lista posições abertas
   * @returns {Array} [{ id, pair, direction, lotSize, openPrice, sl, tp, pnl }]
   */
  async getOpenPositions() {
    throw new Error(`getOpenPositions() não implementado em ${this.name}`);
  }

  /**
   * Abre uma posição
   * @param {Object} order - { pair, direction, lotSize, sl, tp }
   * @returns {Object} { success, orderId, error }
   */
  async placeOrder(order) {
    throw new Error(`placeOrder() não implementado em ${this.name}`);
  }

  /**
   * Fecha uma posição
   * @param {string} positionId
   * @returns {Object} { success, pnl, error }
   */
  async closePosition(positionId) {
    throw new Error(`closePosition() não implementado em ${this.name}`);
  }

  /**
   * Obtém candles históricos
   * @param {string} pair - ex: "EURUSD"
   * @param {string} timeframe - ex: "H1", "M15"
   * @param {number} count - número de candles
   * @returns {Array} [{ open, high, low, close, volume, time }]
   */
  async getCandles(pair, timeframe, count) {
    throw new Error(`getCandles() não implementado em ${this.name}`);
  }

  /**
   * Obtém o histórico fechado de ordens/negociações
   * @param {Object} filters - ex: { startDate, endDate, limit }
   * @returns {Array} [{ id, pair, direction, lotSize, openPrice, closePrice, openTime, closeTime, pnl, broker }]
   */
  async getHistory(filters = {}) {
    throw new Error(`getHistory() não implementado em ${this.name}`);
  }

  /**
   * Obtem preço atual de um par
   * @param {string} pair
   * @returns {Object} { bid, ask, spread }
   */
  async getPrice(pair) {
    throw new Error(`getPrice() não implementado em ${this.name}`);
  }

  /**
   * Converte nome do par para o formato da corretora
   * @param {string} pair - formato padrão: "EURUSD"
   * @returns {string} formato da corretora
   */
  formatPair(pair) {
    return pair; // override nas subclasses
  }

  /**
   * Converte nome do par da corretora para formato padrão
   * @param {string} brokerPair - formato da corretora
   * @returns {string} formato padrão: "EURUSD"
   */
  normalizePair(brokerPair) {
    return brokerPair; // override nas subclasses
  }

  /**
   * @returns {Object} estado atual simplificado
   */
  getStatus() {
    return {
      broker: this.name,
      type: this.type,
      connected: this.connected,
      accountInfo: this.accountInfo,
    };
  }
}

module.exports = BrokerAdapter;
