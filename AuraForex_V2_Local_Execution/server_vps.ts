import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import ccxt from 'ccxt';
import { GridStrategy } from './trading/strategies/GridStrategy';
import { TrendStrategy } from './trading/strategies/TrendStrategy';
import { ScalpingStrategy } from './trading/strategies/ScalpingStrategy';
import { MarketMakingStrategy } from './trading/strategies/MarketMakingStrategy';
import { ArbitrageStrategy } from './trading/strategies/ArbitrageStrategy';
import { AIAdaptiveStrategy } from './trading/strategies/AIAdaptiveStrategy';
import { LoopStrategy } from './trading/strategies/LoopStrategy';
import { BotRunner } from './trading/engine/BotRunner';

function generateLicenseKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = 'LIC-';
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (i < 3) key += '-';
  }
  return key;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database('aura_trade.db');
db.pragma('foreign_keys = ON');

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    tier TEXT DEFAULT 'starter',
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'active',
    referral_code TEXT UNIQUE,
    referred_by_id INTEGER,
    language TEXT DEFAULT 'en',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(referred_by_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS commissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    from_user_id INTEGER,
    amount REAL,
    level INTEGER,
    license_purchase_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(from_user_id) REFERENCES users(id),
    FOREIGN KEY(license_purchase_id) REFERENCES user_licenses(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    exchange TEXT,
    api_key TEXT,
    api_secret TEXT,
    passphrase TEXT,
    endpoint_url TEXT,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS strategies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    type TEXT,
    params TEXT,
    is_running BOOLEAN DEFAULT 0,
    profit REAL DEFAULT 0,
    risk_level TEXT DEFAULT 'medium',
    exchange_id INTEGER,
    max_capital REAL,
    daily_loss_limit REAL,
    simultaneous_orders INTEGER DEFAULT 1,
    capital_percentage REAL DEFAULT 10,
    error TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(exchange_id) REFERENCES api_keys(id)
  );

  CREATE TABLE IF NOT EXISTS license_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    price REAL NOT NULL,
    validity_days INTEGER NOT NULL,
    description TEXT,
    promo_text TEXT,
    highlight_tag TEXT,
    is_enabled BOOLEAN DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS user_licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    license_key TEXT UNIQUE,
    activation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    expiration_date DATETIME NOT NULL,
    status TEXT DEFAULT 'PENDING',
    tx_hash TEXT,
    price REAL,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(plan_id) REFERENCES license_plans(id)
  );

  CREATE TABLE IF NOT EXISTS admin_wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL,
    network TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    strategy_id INTEGER,
    symbol TEXT,
    side TEXT,
    order_id TEXT,
    exchange TEXT,
    amount REAL,
    price REAL,
    entry_price REAL,
    exit_price REAL,
    capital_used REAL,
    portfolio_percentage REAL,
    pnl REAL,
    profit REAL,
    profit_percentage REAL,
    fees REAL,
    duration INTEGER,
    status TEXT DEFAULT 'CLOSED',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(strategy_id) REFERENCES strategies(id)
  );

  CREATE TABLE IF NOT EXISTS referral_withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    amount REAL,
    wallet_address TEXT,
    tx_hash TEXT,
    status TEXT DEFAULT 'PENDING',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Migration: Ensure strategies table has the new columns
const tableInfo = db.prepare("PRAGMA table_info(strategies)").all();
const columns = (tableInfo as any[]).map(c => c.name);
if (!columns.includes('exchange_id')) {
  db.exec("ALTER TABLE strategies ADD COLUMN exchange_id INTEGER REFERENCES api_keys(id)");
}
if (!columns.includes('max_capital')) {
  db.exec("ALTER TABLE strategies ADD COLUMN max_capital REAL");
}
if (!columns.includes('daily_loss_limit')) {
  db.exec("ALTER TABLE strategies ADD COLUMN daily_loss_limit REAL");
}

// Migration: Ensure user_licenses table has the license_key column
const licenseTableInfo = db.prepare("PRAGMA table_info(user_licenses)").all();
const licenseColumns = (licenseTableInfo as any[]).map(c => c.name);
if (!licenseColumns.includes('license_key')) {
  try {
    db.exec("ALTER TABLE user_licenses ADD COLUMN license_key TEXT UNIQUE");
  } catch (e) { console.error('Migration error:', e); }
}
if (!licenseColumns.includes('tx_hash')) {
  try {
    db.exec("ALTER TABLE user_licenses ADD COLUMN tx_hash TEXT");
  } catch (e) { console.error('Migration error:', e); }
}
if (!licenseColumns.includes('price')) {
  try {
    db.exec("ALTER TABLE user_licenses ADD COLUMN price REAL");
  } catch (e) { console.error('Migration error:', e); }
}

// Update existing licenses that don't have a key
try {
  const licensesWithoutKey = db.prepare("SELECT id FROM user_licenses WHERE license_key IS NULL").all();
  for (const lic of licensesWithoutKey as any[]) {
    db.prepare("UPDATE user_licenses SET license_key = ? WHERE id = ?").run(generateLicenseKey(), lic.id);
  }
} catch (e) {
  console.warn('License key update skipped (column might not exist yet):', e.message);
}
if (!columns.includes('simultaneous_orders')) {
  db.exec("ALTER TABLE strategies ADD COLUMN simultaneous_orders INTEGER DEFAULT 1");
}

if (!columns.includes('capital_percentage')) {
  db.exec("ALTER TABLE strategies ADD COLUMN capital_percentage REAL DEFAULT 10");
}
if (!columns.includes('ai_intelligence')) {
  db.exec("ALTER TABLE strategies ADD COLUMN ai_intelligence TEXT");
}
if (!columns.includes('auto_select_pairs')) {
  db.exec("ALTER TABLE strategies ADD COLUMN auto_select_pairs BOOLEAN DEFAULT 0");
}

// Migration: Ensure users table has wallet_address, referral_code, etc.
const userTableInfo = db.prepare("PRAGMA table_info(users)").all();
const userColumns = (userTableInfo as any[]).map(c => c.name);
if (!userColumns.includes('wallet_address')) {
  db.exec("ALTER TABLE users ADD COLUMN wallet_address TEXT");
}
if (!userColumns.includes('referral_code')) {
  db.exec("ALTER TABLE users ADD COLUMN referral_code TEXT UNIQUE");
}
if (!userColumns.includes('referred_by_id')) {
  db.exec("ALTER TABLE users ADD COLUMN referred_by_id INTEGER REFERENCES users(id)");
}
if (!userColumns.includes('language')) {
  db.exec("ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'en'");
}
if (!userColumns.includes('status')) {
  db.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'");
}

// Ensure all existing users have a referral code
function generateReferralCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// Migration: Ensure trades table has the new columns
const tradesTableInfo = db.prepare("PRAGMA table_info(trades)").all();
const tradesColumns = (tradesTableInfo as any[]).map((c: any) => c.name);
if (!tradesColumns.includes('price')) {
  db.exec("ALTER TABLE trades ADD COLUMN price REAL");
}
if (!tradesColumns.includes('profit')) {
  db.exec("ALTER TABLE trades ADD COLUMN profit REAL");
}

// Seed Initial Settings
const seedSettings = [
  ['project_name', 'AuraTrade AI'],
  ['support_phone', '+1 (555) 123-4567'],
  ['support_email', 'support@auratrade.ai'],
  ['project_description', 'Autonomous AI-driven SaaS trading platform with machine learning optimization and multi-exchange support.'],
  ['project_logo', 'https://api.dicebear.com/7.x/bottts/svg?seed=AuraTrade'],
  ['login_bg', 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&q=80&w=2000'],
  ['custom_button_enabled', 'false'],
  ['custom_button_label', 'External Site'],
  ['custom_button_url', ''],
  ['custom_button_target', 'iframe'],
  ['landing_hero_title', 'AURA PRECISION'],
  ['landing_hero_subtitle', 'Institutional algorithmic execution for the modern trader. Engineered for sub-millisecond dominance in fragmented markets.'],
  ['landing_button_text', 'CONNECT BOTS'],
  ['landing_logo', ''],
  ['landing_strategies_text', 'Sub-millisecond latency'],
  ['landing_insights_text', '$2.4B+ Monthly'],
  ['landing_ecosystem_text', '99.99% SLA'],
  ['landing_phone', '+1 (555) 123-4567'],
  ['landing_social_twitter', 'https://twitter.com/auratrade'],
  ['landing_social_telegram', 'https://t.me/auratrade'],
  ['landing_social_whatsapp', ''],
  ['landing_social_instagram', ''],
  ['landing_strategies_content', '# Strategies\n\nOur institutional algorithmic execution is engineered for sub-millisecond dominance in fragmented markets.\n\n- **High Frequency**: Optimized for rapid execution.\n- **Neural Networks**: AI-driven trend analysis.\n- **Risk Management**: Advanced stop-loss and take-profit algorithms.'],
  ['landing_insights_content', '# Insights\n\nGain deep market understanding with our advanced analytics and real-time data processing.\n\n- **Market Sentiment**: Real-time analysis of global trends.\n- **Performance Metrics**: Detailed tracking of all active bots.\n- **Predictive Modeling**: Forecast market movements with high accuracy.'],
  ['landing_ecosystem_content', '# Ecosystem\n\nA complete suite of tools designed for the modern trader.\n\n- **Multi-Exchange**: Connect to all major crypto exchanges.\n- **Secure Infrastructure**: 99.99% SLA and institutional-grade security.\n- **Community Driven**: Shared strategies and collaborative insights.']
];

seedSettings.forEach(([key, value]) => {
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(key, value);
});

// Seed Initial License Plans
const seedLicensePlans = [
  { name: 'Starter Bot', price: 49.99, validity_days: 30, description: 'Basic trading features for beginners.', promo_text: '🔥 Best for starters', highlight_tag: 'Popular' },
  { name: 'Pro Trader', price: 149.99, validity_days: 90, description: 'Advanced strategies and multi-exchange support.', promo_text: '⚡ 15% Discount included', highlight_tag: 'Best Value' },
  { name: 'Enterprise AI', price: 499.99, validity_days: 365, description: 'Full autonomous AI trading with priority support.', promo_text: '💎 Unlimited power', highlight_tag: 'Elite' }
];

seedLicensePlans.forEach(p => {
  db.prepare('INSERT OR IGNORE INTO license_plans (name, price, validity_days, description, promo_text, highlight_tag) VALUES (?, ?, ?, ?, ?, ?)').run(
    p.name, p.price, p.validity_days, p.description, p.promo_text, p.highlight_tag
  );
});

// Create Default Admin if not exists
const existingAdmin: any = db.prepare("SELECT * FROM users WHERE email = 'admin@auratrade.ai'").get();
const adminPasswordHash = bcrypt.hashSync('admin123', 10);
if (!existingAdmin) {
  let adminReferralCode = 'ADMIN123';
  db.prepare("INSERT INTO users (email, password, role, tier, referral_code) VALUES ('admin@auratrade.ai', ?, 'admin', 'enterprise', ?)").run(adminPasswordHash, adminReferralCode);
  console.log('Default admin created: admin@auratrade.ai / admin123');
} else {
  // Force reset to default as requested
  db.prepare("UPDATE users SET password = ? WHERE id = ?").run(adminPasswordHash, existingAdmin.id);
  console.log('Admin password reset to default: admin123');
}
const admin: any = db.prepare("SELECT id FROM users WHERE email = 'admin@auratrade.ai'").get();
const adminId = admin.id;

// Give admin a lifetime license for testing if they don't have one
const adminLicense: any = db.prepare(`
  SELECT * FROM user_licenses WHERE user_id = ? AND plan_id = 3
`).get(adminId);

if (!adminLicense) {
  db.prepare(`
    INSERT INTO user_licenses (user_id, plan_id, expiration_date, status) 
    VALUES (?, 3, datetime('now', '+10 years'), 'ACTIVE')
  `).run(adminId);
}



// Ensure all existing users have a referral code
const usersWithoutCode = db.prepare("SELECT id FROM users WHERE referral_code IS NULL OR referral_code = ''").all();
usersWithoutCode.forEach((u: any) => {
  let code = generateReferralCode();
  // Check uniqueness
  while (db.prepare("SELECT id FROM users WHERE referral_code = ?").get(code)) {
    code = generateReferralCode();
  }
  db.prepare("UPDATE users SET referral_code = ? WHERE id = ?").run(code, u.id);
});

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = 3000;

  const broadcast = (data: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  app.use(express.json());
  app.use(cors());

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET || 'secret', (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // API Routes
  app.post('/api/auth/register', async (req, res) => {
    const { email, password, referralCode } = req.body;
    const lowerEmail = email.toLowerCase().trim();
    
    if (!referralCode) {
      return res.status(400).json({ error: 'Referral code is mandatory' });
    }

    const referrer: any = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(referralCode);
    if (!referrer) {
      return res.status(400).json({ error: 'Invalid referral code' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    let myReferralCode = generateReferralCode();
    while (db.prepare("SELECT id FROM users WHERE referral_code = ?").get(myReferralCode)) {
      myReferralCode = generateReferralCode();
    }

    try {
      const result = db.prepare('INSERT INTO users (email, password, referral_code, referred_by_id, language) VALUES (?, ?, ?, ?, ?)').run(lowerEmail, hashedPassword, myReferralCode, referrer.id, req.body.language || 'en');
      const token = jwt.sign({ id: Number(result.lastInsertRowid), email: lowerEmail }, process.env.JWT_SECRET || 'secret');
      res.json({ token, user: { id: result.lastInsertRowid, email: lowerEmail, tier: 'starter', referral_code: myReferralCode, language: req.body.language || 'en' } });
    } catch (e) {
      res.status(400).json({ error: 'Email already exists' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    let lowerEmail = email.toLowerCase().trim();
    if (lowerEmail === 'admin') lowerEmail = 'admin@auratrade.ai';
    console.log(`Login attempt for: ${lowerEmail}`);
    const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(lowerEmail);
    if (user) {
      console.log(`User found in DB. ID: ${user.id}, Role: ${user.role}`);
      console.log(`Password length provided: ${password?.length}`);
      console.log(`Stored hash starts with: ${user.password?.substring(0, 10)}...`);
      
      const isValid = bcrypt.compareSync(password, user.password);
      console.log(`Password comparison result: ${isValid}`);
      
      if (isValid) {
        if (user.status === 'paused') {
          console.log(`Login blocked: User status is paused`);
          return res.status(403).json({ error: 'Your account has been paused. Please contact support.' });
        }
        const token = jwt.sign({ id: user.id, email: lowerEmail, role: user.role }, process.env.JWT_SECRET || 'secret');
        res.json({ token, user: { id: user.id, email: lowerEmail, tier: user.tier, role: user.role, referral_code: user.referral_code, language: user.language, status: user.status } });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } else {
      console.log('User not found for email:', lowerEmail);
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  app.post('/api/user/change-password', authenticateToken, async (req: any, res) => {
    const { currentPassword, newPassword } = req.body;
    console.log(`User ID ${req.user.id} attempting to change password`);
    const user: any = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (user && bcrypt.compareSync(currentPassword, user.password)) {
      console.log('Current password verified. Updating to new password.');
      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      const result = db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.user.id);
      console.log(`Password updated. Rows affected: ${result.changes}`);
      res.json({ message: 'Password updated successfully' });
    } else {
      console.log('Invalid current password provided');
      res.status(400).json({ error: 'Invalid current password' });
    }
  });

  app.get('/api/settings', (req, res) => {
    const settings = db.prepare('SELECT * FROM settings').all();
    const settingsObj = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    res.json(settingsObj);
  });

  app.post('/api/settings', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const updates = req.body;
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    const transaction = db.transaction((data) => {
      for (const [key, value] of Object.entries(data)) {
        stmt.run(key, value);
      }
    });
    transaction(updates);
    res.json({ message: 'Settings updated' });
  });

  app.get('/api/user/profile', authenticateToken, (req: any, res) => {
    const user: any = db.prepare('SELECT id, email, tier, role, referral_code, language FROM users WHERE id = ?').get(req.user.id);
    res.json(user);
  });

  app.patch('/api/user/language', authenticateToken, (req: any, res) => {
    const { language } = req.body;
    if (!['en', 'es', 'fr', 'pt'].includes(language)) {
      return res.status(400).json({ error: 'Invalid language' });
    }
    db.prepare('UPDATE users SET language = ? WHERE id = ?').run(language, req.user.id);
    res.json({ message: 'Language updated successfully' });
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/ticker', async (req, res) => {
    const tickerData = [
      { symbol: 'BTC', price: 68000 + (Math.random() - 0.5) * 1000, change: Number((Math.random() * 5 - 2).toFixed(2)) },
      { symbol: 'ETH', price: 3100 + (Math.random() - 0.5) * 50, change: Number((Math.random() * 4 - 2).toFixed(2)) },
      { symbol: 'BNB', price: 580 + (Math.random() - 0.5) * 10, change: Number((Math.random() * 3 - 1).toFixed(2)) },
      { symbol: 'SOL', price: 145 + (Math.random() - 0.5) * 5, change: Number((Math.random() * 8 - 3).toFixed(2)) },
      { symbol: 'XRP', price: 0.62 + (Math.random() - 0.5) * 0.02, change: Number((Math.random() * 2 - 1).toFixed(2)) },
      { symbol: 'ADA', price: 0.45 + (Math.random() - 0.5) * 0.01, change: Number((Math.random() * 2 - 1).toFixed(2)) },
      { symbol: 'DOGE', price: 0.16 + (Math.random() - 0.5) * 0.005, change: Number((Math.random() * 10 - 4).toFixed(2)) },
    ];
    res.json(tickerData);
  });

  app.get('/api/trades', authenticateToken, (req: any, res) => {
    const { strategy_id } = req.query;
    let query = 'SELECT * FROM trades WHERE user_id = ?';
    const params = [req.user.id];

    if (strategy_id) {
      query += ' AND strategy_id = ?';
      params.push(strategy_id);
    }

    query += ' ORDER BY timestamp DESC LIMIT 100';
    const trades = db.prepare(query).all(...params);
    res.json(trades);
  });

  app.post('/api/strategies/:id/execute', authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    let { symbol, side, amount, type = 'market', price } = req.body;
    symbol = (symbol || 'BTC/USDT').toUpperCase();

    if (symbol === 'AI_OPTIMIZED') {
      const profitablePairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT'];
      symbol = profitablePairs[Math.floor(Math.random() * profitablePairs.length)];
    }
    
    const strategy: any = db.prepare('SELECT * FROM strategies WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!strategy) return res.status(404).json({ error: 'Strategy not found' });
    if (!strategy.is_running) return res.status(400).json({ error: 'Strategy is not running' });

    const userKeys: any = db.prepare('SELECT * FROM api_keys WHERE id = ? AND user_id = ?').get(strategy.exchange_id, req.user.id);
    if (!userKeys || !userKeys.is_active) {
      // Auto-pause strategy if connection is lost
      db.prepare('UPDATE strategies SET is_running = 0 WHERE id = ?').run(id);
      return res.status(400).json({ error: 'Exchange connection lost or inactive. Strategy paused.' });
    }
    
    // Risk Management Checks
    const currentPrice = price || 65000; // Mock current price
    if (strategy.max_capital && amount * currentPrice > strategy.max_capital) {
      return res.status(400).json({ error: `Order size ($${(amount * currentPrice).toFixed(2)}) exceeds max capital limit of $${strategy.max_capital}` });
    }

    // Check daily loss limit
    const today = new Date().toISOString().split('T')[0];
    const dailyStats = db.prepare(`
      SELECT SUM(pnl) as total_pnl FROM trades 
      WHERE strategy_id = ? AND timestamp >= ?
    `).get(id, today) as any;

    if (strategy.daily_loss_limit && dailyStats.total_pnl < -strategy.daily_loss_limit) {
      // Auto-pause if limit reached
      db.prepare('UPDATE strategies SET is_running = 0 WHERE id = ?').run(id);
      return res.status(400).json({ error: `Daily loss limit of $${strategy.daily_loss_limit} reached. Strategy paused for safety.` });
    }

    try {
      let orderId = 'sim-' + Math.random().toString(36).substr(2, 9);
      let entryPrice = price || 65000; // Mock price
      let fees = amount * (price || 65000) * 0.001;
      
      // Real trade execution using CCXT
      if (userKeys && userKeys.api_key && userKeys.api_key !== 'demo_key') {
        try {
          const exchangeClass = (ccxt as any)[userKeys.exchange.toLowerCase()];
          if (exchangeClass) {
            const exchange = new exchangeClass({
              apiKey: userKeys.api_key,
              secret: userKeys.api_secret,
              password: userKeys.passphrase,
              options: { 'adjustForTimeDifference': true },
            });
            
            // Check minimum notional value (Binance usually requires > 10 USDT)
            const ticker = await exchange.fetchTicker(symbol);
            const currentPrice = ticker.last;
            const notional = amount * currentPrice;
            
            if (notional < 10.5) {
              return res.status(400).json({ 
                error: `Order value ($${notional.toFixed(2)}) is below the minimum required by ${userKeys.exchange} (approx. $10.00). Please increase the order amount.` 
              });
            }

            // Execute real market order
            const order = await exchange.createOrder(symbol, 'market', side.toLowerCase(), amount);
            orderId = order.id;
            entryPrice = order.price || order.average || currentPrice;
            fees = order.fee ? order.fee.cost : (amount * entryPrice * 0.001);
          }
        } catch (err: any) {
          let errorMessage = err.message;
          
          // Handle specific Binance error -2015
          if (errorMessage.includes('-2015') || errorMessage.includes('Invalid API-key, IP, or permissions')) {
            errorMessage = `Binance API Error: Invalid API Key, IP whitelisting issue, or missing "Enable Spot & Margin Trading" permission. Please check your Binance API settings.`;
            db.prepare('UPDATE strategies SET is_running = 0 WHERE id = ?').run(id);
            console.log(`Strategy ${id} paused due to Binance authentication/permission error.`);
          }

          console.error('Real trade execution failed:', err);
          return res.status(400).json({ error: `Real trade execution failed: ${errorMessage}` });
        }
      }

      // Record the trade
      const pnl = side === 'SELL' ? (Math.random() * 500 - 100) : 0; // Mock PNL for closed trades
      const profit = side === 'SELL' ? (pnl / (amount * entryPrice) * 100) : 0;
      const profit_percentage = profit;

      db.prepare(`
        INSERT INTO trades (
          user_id, strategy_id, symbol, side, order_id, exchange, 
          amount, price, entry_price, exit_price, capital_used, 
          portfolio_percentage, pnl, profit, profit_percentage, fees, 
          duration, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.user.id, id, symbol, side, orderId, userKeys?.exchange || 'Simulation',
        amount, entryPrice, entryPrice, side === 'SELL' ? entryPrice * 1.02 : null,
        amount * entryPrice, 2.5, pnl, profit, profit_percentage, fees,
        3600, side === 'SELL' ? 'CLOSED' : 'OPEN'
      );

      res.json({ message: 'Order executed', orderId });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/strategies', authenticateToken, (req: any, res) => {
    const { name, type, params, exchange_id, max_capital, daily_loss_limit, simultaneous_orders, capital_percentage, auto_select_pairs } = req.body;
    const result = db.prepare('INSERT INTO strategies (user_id, name, type, params, exchange_id, max_capital, daily_loss_limit, simultaneous_orders, capital_percentage, auto_select_pairs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      req.user.id, name, type, JSON.stringify(params), exchange_id || null, max_capital || null, daily_loss_limit || null, simultaneous_orders || 1, capital_percentage || 10, auto_select_pairs ? 1 : 0
    );
    res.json({ id: result.lastInsertRowid });
  });

  app.get('/api/strategies', authenticateToken, (req: any, res) => {
    const strategies = db.prepare('SELECT * FROM strategies WHERE user_id = ?').all(req.user.id);
    res.json(strategies.map((s: any) => ({ 
      ...s, 
      params: JSON.parse(s.params),
      ai_intelligence: s.ai_intelligence ? JSON.parse(s.ai_intelligence) : null,
      auto_select_pairs: !!s.auto_select_pairs
    })));
  });

  app.get('/api/api-keys', authenticateToken, (req: any, res) => {
    const keys = db.prepare('SELECT id, exchange, api_key, is_active FROM api_keys WHERE user_id = ?').all(req.user.id);
    res.json(keys);
  });

  app.post('/api/api-keys', authenticateToken, (req: any, res) => {
    const { exchange, api_key, api_secret, passphrase, endpoint_url } = req.body;
    const result = db.prepare('INSERT INTO api_keys (user_id, exchange, api_key, api_secret, passphrase, endpoint_url) VALUES (?, ?, ?, ?, ?, ?)').run(
      req.user.id, exchange, api_key?.trim(), api_secret?.trim(), passphrase?.trim() || null, endpoint_url?.trim() || null
    );
    res.json({ id: result.lastInsertRowid });
  });

  app.patch('/api/api-keys/:id', authenticateToken, (req: any, res) => {
    const { id } = req.params;
    const { is_active } = req.body;
    db.prepare('UPDATE api_keys SET is_active = ? WHERE id = ? AND user_id = ?').run(is_active ? 1 : 0, id, req.user.id);
    res.json({ message: 'API key updated' });
  });

  app.delete('/api/api-keys/:id', authenticateToken, (req: any, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
      db.transaction(() => {
        // Find all strategies using this API key
        const strategies = db.prepare('SELECT id FROM strategies WHERE exchange_id = ? AND user_id = ?').all(id, userId) as any[];
        
        for (const strategy of strategies) {
          // Delete trades for each strategy
          db.prepare('DELETE FROM trades WHERE strategy_id = ? AND user_id = ?').run(strategy.id, userId);
        }
        
        // Delete strategies using this API key
        db.prepare('DELETE FROM strategies WHERE exchange_id = ? AND user_id = ?').run(id, userId);
        
        // Finally delete the API key
        db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?').run(id, userId);
      })();
      
      res.json({ message: 'API key and associated strategies/trades deleted' });
    } catch (err: any) {
      console.error('Failed to delete API key:', err);
      res.status(500).json({ error: 'Failed to delete API key: ' + err.message });
    }
  });

  app.patch('/api/strategies/:id', authenticateToken, (req: any, res) => {
    const { id } = req.params;
    const { name, type, is_running, params, exchange_id, max_capital, daily_loss_limit, simultaneous_orders, capital_percentage, auto_select_pairs } = req.body;
    
    const strategy: any = db.prepare('SELECT * FROM strategies WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!strategy) return res.status(404).json({ error: 'Strategy not found' });

    if (is_running === 1) {
      const targetExchangeId = exchange_id || strategy.exchange_id;
      if (!targetExchangeId) {
        return res.status(400).json({ error: 'Please connect an exchange via API before activating this trading strategy.' });
      }
      
      const apiKey: any = db.prepare('SELECT * FROM api_keys WHERE id = ? AND user_id = ?').get(targetExchangeId, req.user.id);
      if (!apiKey || !apiKey.is_active) {
        return res.status(400).json({ error: 'The selected exchange connection is inactive or invalid.' });
      }
    }
    
    if (name !== undefined) {
      db.prepare('UPDATE strategies SET name = ? WHERE id = ? AND user_id = ?').run(name, id, req.user.id);
    }

    if (type !== undefined) {
      db.prepare('UPDATE strategies SET type = ? WHERE id = ? AND user_id = ?').run(type, id, req.user.id);
    }

    if (is_running !== undefined) {
      db.prepare('UPDATE strategies SET is_running = ? WHERE id = ? AND user_id = ?').run(is_running ? 1 : 0, id, req.user.id);
      
      // If starting, execute immediately to fulfill user requirement for immediate start
      if (is_running === 1) {
        const updatedStrategy = db.prepare('SELECT * FROM strategies WHERE id = ?').get(id) as any;
        if (updatedStrategy) {
          if (typeof updatedStrategy.params === 'string') {
            updatedStrategy.params = JSON.parse(updatedStrategy.params || '{}');
          }
          executeStrategy(updatedStrategy).catch(err => {
            console.error(`Immediate execution error for strategy ${id}:`, err);
          });
        }
      }
    }
    
    if (params) {
      db.prepare('UPDATE strategies SET params = ? WHERE id = ? AND user_id = ?').run(JSON.stringify(params), id, req.user.id);
    }

    if (exchange_id !== undefined) {
      db.prepare('UPDATE strategies SET exchange_id = ? WHERE id = ? AND user_id = ?').run(exchange_id, id, req.user.id);
    }

    if (max_capital !== undefined) {
      db.prepare('UPDATE strategies SET max_capital = ? WHERE id = ? AND user_id = ?').run(max_capital, id, req.user.id);
    }

    if (daily_loss_limit !== undefined) {
      db.prepare('UPDATE strategies SET daily_loss_limit = ? WHERE id = ? AND user_id = ?').run(daily_loss_limit, id, req.user.id);
    }

    if (simultaneous_orders !== undefined) {
      db.prepare('UPDATE strategies SET simultaneous_orders = ? WHERE id = ? AND user_id = ?').run(simultaneous_orders, id, req.user.id);
    }

    if (capital_percentage !== undefined) {
      db.prepare('UPDATE strategies SET capital_percentage = ? WHERE id = ? AND user_id = ?').run(capital_percentage, id, req.user.id);
    }

    if (auto_select_pairs !== undefined) {
      db.prepare('UPDATE strategies SET auto_select_pairs = ? WHERE id = ? AND user_id = ?').run(auto_select_pairs ? 1 : 0, id, req.user.id);
    }
    
    broadcast({ type: 'strategy_update' });
    res.json({ message: 'Strategy updated' });
  });

  app.delete('/api/strategies/:id', authenticateToken, (req: any, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
      const deleteStrategy = db.transaction(() => {
        // Delete associated trades first to avoid foreign key constraint error
        db.prepare('DELETE FROM trades WHERE strategy_id = ? AND user_id = ?').run(id, userId);
        // Then delete the strategy
        const result = db.prepare('DELETE FROM strategies WHERE id = ? AND user_id = ?').run(id, userId);
        return result;
      });

      const result = deleteStrategy();

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Strategy not found or unauthorized' });
      }

      broadcast({ type: 'strategy_update' });
      res.json({ message: 'Strategy deleted' });
    } catch (err: any) {
      console.error('Failed to delete strategy:', err);
      res.status(500).json({ error: 'Failed to delete strategy: ' + err.message });
    }
  });

  // --- License Management Routes ---

  app.get('/api/license-plans', authenticateToken, (req, res) => {
    const plans = db.prepare('SELECT * FROM license_plans WHERE is_enabled = 1').all();
    res.json(plans);
  });

  app.get('/api/admin/license-plans', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const plans = db.prepare('SELECT * FROM license_plans').all();
    res.json(plans);
  });

  app.get('/api/admin/license-requests', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || '';
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params: any[] = [];
    if (search) {
      whereClause = 'WHERE u.email LIKE ? OR ul.license_key LIKE ?';
      params = [`%${search}%`, `%${search}%` || ''];
    }

    const total = db.prepare(`
      SELECT COUNT(*) as count 
      FROM user_licenses ul
      JOIN users u ON ul.user_id = u.id
      ${whereClause}
    `).get(...params).count;

    const requests = db.prepare(`
      SELECT ul.*, u.email as user_email, lp.name as plan_name, COALESCE(ul.price, lp.price) as plan_price
      FROM user_licenses ul
      JOIN users u ON ul.user_id = u.id
      JOIN license_plans lp ON ul.plan_id = lp.id
      ${whereClause}
      ORDER BY ul.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    res.json({
      requests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  });

  app.delete('/api/admin/license-requests/:id', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { id } = req.params;
    db.prepare('DELETE FROM user_licenses WHERE id = ?').run(id);
    res.json({ message: 'License deleted successfully' });
  });

  app.post('/api/admin/manual-activate', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { userEmail, planId, durationDays, value } = req.body;
    const purchasePrice = parseFloat(value || 0);

    const user: any = db.prepare('SELECT id, tier FROM users WHERE email = ?').get(userEmail);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let tierName = user.tier;
    let finalPlanId = planId;

    if (planId) {
      const plan: any = db.prepare('SELECT * FROM license_plans WHERE id = ?').get(planId);
      if (!plan) return res.status(404).json({ error: 'Plan not found' });
      tierName = plan.name;
    } else {
      finalPlanId = 1;
      if (!tierName || tierName === 'starter') tierName = 'Custom Plan';
    }

    // Calculate expiration date: add to existing if active, otherwise from now
    const existingLicense: any = db.prepare(`
      SELECT expiration_date FROM user_licenses 
      WHERE user_id = ? AND status = 'ACTIVE' AND expiration_date > datetime('now')
      ORDER BY expiration_date DESC LIMIT 1
    `).get(user.id);

    let startDate = new Date();
    if (existingLicense) {
      startDate = new Date(existingLicense.expiration_date);
    }
    
    const expirationDate = new Date(startDate);
    expirationDate.setDate(expirationDate.getDate() + parseInt(durationDays));

    const result = db.prepare(`
      INSERT INTO user_licenses (user_id, plan_id, license_key, activation_date, expiration_date, status, tx_hash, price)
      VALUES (?, ?, ?, datetime('now'), ?, 'ACTIVE', 'MANUAL', ?)
    `).run(user.id, finalPlanId, generateLicenseKey(), expirationDate.toISOString(), purchasePrice);

    const licenseId = result.lastInsertRowid;

    // Update user tier
    db.prepare('UPDATE users SET tier = ? WHERE id = ?').run(tierName, user.id);

    // Handle commissions if price > 0
    if (purchasePrice > 0) {
      const commissionRates = [0.06, 0.04, 0.02, 0.01, 0.01];
      let currentUserId = user.id;
      
      for (let level = 1; level <= 5; level++) {
        const referrer: any = db.prepare('SELECT referred_by_id FROM users WHERE id = ?').get(currentUserId);
        if (!referrer || !referrer.referred_by_id) break;
        
        const referrerId = referrer.referred_by_id;
        const commissionAmount = purchasePrice * commissionRates[level - 1];

        db.prepare(`
          INSERT INTO commissions (user_id, from_user_id, amount, level, license_purchase_id)
          VALUES (?, ?, ?, ?, ?)
        `).run(referrerId, user.id, commissionAmount, level, licenseId);
        
        currentUserId = referrerId;
      }
    }

    broadcast({ type: 'license_update' });
    res.json({ message: 'License activated manually' });
  });

  app.patch('/api/admin/license-requests/:id', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { id } = req.params;
    const { status } = req.body; // 'ACTIVE', 'REJECTED', 'PENDING'

    if (!['ACTIVE', 'REJECTED', 'PENDING'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const license: any = db.prepare('SELECT * FROM user_licenses WHERE id = ?').get(id);
    if (!license) return res.status(404).json({ error: 'License request not found' });

    const oldStatus = license.status;
    
    // If changing to ACTIVE and it wasn't ACTIVE before, calculate dates and handle referral commissions
    if (status === 'ACTIVE' && oldStatus !== 'ACTIVE') {
      const plan: any = db.prepare('SELECT * FROM license_plans WHERE id = ?').get(license.plan_id);
      
      // Calculate new dates
      const existingLicense: any = db.prepare(`
        SELECT * FROM user_licenses WHERE user_id = ? AND status = 'ACTIVE' AND expiration_date > datetime('now')
        ORDER BY expiration_date DESC LIMIT 1
      `).get(license.user_id);

      let activationDate = "datetime('now')";
      let expirationDateBase = "datetime('now')";
      
      if (existingLicense) {
        activationDate = `'${existingLicense.expiration_date}'`;
        expirationDateBase = `'${existingLicense.expiration_date}'`;
      }

      db.prepare(`
        UPDATE user_licenses 
        SET status = ?, activation_date = datetime(${activationDate}), expiration_date = datetime(${expirationDateBase}, '+${plan.validity_days} days'), price = ?
        WHERE id = ?
      `).run(status, plan.price, id);

      // Update user tier
      db.prepare('UPDATE users SET tier = ? WHERE id = ?').run(plan.name, license.user_id);

      // Handle commissions
      const commissionRates = [0.06, 0.04, 0.02, 0.01, 0.01];
      let currentUserId = license.user_id;
      
      for (let level = 1; level <= 5; level++) {
        const user: any = db.prepare('SELECT referred_by_id FROM users WHERE id = ?').get(currentUserId);
        if (!user || !user.referred_by_id) break;
        
        const referrerId = user.referred_by_id;
        const commissionAmount = plan.price * commissionRates[level - 1];

        // Check if commission already exists for this purchase to avoid duplicates
        const existingCommission = db.prepare('SELECT id FROM commissions WHERE user_id = ? AND from_user_id = ? AND license_purchase_id = ?').get(referrerId, license.user_id, id);
        
        if (!existingCommission) {
          db.prepare(`
            INSERT INTO commissions (user_id, from_user_id, amount, level, license_purchase_id)
            VALUES (?, ?, ?, ?, ?)
          `).run(referrerId, license.user_id, commissionAmount, level, id);
        }
        
        currentUserId = referrerId;
      }
    } else if (status === 'PENDING') {
      const plan: any = db.prepare('SELECT * FROM license_plans WHERE id = ?').get(license.plan_id);
      db.prepare(`
        UPDATE user_licenses 
        SET status = ?, activation_date = datetime('now'), expiration_date = datetime('now', '+${plan.validity_days} days')
        WHERE id = ?
      `).run(status, id);
    } else {
      db.prepare('UPDATE user_licenses SET status = ? WHERE id = ?').run(status, id);
    }

    broadcast({ type: 'license_update' });
    res.json({ success: true });
  });

  app.get('/api/admin/wallets', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const wallets = db.prepare('SELECT * FROM admin_wallets ORDER BY created_at DESC').all();
    res.json(wallets);
  });

  app.post('/api/admin/wallets', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { address, network } = req.body;
    if (!address || !network) return res.status(400).json({ error: 'Missing fields' });
    
    db.prepare('INSERT INTO admin_wallets (address, network) VALUES (?, ?)').run(address, network);
    broadcast({ type: 'wallet_update' });
    res.json({ success: true });
  });

  app.delete('/api/admin/wallets/:id', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    db.prepare('DELETE FROM admin_wallets WHERE id = ?').run(req.params.id);
    broadcast({ type: 'wallet_update' });
    res.json({ success: true });
  });

  app.get('/api/wallets', authenticateToken, (req: any, res) => {
    const wallets = db.prepare('SELECT * FROM admin_wallets WHERE is_active = 1').all();
    res.json(wallets);
  });

  app.post('/api/admin/license-plans', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { name, price, validity_days, description, promo_text, highlight_tag, is_enabled } = req.body;
    const result = db.prepare(`
      INSERT INTO license_plans (name, price, validity_days, description, promo_text, highlight_tag, is_enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, price, validity_days, description, promo_text, highlight_tag, is_enabled ? 1 : 0);
    broadcast({ type: 'plan_update' });
    res.json({ id: result.lastInsertRowid });
  });

  app.patch('/api/admin/license-plans/:id', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { id } = req.params;
    const { name, price, validity_days, description, promo_text, highlight_tag, is_enabled } = req.body;
    db.prepare(`
      UPDATE license_plans 
      SET name = ?, price = ?, validity_days = ?, description = ?, promo_text = ?, highlight_tag = ?, is_enabled = ?
      WHERE id = ?
    `).run(name, price, validity_days, description, promo_text, highlight_tag, is_enabled ? 1 : 0, id);
    broadcast({ type: 'plan_update' });
    res.json({ message: 'License plan updated' });
  });

  app.delete('/api/admin/license-plans/:id', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { id } = req.params;
    
    // Check if any user is using this plan
    const usage = db.prepare('SELECT COUNT(*) as count FROM user_licenses WHERE plan_id = ?').get(id) as any;
    if (usage.count > 0) {
      return res.status(400).json({ error: 'Cannot delete plan that is in use by users. Disable it instead.' });
    }

    db.prepare('DELETE FROM license_plans WHERE id = ?').run(id);
    broadcast({ type: 'plan_update' });
    res.json({ message: 'License plan deleted' });
  });

  app.get('/api/user/license', authenticateToken, (req: any, res) => {
    // Prioritize ACTIVE license, then PENDING
    const license = db.prepare(`
      SELECT ul.*, lp.name as plan_name, lp.validity_days
      FROM user_licenses ul
      JOIN license_plans lp ON ul.plan_id = lp.id
      WHERE ul.user_id = ? AND ul.status IN ('ACTIVE', 'PENDING')
      ORDER BY CASE WHEN ul.status = 'ACTIVE' THEN 0 ELSE 1 END, ul.expiration_date DESC LIMIT 1
    `).get(req.user.id);
    res.json(license || null);
  });

  app.get('/api/user/license-history', authenticateToken, (req: any, res) => {
    const history = db.prepare(`
      SELECT ul.*, lp.name as plan_name, lp.validity_days, COALESCE(ul.price, lp.price) as price
      FROM user_licenses ul
      JOIN license_plans lp ON ul.plan_id = lp.id
      WHERE ul.user_id = ?
      ORDER BY ul.id DESC
    `).all(req.user.id);
    res.json(history);
  });

  app.post('/api/user/purchase-license', authenticateToken, (req: any, res) => {
    const { planId, txHash } = req.body;
    if (!txHash) return res.status(400).json({ error: 'Transaction hash is required' });

    const plan: any = db.prepare('SELECT * FROM license_plans WHERE id = ?').get(planId);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    // Insert with placeholder dates, status PENDING
    db.prepare(`
      INSERT INTO user_licenses (user_id, plan_id, license_key, activation_date, expiration_date, status, tx_hash)
      VALUES (?, ?, ?, NULL, datetime('now', '+${plan.validity_days} days'), 'PENDING', ?)
    `).run(req.user.id, planId, generateLicenseKey(), txHash);

    broadcast({ type: 'license_update' });
    res.json({ success: true, message: 'License purchase request submitted. Waiting for approval.' });
  });

  const activeBots = new Map<number, BotRunner>();

  app.post('/api/bot/start', authenticateToken, async (req: any, res) => {
    const { exchangeId, apiKey, apiSecret, symbol } = req.body;
    const userId = req.user.id;
    
    if (!exchangeId || !apiKey || !apiSecret) {
      return res.status(400).json({ error: 'Missing exchange credentials' });
    }

    try {
      if (!ccxt.exchanges.includes(exchangeId)) {
        return res.status(400).json({ error: 'Invalid exchange ID' });
      }

      // Stop existing bot for this user if any
      if (activeBots.has(userId)) {
        activeBots.get(userId)?.stop();
      }

      // @ts-ignore
      const exchange = new ccxt[exchangeId]({
        apiKey,
        secret: apiSecret,
        enableRateLimit: true,
      });

      const config = {
        strategy: "GRID",
        symbol: symbol || "BTC/USDT",
        upper_limit: 110,
        lower_limit: 90,
        grid_count: 10,
        amount: 0.01
      };

      const bot = new BotRunner({ exchange }, config);
      activeBots.set(userId, bot);
      
      // Run in background
      bot.start().catch(err => {
        console.error(`Bot execution error for user ${userId}:`, err);
        activeBots.delete(userId);
      });

      res.json({ success: true, message: 'Bot started' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/bot/stop', authenticateToken, (req: any, res) => {
    const userId = req.user.id;
    if (activeBots.has(userId)) {
      activeBots.get(userId)?.stop();
      activeBots.delete(userId);
      res.json({ success: true, message: 'Bot stopped' });
    } else {
      res.status(400).json({ error: 'No active bot for this user' });
    }
  });

  app.get('/api/referrals/stats', authenticateToken, (req: any, res) => {
    const user: any = db.prepare('SELECT referral_code, wallet_address FROM users WHERE id = ?').get(req.user.id);
    const totalEarnings = db.prepare('SELECT SUM(amount) as total FROM commissions WHERE user_id = ?').get(req.user.id) as any;
    const totalWithdrawn = db.prepare("SELECT SUM(amount) as total FROM referral_withdrawals WHERE user_id = ? AND status IN ('COMPLETED', 'PENDING')").get(req.user.id) as any;
    const totalPaid = db.prepare("SELECT SUM(amount) as total FROM referral_withdrawals WHERE user_id = ? AND status = 'COMPLETED'").get(req.user.id) as any;
    
    // Team Business Volume (Total license purchases in 5 levels)
    // We need to find all users in 5 levels and sum their purchases
    let teamUserIds: number[] = [req.user.id];
    let allTeamIds: number[] = [];
    let levelBreakdown: any[] = [];

    for (let level = 1; level <= 5; level++) {
      if (teamUserIds.length === 0) {
        levelBreakdown.push({ level, count: 0, volume: 0 });
        continue;
      }
      
      const placeholders = teamUserIds.map(() => '?').join(',');
      const levelUsers = db.prepare(`SELECT id FROM users WHERE referred_by_id IN (${placeholders})`).all(...teamUserIds) as any[];
      const levelIds = levelUsers.map(u => u.id);
      
      if (levelIds.length > 0) {
        const idPlaceholders = levelIds.map(() => '?').join(',');
        const volume = db.prepare(`
          SELECT SUM(COALESCE(ul.price, lp.price)) as total 
          FROM user_licenses ul
          JOIN license_plans lp ON ul.plan_id = lp.id
          WHERE ul.user_id IN (${idPlaceholders})
        `).get(...levelIds) as any;
        
        levelBreakdown.push({ level, count: levelIds.length, volume: volume.total || 0 });
        allTeamIds = [...allTeamIds, ...levelIds];
      } else {
        levelBreakdown.push({ level, count: 0, volume: 0 });
      }
      
      teamUserIds = levelIds;
    }

    const totalVolume = levelBreakdown.reduce((acc, curr) => acc + curr.volume, 0);

    res.json({
      referralCode: user.referral_code,
      walletAddress: user.wallet_address,
      totalEarnings: totalEarnings.total || 0,
      totalWithdrawn: totalPaid.total || 0,
      availableBalance: (totalEarnings.total || 0) - (totalWithdrawn.total || 0),
      totalVolume,
      levelBreakdown
    });
  });

  app.get('/api/referrals/withdrawals', authenticateToken, (req: any, res) => {
    const withdrawals = db.prepare('SELECT * FROM referral_withdrawals WHERE user_id = ? ORDER BY timestamp DESC').all(req.user.id);
    res.json(withdrawals);
  });

  app.post('/api/referrals/withdraw', authenticateToken, (req: any, res) => {
    const { amount, walletAddress, txHash } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    // Check balance
    const totalEarnings = db.prepare('SELECT SUM(amount) as total FROM commissions WHERE user_id = ?').get(req.user.id) as any;
    const totalWithdrawn = db.prepare("SELECT SUM(amount) as total FROM referral_withdrawals WHERE user_id = ? AND status IN ('COMPLETED', 'PENDING')").get(req.user.id) as any;
    
    const available = (totalEarnings.total || 0) - (totalWithdrawn.total || 0);
    
    if (amount > available) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Update user's wallet address if not set
    db.prepare('UPDATE users SET wallet_address = ? WHERE id = ?').run(walletAddress, req.user.id);

    // Create withdrawal record
    // In a real system, we'd verify the txHash on-chain here or later via a worker
    const result = db.prepare(`
      INSERT INTO referral_withdrawals (user_id, amount, wallet_address, tx_hash, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, amount, walletAddress, txHash || 'PENDING_ON_CHAIN', txHash ? 'COMPLETED' : 'PENDING');

    res.json({ message: 'Withdrawal initiated', id: result.lastInsertRowid });
  });

  // Admin routes for withdrawals
  app.get('/api/admin/referrals/withdrawals', authenticateToken, (req: any, res) => {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id) as any;
    if (user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const withdrawals = db.prepare(`
      SELECT rw.*, u.email as user_email 
      FROM referral_withdrawals rw
      JOIN users u ON rw.user_id = u.id
      ORDER BY rw.timestamp DESC
    `).all();
    res.json(withdrawals);
  });

  app.patch('/api/admin/referrals/withdrawals/:id', authenticateToken, (req: any, res) => {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id) as any;
    if (user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const { status, txHash } = req.body;
    db.prepare('UPDATE referral_withdrawals SET status = ?, tx_hash = ? WHERE id = ?').run(status, txHash, req.params.id);
    broadcast({ type: 'wallet_update' });
    res.json({ message: 'Withdrawal updated' });
  });

  app.get('/api/admin/financial-stats', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    
    const { day, month, year } = req.query;
    
    let revenueQuery = `
      SELECT SUM(COALESCE(ul.price, lp.price)) as total_revenue
      FROM user_licenses ul
      JOIN license_plans lp ON ul.plan_id = lp.id
      WHERE ul.status = 'ACTIVE'
    `;
    
    let commissionsQuery = `
      SELECT SUM(amount) as total_commissions
      FROM commissions
      WHERE 1=1
    `;

    let withdrawalsQuery = `
      SELECT SUM(amount) as total_withdrawals
      FROM referral_withdrawals
      WHERE status = 'COMPLETED'
    `;

    let licenseHistoryQuery = `
      SELECT ul.*, u.email as user_email, lp.name as plan_name, COALESCE(ul.price, lp.price) as plan_price
      FROM user_licenses ul
      JOIN users u ON ul.user_id = u.id
      JOIN license_plans lp ON ul.plan_id = lp.id
      WHERE ul.status = 'ACTIVE'
    `;

    let withdrawalHistoryQuery = `
      SELECT rw.*, u.email as user_email
      FROM referral_withdrawals rw
      JOIN users u ON rw.user_id = u.id
      WHERE rw.status = 'COMPLETED'
    `;
    
    const params: any[] = [];
    if (year) {
      revenueQuery += ` AND strftime('%Y', ul.activation_date) = ?`;
      commissionsQuery += ` AND strftime('%Y', timestamp) = ?`;
      withdrawalsQuery += ` AND strftime('%Y', timestamp) = ?`;
      licenseHistoryQuery += ` AND strftime('%Y', ul.activation_date) = ?`;
      withdrawalHistoryQuery += ` AND strftime('%Y', timestamp) = ?`;
      params.push(year.toString());
    }
    if (month) {
      revenueQuery += ` AND strftime('%m', ul.activation_date) = ?`;
      commissionsQuery += ` AND strftime('%m', timestamp) = ?`;
      withdrawalsQuery += ` AND strftime('%m', timestamp) = ?`;
      licenseHistoryQuery += ` AND strftime('%m', ul.activation_date) = ?`;
      withdrawalHistoryQuery += ` AND strftime('%m', timestamp) = ?`;
      params.push(month.toString().padStart(2, '0'));
    }
    if (day) {
      revenueQuery += ` AND strftime('%d', ul.activation_date) = ?`;
      commissionsQuery += ` AND strftime('%d', timestamp) = ?`;
      withdrawalsQuery += ` AND strftime('%d', timestamp) = ?`;
      licenseHistoryQuery += ` AND strftime('%d', ul.activation_date) = ?`;
      withdrawalHistoryQuery += ` AND strftime('%d', timestamp) = ?`;
      params.push(day.toString().padStart(2, '0'));
    }

    const revenue = db.prepare(revenueQuery).get(...params) as any;
    const commissions = db.prepare(commissionsQuery).get(...params) as any;
    const withdrawals = db.prepare(withdrawalsQuery).get(...params) as any;
    const licenseHistory = db.prepare(licenseHistoryQuery).all(...params);
    const withdrawalHistory = db.prepare(withdrawalHistoryQuery).all(...params);

    const totalRevenue = revenue.total_revenue || 0;
    const totalCommissions = commissions.total_commissions || 0;
    const totalWithdrawals = withdrawals.total_withdrawals || 0;

    res.json({
      revenue: totalRevenue,
      commissions: totalCommissions,
      withdrawals: totalWithdrawals,
      balance: totalRevenue - totalWithdrawals,
      licenseHistory,
      withdrawalHistory
    });
  });

  // User Management Routes
  app.get('/api/admin/users', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const users = db.prepare('SELECT id, email, tier, role, status, referral_code, created_at FROM users ORDER BY created_at DESC').all();
    res.json(users);
  });

  app.patch('/api/admin/users/:id', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { id } = req.params;
    const { role, status, tier } = req.body;
    
    if (role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
    if (status) db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);
    if (tier) db.prepare('UPDATE users SET tier = ? WHERE id = ?').run(tier, id);
    
    res.json({ success: true });
  });

  app.post('/api/admin/users/:id/reset-password', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { id } = req.params;
    const { newPassword } = req.body;
    console.log(`Admin resetting password for user ID: ${id}`);
    console.log(`New password length: ${newPassword?.length}`);
    
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    console.log(`New hash starts with: ${hashedPassword.substring(0, 10)}...`);
    
    const result = db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, Number(id));
    console.log(`Password updated in DB. Rows affected: ${result.changes}`);
    
    res.json({ success: true });
  });

  app.get('/api/admin/users/:id/network', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { id } = req.params;
    
    let teamUserIds: number[] = [Number(id)];
    let teamMembers: any[] = [];

    for (let level = 1; level <= 5; level++) {
      if (teamUserIds.length === 0) break;
      
      const placeholders = teamUserIds.map(() => '?').join(',');
      const levelUsers = db.prepare(`
        SELECT id, email, created_at 
        FROM users 
        WHERE referred_by_id IN (${placeholders})
      `).all(...teamUserIds) as any[];
      
      const levelIds = levelUsers.map(u => u.id);
      
      levelUsers.forEach(u => {
        teamMembers.push({
          id: u.id,
          email: u.email,
          joinedAt: u.created_at,
          level
        });
      });
      
      teamUserIds = levelIds;
    }
    res.json(teamMembers);
  });

  app.get('/api/referrals/team', authenticateToken, (req: any, res) => {
    // Return a flat list of team members with their level
    let teamUserIds: number[] = [req.user.id];
    let teamMembers: any[] = [];

    for (let level = 1; level <= 5; level++) {
      if (teamUserIds.length === 0) break;
      
      const placeholders = teamUserIds.map(() => '?').join(',');
      const levelUsers = db.prepare(`
        SELECT id, email, created_at 
        FROM users 
        WHERE referred_by_id IN (${placeholders})
      `).all(...teamUserIds) as any[];
      
      const levelIds = levelUsers.map(u => u.id);
      
      levelUsers.forEach(u => {
        const volume = db.prepare(`
          SELECT SUM(COALESCE(ul.price, lp.price)) as total 
          FROM user_licenses ul
          JOIN license_plans lp ON ul.plan_id = lp.id
          WHERE ul.user_id = ?
        `).get(u.id) as any;
        
        teamMembers.push({
          id: u.id,
          email: u.email,
          joinedAt: u.created_at,
          level,
          volume: volume.total || 0
        });
      });
      
      teamUserIds = levelIds;
    }

    res.json(teamMembers);
  });

  app.get('/api/exchanges/balance', authenticateToken, async (req: any, res) => {
    const { exchangeId } = req.query;
    const userKeys: any = db.prepare('SELECT * FROM api_keys WHERE user_id = ? AND exchange = ? AND is_active = 1').get(req.user.id, exchangeId);
    
    if (!userKeys) {
      // Mock balance if no keys
      return res.json({ 
        BTC: 0.5, 
        ETH: 12.4, 
        USDT: 15000.0,
        total: 15000.0,
        info: 'Demo Balance'
      });
    }

    try {
      const exchangeClass = (ccxt as any)[exchangeId];
      if (!exchangeClass) throw new Error('Unsupported exchange');

      const exchange = new exchangeClass({
        apiKey: userKeys.api_key,
        secret: userKeys.api_secret,
        password: userKeys.passphrase,
        options: { 'adjustForTimeDifference': true },
      });

      if (userKeys.api_key === 'demo_key') {
        return res.json({ 
          BTC: 0.5, 
          ETH: 12.4, 
          USDT: 15000.0,
          total: 15000.0,
          info: 'Demo Balance'
        });
      }

      const balance = await exchange.fetchBalance();
      res.json(balance.total);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/exchanges/info', (req, res) => {
    const exchanges = [
      { id: 'binance', name: 'Binance', logo: 'https://cryptologos.cc/logos/binance-coin-bnb-logo.svg', requiresPassphrase: false },
      { id: 'kucoin', name: 'KuCoin', logo: 'https://cryptologos.cc/logos/kucoin-token-kcs-logo.svg', requiresPassphrase: true },
      { id: 'bybit', name: 'Bybit', logo: 'https://cryptologos.cc/logos/bybit-logo.svg', requiresPassphrase: false },
      { id: 'okx', name: 'OKX', logo: 'https://cryptologos.cc/logos/okx-logo.svg', requiresPassphrase: true },
      { id: 'kraken', name: 'Kraken', logo: 'https://cryptologos.cc/logos/kraken-logo.svg', requiresPassphrase: false },
      { id: 'gateio', name: 'Gate.io', logo: 'https://cryptologos.cc/logos/gate-io-logo.svg', requiresPassphrase: false },
    ];
    res.json(exchanges);
  });

  app.post('/api/api-keys/verify', authenticateToken, async (req: any, res) => {
    const { exchange: exchangeId, api_key, api_secret, passphrase } = req.body;
    
    try {
      const exchangeClass = (ccxt as any)[exchangeId.toLowerCase()];
      if (!exchangeClass) return res.status(400).json({ error: 'Unsupported exchange' });

      const exchange = new exchangeClass({
        apiKey: api_key,
        secret: api_secret,
        password: passphrase,
        options: { 'adjustForTimeDifference': true },
      });

      // 1. Validate credentials by fetching balance
      await exchange.fetchBalance();
      
      // 2. Check permissions (Read Trade History)
      try {
        await exchange.fetchMyTrades(undefined, undefined, 1);
      } catch (e) {
        // Some exchanges might not have trades yet, but we check if it's a permission error
        if (e instanceof ccxt.PermissionDenied) {
          throw new Error('API Key does not have "Read Trade History" permission');
        }
      }

      // Security requirement: Check for withdrawal permissions if possible
      // This is exchange-specific. For now, we'll do a generic check if the exchange has withdrawal capabilities
      // and warn the user to ensure it's disabled.
      
      res.json({ 
        success: true, 
        message: 'Exchange connected successfully',
        withdrawalWarning: false 
      });
    } catch (e: any) {
      console.error('Exchange verification failed:', e);
      let errorMessage = e.message || 'API Connection Error';
      
      // Specific handling for common exchange errors
      if (errorMessage.includes('Invalid Api-Key ID') || errorMessage.includes('-2008')) {
        errorMessage = 'Invalid Binance API Key ID. Please ensure you have copied the correct API Key from your Binance account settings.';
      } else if (errorMessage.includes('Signature for this request is not valid') || errorMessage.includes('-1022')) {
        errorMessage = 'Invalid Binance API Secret. Please ensure you have copied the correct Secret Key.';
      } else if (errorMessage.includes('AuthenticationError')) {
        errorMessage = 'Authentication failed. Please check your API key and secret.';
      } else if (errorMessage.includes('PermissionDenied')) {
        errorMessage = 'API Key does not have the required permissions (Read/Trade).';
      }
      
      res.status(400).json({ error: errorMessage });
    }
  });

  // --- Strategy Execution Engine ---
  
  const strategyIntervals: { [key: number]: NodeJS.Timeout } = {};

  async function executeStrategy(strategy: any) {
    if (!strategy.is_running) return;

    const userKeys = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(strategy.exchange_id) as any;
    if (!userKeys || !userKeys.is_active) {
      db.prepare('UPDATE strategies SET is_running = 0 WHERE id = ?').run(strategy.id);
      return;
    }

    // Safety Checks
    // 1. User License Check (Mocked for now)
    const user = db.prepare('SELECT tier FROM users WHERE id = ?').get(strategy.user_id) as any;
    if (!user) return;

    // 2. Trading Gas Fee Check (Mocked)
    const gasBalance = 100; // Mocked gas balance
    if (gasBalance < 1) {
      db.prepare('UPDATE strategies SET is_running = 0 WHERE id = ?').run(strategy.id);
      console.log(`Strategy ${strategy.id} paused: Insufficient Gas Fee balance`);
      return;
    }

    // 3. License Check
    const activeLicense = db.prepare(`
      SELECT * FROM user_licenses 
      WHERE user_id = ? AND status = 'ACTIVE' AND expiration_date > datetime('now')
      ORDER BY expiration_date DESC LIMIT 1
    `).get(strategy.user_id) as any;

    if (!activeLicense) {
      // We don't pause it in the DB anymore, just skip this execution cycle.
      // This allows "automatic start/stop" when license is renewed.
      return;
    }

    const params = strategy.params;
    let symbol = (params.symbol || 'BTC/USDT').toUpperCase();

    // Symbol Normalization (e.g., USDT/BTC -> BTC/USDT)
    const normalizeSymbol = (s: string) => {
      const commonQuotes = ['USDT', 'BUSD', 'USDC', 'BTC', 'ETH', 'BNB'];
      const parts = s.split('/');
      if (parts.length === 2) {
        const [base, quote] = parts;
        // If the base is a common quote and quote is not, it's likely inverted
        if (commonQuotes.includes(base) && !commonQuotes.includes(quote)) {
          return `${quote}/${base}`;
        }
        // Specific common inversion
        if (base === 'USDT' && quote === 'BTC') return 'BTC/USDT';
      }
      return s;
    };
    symbol = normalizeSymbol(symbol);
    params.symbol = symbol; // Persist normalized symbol
    
    // AI Auto Select Pairs or AI_OPTIMIZED symbol
    if (strategy.auto_select_pairs || symbol === 'AI_OPTIMIZED') {
      const profitablePairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT'];
      // In a real AI engine, we'd analyze volume, liquidity, etc.
      // For now, we pick one randomly or based on some simple logic
      symbol = profitablePairs[Math.floor(Math.random() * profitablePairs.length)];
      params.symbol = symbol; // Update symbol in params for monitoring
    }

    const exchangeId = userKeys.exchange.toLowerCase();
    
    try {
      let isSimulation = false;
      const exchangeClass = (ccxt as any)[exchangeId];
      if (!exchangeClass) {
        console.warn(`Exchange ${exchangeId} not found in CCXT for strategy ${strategy.id}`);
        isSimulation = true;
      }

      let exchange: any = null;

      if (!isSimulation && exchangeClass && userKeys.api_key && userKeys.api_key !== 'demo_key') {
        try {
          exchange = new exchangeClass({
            apiKey: userKeys.api_key,
            secret: userKeys.api_secret,
            password: userKeys.passphrase,
            options: { 'adjustForTimeDifference': true },
          });
          // Test connection
          await exchange.fetchBalance();
          // Clear previous error if successful
          db.prepare('UPDATE strategies SET error = NULL WHERE id = ?').run(strategy.id);
        } catch (err: any) {
          const errMsg = `Real exchange connection failed: ${err.message}`;
          console.warn(`Strategy ${strategy.id} fallback to simulation:`, errMsg);
          db.prepare('UPDATE strategies SET error = ? WHERE id = ?').run(errMsg, strategy.id);
          broadcast({ type: 'strategy_update' });
          isSimulation = true;
        }
      } else {
        isSimulation = true;
        // If it's a demo key, clear error as it's intentional simulation
        if (userKeys.api_key === 'demo_key') {
          db.prepare('UPDATE strategies SET error = NULL WHERE id = ?').run(strategy.id);
        }
      }

      let currentPrice = 65000; // Default fallback
      if (!isSimulation && exchange) {
        try {
          const ticker = await exchange.fetchTicker(symbol);
          currentPrice = ticker.last;
        } catch (err) {
          console.warn(`Ticker fetch failed for ${symbol}, using mock price`);
          currentPrice = symbol.includes('ETH') ? 3500 : symbol.includes('SOL') ? 145 : 65000;
        }
      } else {
        currentPrice = symbol.includes('ETH') ? 3500 : symbol.includes('SOL') ? 145 : 65000;
        currentPrice += (Math.random() - 0.5) * 100;
      }

      const dbLogger = {
        logTrade: (side: string, amount: number, price: number, orderId: string, exchangeName: string = isSimulation ? 'Simulation' : userKeys.exchange) => {
          db.prepare(`
            INSERT INTO trades (user_id, strategy_id, symbol, side, order_id, exchange, amount, price, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(strategy.user_id, strategy.id, symbol, side.toUpperCase(), orderId, exchangeName, amount, price, 'OPEN');
          broadcast({ type: 'trade_update' });
        },
        closeTrade: (orderId: string, exitPrice: number) => {
          const trade = db.prepare('SELECT * FROM trades WHERE order_id = ?').get(orderId) as any;
          if (trade) {
            const profit = trade.side === 'BUY' ? (exitPrice - trade.price) * trade.amount : (trade.price - exitPrice) * trade.amount;
            const profit_percentage = (profit / (trade.price * trade.amount)) * 100;
            db.prepare(`
              UPDATE trades 
              SET exit_price = ?, profit = ?, profit_percentage = ?, status = 'CLOSED' 
              WHERE order_id = ?
            `).run(exitPrice, profit, profit_percentage, orderId);
            broadcast({ type: 'trade_update' });
          }
        }
      };

      const createWrappedExchange = (ex: any, name: string, isSim: boolean, priceOffset: number = 0) => {
        const adjustAmount = async (amt: number, prc: number, side: 'buy' | 'sell', s: string) => {
          const minNotional = 10.5; // Increased buffer to avoid Binance NOTIONAL filter failure
          let finalAmt = amt;

          if (isSim) return finalAmt;

          try {
            const balance = await ex.fetchBalance();
            const baseCurrency = s.split('/')[0];
            const quoteCurrency = s.split('/')[1] || 'USDT';

            if (side === 'buy') {
              const availableQuote = balance.free?.[quoteCurrency] || 0;
              if (finalAmt * prc < minNotional) {
                finalAmt = parseFloat((minNotional / prc).toFixed(8)) + 0.000001;
                console.log(`[NOTIONAL] Adjusting ${name} BUY amount from ${amt} to ${finalAmt} to meet ${minNotional} ${quoteCurrency} minimum.`);
              }
              // Cap by available quote
              if (finalAmt * prc > availableQuote) {
                finalAmt = parseFloat((availableQuote / prc).toFixed(8)) - 0.000001;
                console.log(`[BALANCE] Capping ${name} BUY amount to ${finalAmt} due to insufficient ${quoteCurrency}.`);
              }
              // Final check: if it's still below notional after capping, we can't place it.
              if (finalAmt * prc < minNotional) {
                console.warn(`[NOTIONAL] BUY amount ${finalAmt} is still below ${minNotional} ${quoteCurrency} after balance capping. Returning 0.`);
                return 0;
              }
            } else {
              const availableBase = balance.free?.[baseCurrency] || 0;
              // If we want to sell, we should try to sell at least minNotional
              if (finalAmt * prc < minNotional) {
                const neededAmt = parseFloat((minNotional / prc).toFixed(8)) + 0.000001;
                if (availableBase >= neededAmt) {
                  finalAmt = neededAmt;
                  console.log(`[NOTIONAL] Adjusting ${name} SELL amount from ${amt} to ${finalAmt} to meet ${minNotional} ${quoteCurrency} minimum.`);
                } else {
                  // If we can't reach notional, we can only sell what we have
                  finalAmt = availableBase;
                }
              } else if (finalAmt > availableBase) {
                console.log(`[BALANCE] Capping ${name} SELL amount from ${amt} to ${availableBase} due to insufficient ${baseCurrency}.`);
                finalAmt = availableBase;
              }
              
              // Final check: if it's still below notional, we can't place it on Binance.
              if (finalAmt > 0 && finalAmt * prc < minNotional) {
                console.warn(`[NOTIONAL] SELL amount ${finalAmt} is still below ${minNotional} ${quoteCurrency}. Returning 0 to avoid exchange error.`);
                return 0;
              }
            }
          } catch (err) {
            console.warn(`[BALANCE CHECK] Failed to fetch balance for ${name}, proceeding with original amount.`);
          }

          return Math.max(0, finalAmt);
        };

        return {
          fetchTicker: async (s: string) => {
            if (isSim) return { last: currentPrice + priceOffset };
            return await ex.fetchTicker(s);
          },
          fetchBalance: async () => {
            if (isSim) {
              return {
                free: { USDT: 10000, [symbol.split('/')[0]]: 1 },
                total: { USDT: 10000, [symbol.split('/')[0]]: 1 }
              };
            }
            return await ex.fetchBalance();
          },
          fetchOrderBook: async (s: string) => {
            if (isSim) {
              const spread = (currentPrice + priceOffset) * 0.001;
              return {
                bids: [[currentPrice + priceOffset - spread / 2, 10]],
                asks: [[currentPrice + priceOffset + spread / 2, 10]]
              };
            }
            return await ex.fetchOrderBook(s);
          },
          createLimitBuyOrder: async (s: string, amount: number, price: number, options?: any) => {
            let orderId = 'sim-l-buy-' + Math.random().toString(36).substr(2, 9);
            let executionPrice = price;
            const finalAmount = await adjustAmount(amount, price, 'buy', s);
            if (finalAmount <= 0) {
              console.warn(`[EXCHANGE] ${name} BUY order skipped: amount is 0 (insufficient balance or below notional).`);
              return { id: 'skipped', price: executionPrice, amount: 0, status: 'skipped' };
            }
            if (!isSim) {
              const order = await ex.createOrder(s, 'limit', 'buy', finalAmount, price, options);
              orderId = order.id;
              executionPrice = order.price || price;
            }
            dbLogger.logTrade('BUY', finalAmount, executionPrice, orderId, name);
            return { id: orderId, price: executionPrice, amount: finalAmount, status: 'open' };
          },
          createLimitSellOrder: async (s: string, amount: number, price: number, options?: any) => {
            let orderId = 'sim-l-sell-' + Math.random().toString(36).substr(2, 9);
            let executionPrice = price;
            const finalAmount = await adjustAmount(amount, price, 'sell', s);
            if (finalAmount <= 0) {
              console.warn(`[EXCHANGE] ${name} SELL order skipped: amount is 0 (insufficient balance or below notional).`);
              return { id: 'skipped', price: executionPrice, amount: 0, status: 'skipped' };
            }
            if (!isSim) {
              const order = await ex.createOrder(s, 'limit', 'sell', finalAmount, price, options);
              orderId = order.id;
              executionPrice = order.price || price;
            }
            dbLogger.logTrade('SELL', finalAmount, executionPrice, orderId, name);
            return { id: orderId, price: executionPrice, amount: finalAmount, status: 'open' };
          },
          createMarketBuyOrder: async (s: string, amount: number) => {
            let orderId = 'sim-m-buy-' + Math.random().toString(36).substr(2, 9);
            let executionPrice = currentPrice + priceOffset;
            const finalAmount = await adjustAmount(amount, executionPrice, 'buy', s);
            if (finalAmount <= 0) {
              console.warn(`[EXCHANGE] ${name} BUY order skipped: amount is 0 (insufficient balance or below notional).`);
              return { id: 'skipped', price: executionPrice, amount: 0, status: 'skipped' };
            }
            if (!isSim) {
              const order = await ex.createOrder(s, 'market', 'buy', finalAmount);
              orderId = order.id;
              executionPrice = order.price || order.average || (currentPrice + priceOffset);
            }
            dbLogger.logTrade('BUY', finalAmount, executionPrice, orderId, name);
            return { id: orderId, price: executionPrice, amount: finalAmount };
          },
          createMarketSellOrder: async (s: string, amount: number) => {
            let orderId = 'sim-m-sell-' + Math.random().toString(36).substr(2, 9);
            let executionPrice = currentPrice + priceOffset;
            const finalAmount = await adjustAmount(amount, executionPrice, 'sell', s);
            if (finalAmount <= 0) {
              console.warn(`[EXCHANGE] ${name} SELL order skipped: amount is 0 (insufficient balance or below notional).`);
              return { id: 'skipped', price: executionPrice, amount: 0, status: 'skipped' };
            }
            if (!isSim) {
              const order = await ex.createOrder(s, 'market', 'sell', finalAmount);
              orderId = order.id;
              executionPrice = order.price || order.average || (currentPrice + priceOffset);
            }
            dbLogger.logTrade('SELL', finalAmount, executionPrice, orderId, name);
            return { id: orderId, price: executionPrice, amount: finalAmount };
          },
          cancelOrder: async (id: string, s: string) => {
            if (isSim) return { status: 'canceled' };
            return await ex.cancelOrder(id, s);
          }
        };
      };

      const capitalToUse = (strategy.max_capital || 1000) * (strategy.capital_percentage / 100);

      if (strategy.type === 'Grid Trading' || strategy.type === 'Grid Trading Strategy') {
        const { gridLower, gridUpper, gridLevels, gridOrderSize } = params;
        if (!gridLower || !gridUpper || !gridLevels) return;

        const gridConfig = {
          symbol: symbol,
          upper_limit: parseFloat(gridUpper),
          lower_limit: parseFloat(gridLower),
          grid_count: parseInt(gridLevels),
          amount: parseFloat(gridOrderSize || '0.01')
        };

        const wrappedExchange = createWrappedExchange(exchange, isSimulation ? 'Simulation' : userKeys.exchange, isSimulation);

        const gridBot = new GridStrategy(gridConfig, wrappedExchange);
        
        // Restore state
        if (params.active_orders) {
          for (const [p, id] of Object.entries(params.active_orders)) {
            gridBot.activeOrders.set(parseFloat(p), id as string);
          }
        }

        if (!params.initialized) {
          console.log(`Initializing GridStrategy for strategy ${strategy.id}`);
          await gridBot.execute();
          params.initialized = true;
        } else {
          await gridBot.onTick();
        }

        // Persist state
        params.active_orders = Object.fromEntries(gridBot.activeOrders);
        db.prepare('UPDATE strategies SET params = ? WHERE id = ?').run(JSON.stringify(params), strategy.id);
        broadcast({ type: 'strategy_update' });
      }

      else if (strategy.type === 'Trend Following' || strategy.type === 'Trend Following Strategy') {
        const trendConfig = {
          symbol: symbol,
          amount: capitalToUse / currentPrice,
          period: params.period || 14
        };

        const wrappedExchange = createWrappedExchange(exchange, isSimulation ? 'Simulation' : userKeys.exchange, isSimulation);

        const trendBot = new TrendStrategy(trendConfig, wrappedExchange);
        
        // Restore state
        if (params.prices) trendBot.prices = params.prices;
        if (params.position) trendBot.position = params.position;
        if (params.entryPrice) trendBot.entryPrice = params.entryPrice;
        if (params.currentAmount) trendBot.currentAmount = params.currentAmount;

        await trendBot.onTick();

        // Persist state
        params.prices = trendBot.prices.slice(-100); // Keep last 100 prices
        params.position = trendBot.position;
        params.entryPrice = trendBot.entryPrice;
        params.currentAmount = trendBot.currentAmount;
        db.prepare('UPDATE strategies SET params = ? WHERE id = ?').run(JSON.stringify(params), strategy.id);
        broadcast({ type: 'strategy_update' });
      }
      else if (strategy.type === 'Scalping' || strategy.type === 'Scalping Strategy') {
        const scalpingConfig = {
          symbol: symbol,
          amount: (capitalToUse * 0.5) / currentPrice,
          min_spread: currentPrice * 0.0005 // 0.05% spread
        };

        const wrappedExchange = createWrappedExchange(exchange, isSimulation ? 'Simulation' : userKeys.exchange, isSimulation);

        const scalpingBot = new ScalpingStrategy(scalpingConfig, wrappedExchange);
        await scalpingBot.onTick();
      }
      else if (strategy.type === 'Market Making' || strategy.type === 'Market Making Strategy') {
        const mmConfig = {
          symbol: symbol,
          ...params
        };

        const wrappedExchange = createWrappedExchange(exchange, isSimulation ? 'Simulation' : userKeys.exchange, isSimulation);

        const mmBot = new MarketMakingStrategy(mmConfig, wrappedExchange);
        
        // Restore state
        if (params.activeBuyOrderId) mmBot.activeBuyOrderId = params.activeBuyOrderId;
        if (params.activeSellOrderId) mmBot.activeSellOrderId = params.activeSellOrderId;
        if (params.inventoryCoin !== undefined) mmBot.inventoryCoin = params.inventoryCoin;
        if (params.inventoryCost !== undefined) mmBot.inventoryCost = params.inventoryCost;
        if (params.pauseTicks !== undefined) mmBot.pauseTicks = params.pauseTicks;
        if (params.lastMidPrice) mmBot.lastMidPrice = params.lastMidPrice;
        if (params.priceHistory) mmBot.priceHistory = params.priceHistory;
        if (params.totalBuysFilled) mmBot.totalBuysFilled = params.totalBuysFilled;
        if (params.totalSellsFilled) mmBot.totalSellsFilled = params.totalSellsFilled;
        if (params.totalFeesPaid) mmBot.totalFeesPaid = params.totalFeesPaid;
        if (params.estimatedPnl) mmBot.estimatedPnl = params.estimatedPnl;

        await mmBot.onTick();

        // Persist state
        params.activeBuyOrderId = mmBot.activeBuyOrderId;
        params.activeSellOrderId = mmBot.activeSellOrderId;
        params.inventoryCoin = mmBot.inventoryCoin;
        params.inventoryCost = mmBot.inventoryCost;
        params.pauseTicks = mmBot.pauseTicks;
        params.lastMidPrice = mmBot.lastMidPrice;
        params.priceHistory = mmBot.priceHistory.slice(-100);
        params.totalBuysFilled = mmBot.totalBuysFilled;
        params.totalSellsFilled = mmBot.totalSellsFilled;
        params.totalFeesPaid = mmBot.totalFeesPaid;
        params.estimatedPnl = mmBot.estimatedPnl;

        db.prepare('UPDATE strategies SET params = ?, profit = ? WHERE id = ?').run(JSON.stringify(params), mmBot.estimatedPnl, strategy.id);
        broadcast({ type: 'strategy_update' });
      }
      else if (strategy.type === 'AI Adaptive' || strategy.type === 'AI Adaptive Strategy') {
        const aiConfig = {
          symbol: symbol,
          amount: (capitalToUse * 0.3) / currentPrice
        };

        const wrappedExchange = createWrappedExchange(exchange, isSimulation ? 'Simulation' : userKeys.exchange, isSimulation);

        const aiBot = new AIAdaptiveStrategy(aiConfig, wrappedExchange);
        
        // Restore state
        if (params.prices) aiBot.prices = params.prices;
        if (params.volumes) aiBot.volumes = params.volumes;
        if (params.emaShortState !== undefined) aiBot.emaShortState = params.emaShortState;
        if (params.emaLongState !== undefined) aiBot.emaLongState = params.emaLongState;
        if (params.position) aiBot.position = params.position;
        if (params.entryPrice) aiBot.entryPrice = params.entryPrice;
        if (params.highestPrice) aiBot.highestPrice = params.highestPrice;
        if (params.currentAmount) aiBot.currentAmount = params.currentAmount;
        if (params.cooldownTicks !== undefined) aiBot.cooldownTicks = params.cooldownTicks;
        if (params.totalTrades) aiBot.totalTrades = params.totalTrades;
        if (params.winningTrades) aiBot.winningTrades = params.winningTrades;
        if (params.totalPnL) aiBot.totalPnL = params.totalPnL;
        if (params.peakBalance) aiBot.peakBalance = params.peakBalance;
        if (params.maxDrawdown) aiBot.maxDrawdown = params.maxDrawdown;
        if (params.initialBalance) aiBot.initialBalance = params.initialBalance;

        await aiBot.onTick();

        // Persist state
        params.prices = aiBot.prices.slice(-200);
        params.volumes = aiBot.volumes.slice(-200);
        params.emaShortState = aiBot.emaShortState;
        params.emaLongState = aiBot.emaLongState;
        params.position = aiBot.position;
        params.entryPrice = aiBot.entryPrice;
        params.highestPrice = aiBot.highestPrice;
        params.currentAmount = aiBot.currentAmount;
        params.cooldownTicks = aiBot.cooldownTicks;
        params.totalTrades = aiBot.totalTrades;
        params.winningTrades = aiBot.winningTrades;
        params.totalPnL = aiBot.totalPnL;
        params.peakBalance = aiBot.peakBalance;
        params.maxDrawdown = aiBot.maxDrawdown;
        params.initialBalance = aiBot.initialBalance;

        db.prepare('UPDATE strategies SET params = ? WHERE id = ?').run(JSON.stringify(params), strategy.id);
        broadcast({ type: 'strategy_update' });
      }
      else if (strategy.type === 'Loop' || strategy.type === 'Loop Strategy') {
        const loopConfig = {
          symbol: symbol,
          amount: (capitalToUse * 0.5) / currentPrice,
          buy_price: params.buy_price || (currentPrice * 0.99),
          sell_price: params.sell_price || (currentPrice * 1.01)
        };

        const wrappedExchange = createWrappedExchange(exchange, isSimulation ? 'Simulation' : userKeys.exchange, isSimulation);

        const loopBot = new LoopStrategy(loopConfig, wrappedExchange);
        
        // Restore state
        if (params.state) loopBot.state = params.state;
        if (params.buyPrice) loopBot.buyPrice = params.buyPrice;
        if (params.sellPrice) loopBot.sellPrice = params.sellPrice;
        if (params.anchorPrice) loopBot.anchorPrice = params.anchorPrice;
        if (params.entryPrice) loopBot.entryPrice = params.entryPrice;
        if (params.currentAmount) loopBot.currentAmount = params.currentAmount;
        if (params.prices) loopBot.prices = params.prices;
        if (params.totalCycles) loopBot.totalCycles = params.totalCycles;
        if (params.winCycles) loopBot.winCycles = params.winCycles;
        if (params.totalPnl) loopBot.totalPnl = params.totalPnl;

        await loopBot.onTick();

        // Persist state
        params.state = loopBot.state;
        params.buyPrice = loopBot.buyPrice;
        params.sellPrice = loopBot.sellPrice;
        params.anchorPrice = loopBot.anchorPrice;
        params.entryPrice = loopBot.entryPrice;
        params.currentAmount = loopBot.currentAmount;
        params.prices = loopBot.prices.slice(-100);
        params.totalCycles = loopBot.totalCycles;
        params.winCycles = loopBot.winCycles;
        params.totalPnl = loopBot.totalPnl;

        db.prepare('UPDATE strategies SET params = ? WHERE id = ?').run(JSON.stringify(params), strategy.id);
        broadcast({ type: 'strategy_update' });
      }
      else if (strategy.type === 'Arbitrage' || strategy.type === 'Arbitrage Strategy') {
        const arbConfig = {
          symbol: symbol,
          amount: capitalToUse / currentPrice,
          minSpread: params.minSpread || 0.5
        };

        const ex1Name = isSimulation ? 'Simulation 1' : userKeys.exchange;
        const wrappedEx1 = createWrappedExchange(exchange, ex1Name, isSimulation);

        let wrappedEx2;
        if (params.secondaryExchangeId) {
          const secondaryKeys = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(params.secondaryExchangeId) as any;
          if (secondaryKeys) {
            const ex2 = new (ccxt as any)[secondaryKeys.exchange]({
              apiKey: secondaryKeys.api_key,
              secret: secondaryKeys.api_secret,
            });
            wrappedEx2 = createWrappedExchange(ex2, secondaryKeys.exchange, false);
          } else {
            wrappedEx2 = createWrappedExchange(null, 'Simulation 2', true, currentPrice * 0.01); // 1% difference for simulation
          }
        } else {
          wrappedEx2 = createWrappedExchange(null, 'Simulation 2', true, currentPrice * 0.01);
        }

        const arbBot = new ArbitrageStrategy(wrappedEx1, wrappedEx2, arbConfig);
        
        // Restore state
        if (params.totalTrades) arbBot.totalTrades = params.totalTrades;
        if (params.winTrades) arbBot.winTrades = params.winTrades;
        if (params.totalNetPnl) arbBot.totalNetPnl = params.totalNetPnl;

        await arbBot.onTick();

        // Persist state
        params.totalTrades = arbBot.totalTrades;
        params.winTrades = arbBot.winTrades;
        params.totalNetPnl = arbBot.totalNetPnl;
        db.prepare('UPDATE strategies SET params = ? WHERE id = ?').run(JSON.stringify(params), strategy.id);
        broadcast({ type: 'strategy_update' });
      }
      else if (strategy.type === 'AI Adaptive Strategy') {
        // Redundant block removed, handled by the main AI Adaptive block above
      }
    } catch (e: any) {
      console.error(`Strategy ${strategy.id} execution error:`, e.message);
    }
  }

  // Main Strategy Loop
  setInterval(async () => {
    try {
      const runningStrategies = db.prepare("SELECT * FROM strategies WHERE is_running = 1").all() as any[];
      for (const strategy of runningStrategies) {
        try {
          if (typeof strategy.params === 'string') {
            strategy.params = JSON.parse(strategy.params || '{}');
          }
          await executeStrategy(strategy);
        } catch (err) {
          console.error(`Error processing strategy ${strategy.id}:`, err);
        }
      }
    } catch (e) {
      console.error('Main strategy loop failed', e);
    }
  }, 10000); // Run every 10 seconds

  // WebSocket for real-time market data simulation
  wss.on('connection', (ws) => {
    console.log('Client connected to WS');
    const interval = setInterval(() => {
      const data = {
        type: 'market_update',
        symbols: {
          'BTC/USDT': 65000 + (Math.random() - 0.5) * 100,
          'ETH/USDT': 3500 + (Math.random() - 0.5) * 10,
          'SOL/USDT': 145 + (Math.random() - 0.5) * 2,
        },
        timestamp: Date.now()
      };
      ws.send(JSON.stringify(data));
    }, 2000);

    ws.on('close', () => clearInterval(interval));
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
