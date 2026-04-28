/**
 * ============================================================
 *  APEX SMC — utils/logger.js
 *  Sistema de logs formatados para terminal.
 * ============================================================
 */

const fs = require("fs");
const path = require("path");

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",
  
  fgBlack: "\x1b[30m",
  fgRed: "\x1b[31m",
  fgGreen: "\x1b[32m",
  fgYellow: "\x1b[33m",
  fgBlue: "\x1b[34m",
  fgMagenta: "\x1b[35m",
  fgCyan: "\x1b[36m",
  fgWhite: "\x1b[37m",
  
  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m",
};

const LOG_FILE = path.join(__dirname, "../server_log.txt");

function writeToFile(msg) {
  try {
    const cleanMsg = msg.replace(/\x1b\[[0-9;]*m/g, ""); // Remove ANSI colors
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${cleanMsg}\n`);
  } catch (e) {}
}

const logger = {
  info: (msg) => {
    const out = `${colors.fgCyan}[INFO]${colors.reset} ${msg}`;
    console.log(out);
    writeToFile(out);
  },
  
  success: (msg) => {
    const out = `${colors.fgGreen}[SUCCESS]${colors.reset} ${msg}`;
    console.log(out);
    writeToFile(out);
  },
  
  warn: (msg) => {
    const out = `${colors.fgYellow}[WARN]${colors.reset} ${msg}`;
    console.log(out);
    writeToFile(out);
  },
  
  error: (msg) => {
    const out = `${colors.fgRed}[ERROR]${colors.reset} ${msg}`;
    console.error(out);
    writeToFile(out);
  },
  
  debug: (msg) => {
    if (process.env.DEBUG === "true") {
      const out = `${colors.dim}[DEBUG]${colors.reset} ${msg}`;
      console.log(out);
      writeToFile(out);
    }
  },
  
  signal: (sig) => {
    const color = sig.direction === "BUY" ? colors.fgGreen : colors.fgRed;
    const out = `${colors.bright}${color}[SIGNAL] ${sig.direction} ${sig.pair}${colors.reset} | Lot: ${sig.lotSize} | SL: ${sig.sl} | TP: ${sig.tp} | RR: ${sig.rr}`;
    console.log(out);
    writeToFile(out);
  },
  
  trade: (trade) => {
    const color = trade.pnl >= 0 ? colors.fgGreen : colors.fgRed;
    const out = `${colors.bright}${color}[TRADE CLOSED] ${trade.pair}${colors.reset} | PnL: ${trade.pnl > 0 ? "+" : ""}${trade.pnl} | Reason: ${trade.closeReason}`;
    console.log(out);
    writeToFile(out);
  }
};

module.exports = logger;
