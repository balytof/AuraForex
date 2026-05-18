const fs = require('fs');
const path = require('path');

const eaFiles = [
    path.join(__dirname, '../public/AuraForex_V8_INSTITUTIONAL.mq5'),
    path.join(__dirname, '../AuraForex_V2_Local_Execution/public/AuraForex_V8_INSTITUTIONAL.mq5'),
    path.join(__dirname, '../AuraForex_V8_INSTITUTIONAL.mq5')
];

eaFiles.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️ File not found: ${filePath}`);
        return;
    }
    
    console.log(`\n⚙️ Patching EA: ${filePath}`);
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Patch check daily target & loss functions
    const oldCheckTargetAndLoss = `void CheckDailyTarget()
{
   MqlDateTime tm;
   TimeCurrent(tm);

   if(tm.day != LastTradingDay)
   {
      double currentBal = AccountInfoDouble(ACCOUNT_BALANCE);
      double currentEq  = AccountInfoDouble(ACCOUNT_EQUITY);
      if(currentBal > 10 && currentEq > 10)
      {
         LastTradingDay = tm.day;
         DailyTargetReached = false;
         DailyLossLock      = false;
         DailyStartBalance  = currentBal;
         DailyStartEquity   = currentEq;
         Print("🌅 [DAILY] Novo dia detectado. Meta/Loss resetados | Balance Inicial: $", DoubleToString(DailyStartBalance, 2), " | Equity Inicial: $", DoubleToString(DailyStartEquity, 2));
      }
   }

   // Fallback inicialização (Primeiro run do bot no dia)
   if(DailyStartEquity <= 10)
   {
      double currentBal = AccountInfoDouble(ACCOUNT_BALANCE);
      double currentEq  = AccountInfoDouble(ACCOUNT_EQUITY);
      if(currentBal > 10 && currentEq > 10)
      {
         DailyStartBalance  = currentBal;
         DailyStartEquity   = currentEq;
         Print("🌅 [BOOT] Saldo inicial definido: Balance = $", DoubleToString(DailyStartBalance, 2), " | Equity = $", DoubleToString(DailyStartEquity, 2));
      }
   }

   if(DailyStartEquity <= 10) return; // Não calcular meta se saldo inicial não foi definido
   if(DailyTargetReached) return;

   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double profitPct = 0;
   
   if(DailyStartEquity > 0)
      profitPct = ((equity - DailyStartEquity) / DailyStartEquity) * 100.0;

   if(profitPct >= InpDailyTargetPct)
   {
      DailyTargetReached = true;
      Print("🏆 [DAILY] META ATINGIDA: ", DoubleToString(profitPct, 2), "% | Equity: $", DoubleToString(equity, 2), " | Fechando posições...");
      
      CloseAllPositions();
   }
}

void CheckDailyLoss()
{
   if(DailyLossLock) return;
   if(DailyStartEquity <= 10) return; // Não calcular perda se saldo inicial não foi definido

   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   
   // Buffer de inicialização: Não actua nos primeiros 10 segundos para evitar spikes de boot
   static datetime bootTime = 0;
   if(bootTime == 0) bootTime = TimeCurrent();
   if(TimeCurrent() - bootTime < 10) return;

   double lossPct = ((DailyStartEquity - equity) / DailyStartEquity) * 100.0;

   // Só bloqueia se houver uma perda REAL de 10%
   if(lossPct >= InpMaxDailyLossPct)
   {
      DailyLossLock = true;
      Print("🛑 [CIRCUIT-BREAKER] LIMITE DE PERDA DIÁRIA ATINGIDO: ", DoubleToString(lossPct, 2), "% | Equity Inicial: ", DailyStartEquity, " | Equity Actual: ", equity);
      CloseAllPositions();
   }
}`;

    // Just in case it hasn't been patched yet, also support the old version
    const fallbackOldCheck = `void CheckDailyTarget()
{
   MqlDateTime tm;
   TimeCurrent(tm);

   if(tm.day != LastTradingDay)
   {
      LastTradingDay = tm.day;
      DailyTargetReached = false;
      DailyLossLock      = false;
      DailyStartBalance  = AccountInfoDouble(ACCOUNT_BALANCE);
      DailyStartEquity   = AccountInfoDouble(ACCOUNT_EQUITY);
      Print("🌅 [DAILY] Novo dia detectado. Meta/Loss resetados | Equity Inicial: $", DoubleToString(DailyStartEquity, 2));
   }

   // Fallback inicialização (Primeiro run do bot no dia)
   if(DailyStartEquity <= 0)
   {
      DailyStartBalance  = AccountInfoDouble(ACCOUNT_BALANCE);
      DailyStartEquity   = AccountInfoDouble(ACCOUNT_EQUITY);
   }

   if(DailyTargetReached) return;

   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double profitPct = 0;
   
   if(DailyStartEquity > 0)
      profitPct = ((equity - DailyStartEquity) / DailyStartEquity) * 100.0;

   if(profitPct >= InpDailyTargetPct)
   {
      DailyTargetReached = true;
      Print("🏆 [DAILY] META ATINGIDA: ", DoubleToString(profitPct, 2), "% | Equity: $", DoubleToString(equity, 2), " | Fechando posições...");
      
      CloseAllPositions();
   }
}

void CheckDailyLoss()
{
   if(DailyLossLock) return;

   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   
   // Buffer de inicialização: Não actua nos primeiros 10 segundos para evitar spikes de boot
   static datetime bootTime = 0;
   if(bootTime == 0) bootTime = TimeCurrent();
   if(TimeCurrent() - bootTime < 10) return;

   if(DailyStartEquity <= 0) {
      DailyStartEquity = equity;
      return;
   }

   double lossPct = ((DailyStartEquity - equity) / DailyStartEquity) * 100.0;

   // Só bloqueia se houver uma perda REAL de 10%
   if(lossPct >= InpMaxDailyLossPct)
   {
      DailyLossLock = true;
      Print("🛑 [CIRCUIT-BREAKER] LIMITE DE PERDA DIÁRIA ATINGIDO: ", DoubleToString(lossPct, 2), "% | Equity Inicial: ", DailyStartEquity, " | Equity Actual: ", equity);
      CloseAllPositions();
   }
}`;

    const newCheckTargetAndLoss = `void CheckDailyTarget()
{
   MqlDateTime tm;
   TimeCurrent(tm);

   if(tm.day != LastTradingDay)
   {
      double currentBal = AccountInfoDouble(ACCOUNT_BALANCE);
      double currentEq  = AccountInfoDouble(ACCOUNT_EQUITY);
      if(currentBal > 10 && currentEq > 10)
      {
         LastTradingDay = tm.day;
         DailyTargetReached = false;
         DailyLossLock      = false;
         DailyStartBalance  = currentBal;
         DailyStartEquity   = currentEq;
         Print("🌅 [DAILY] Novo dia detectado. Meta/Loss resetados | Balance Inicial: $", DoubleToString(DailyStartBalance, 2), " | Equity Inicial: $", DoubleToString(DailyStartEquity, 2));
      }
   }

   // Fallback inicialização (Primeiro run do bot no dia)
   if(DailyStartEquity <= 10)
   {
      double currentBal = AccountInfoDouble(ACCOUNT_BALANCE);
      double currentEq  = AccountInfoDouble(ACCOUNT_EQUITY);
      if(currentBal > 10 && currentEq > 10)
      {
         DailyStartBalance  = currentBal;
         DailyStartEquity   = currentEq;
         Print("🌅 [BOOT] Saldo inicial definido: Balance = $", DoubleToString(DailyStartBalance, 2), " | Equity = $", DoubleToString(DailyStartEquity, 2));
      }
   }

   if(DailyStartEquity <= 10) return; // Não calcular meta se saldo inicial não foi definido
   if(DailyTargetReached) return;

   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double profitPct = 0;
   
   if(DailyStartEquity > 0)
      profitPct = ((equity - DailyStartEquity) / DailyStartEquity) * 100.0;

   if(profitPct >= InpDailyTargetPct)
   {
      DailyTargetReached = true;
      Print("🏆 [DAILY] META ATINGIDA: ", DoubleToString(profitPct, 2), "% | Equity: $", DoubleToString(equity, 2), " | Fechando posições...");
      
      CloseAllPositions();
   }
}

void CheckDailyLoss()
{
   if(DailyLossLock) return;
   if(DailyStartEquity <= 10) return; // Não calcular perda se saldo inicial não foi definido

   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   
   // Buffer de inicialização: Não actua nos primeiros 10 segundos para evitar spikes de boot
   static datetime bootTime = 0;
   if(bootTime == 0) bootTime = TimeCurrent();
   if(TimeCurrent() - bootTime < 10) return;

   double lossPct = ((DailyStartEquity - equity) / DailyStartEquity) * 100.0;

   // Só bloqueia se houver uma perda REAL de 10%
   if(lossPct >= InpMaxDailyLossPct)
   {
      DailyLossLock = true;
      Print("🛑 [CIRCUIT-BREAKER] LIMITE DE PERDA DIÁRIA ATINGIDO: ", DoubleToString(lossPct, 2), "% | Equity Inicial: ", DailyStartEquity, " | Equity Actual: ", equity);
      CloseAllPositions();
   }
}`;

    // Clean whitespace to avoid spacing mismatches
    const clean = (str) => str.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();

    // Try patching the daily checks
    let contentClean = clean(content);
    if (contentClean.includes(clean(fallbackOldCheck))) {
        content = content.replace(fallbackOldCheck, newCheckTargetAndLoss);
        console.log("✅ CheckDailyTarget & CheckDailyLoss functions patched from fallback layout.");
    } else if (content.includes(oldCheckTargetAndLoss)) {
        console.log("ℹ️ CheckDailyTarget & CheckDailyLoss already patched.");
    } else {
        // Broad search and replace using regex or string splitting
        const targetStart = "void CheckDailyTarget()";
        const targetEnd = "CloseAllPositions();\n   }\n}";
        
        let startIdx = content.indexOf(targetStart);
        let endIdx = content.indexOf(targetEnd, startIdx);
        
        if (startIdx !== -1 && endIdx !== -1) {
            const endOffset = targetEnd.length;
            const fullTargetBlock = content.substring(startIdx, endIdx + endOffset);
            content = content.replace(fullTargetBlock, newCheckTargetAndLoss);
            console.log("✅ CheckDailyTarget & CheckDailyLoss functions dynamically matched and patched.");
        } else {
            console.log("❌ Could not match target functions.");
        }
    }

    // 2. Patch symmetrical server unlock synchronization
    const oldSyncBlock = `if(isProfitLocked && !DailyTargetReached)
      {
         DailyTargetReached = true;
         Print("🏆 [SERVER-SYNC] Meta Diária Atingida no Servidor! Fechando todas as posições...");
         CloseAllPositions();
      }
      
      if(isLossLocked && !DailyLossLock)
      {
         DailyLossLock = true;
         Print("🛑 [SERVER-SYNC] Limite de Perda Diária Atingido no Servidor! Fechando todas as posições...");
         CloseAllPositions();
      }`;

    const newSyncBlock = `if(isProfitLocked && !DailyTargetReached)
      {
         DailyTargetReached = true;
         Print("🏆 [SERVER-SYNC] Meta Diária Atingida no Servidor! Fechando todas as posições...");
         CloseAllPositions();
      }
      else if(!isProfitLocked && DailyTargetReached)
      {
         DailyTargetReached = false;
         Print("🌅 [SERVER-SYNC] Reset de Meta Diária no Servidor detectado. Desbloqueando...");
      }
      
      if(isLossLocked && !DailyLossLock)
      {
         DailyLossLock = true;
         Print("🛑 [SERVER-SYNC] Limite de Perda Diária Atingido no Servidor! Fechando todas as posições...");
         CloseAllPositions();
      }
      else if(!isLossLocked && DailyLossLock)
      {
         DailyLossLock = false;
         Print("🌅 [SERVER-SYNC] Reset de Perda Diária no Servidor detectado. Desbloqueando...");
      }`;

    // Normalize spacing for comparison
    if (content.includes(oldSyncBlock)) {
        content = content.replace(oldSyncBlock, newSyncBlock);
        console.log("✅ Unlock synchronization patched successfully.");
    } else {
        // Fallback with windows newlines
        const oldSyncBlockWin = oldSyncBlock.replace(/\n/g, '\r\n');
        const newSyncBlockWin = newSyncBlock.replace(/\n/g, '\r\n');
        if (content.includes(oldSyncBlockWin)) {
            content = content.replace(oldSyncBlockWin, newSyncBlockWin);
            console.log("✅ Unlock synchronization patched successfully (Win CRLF).");
        } else {
            // Loose matching
            const looseOld = `if(isProfitLocked && !DailyTargetReached)`;
            const looseOld2 = `if(isLossLocked && !DailyLossLock)`;
            
            let pos1 = content.indexOf(looseOld);
            let pos2 = content.indexOf(looseOld2, pos1);
            
            if (pos1 !== -1 && pos2 !== -1) {
                // Find closing brace of second block
                let closingBrace = content.indexOf('}', pos2);
                closingBrace = content.indexOf('}', closingBrace + 1); // inner or outer
                // To be safe, we just search for the entire containing block structure
                console.log("ℹ️ Found loose locks, applying direct replacements.");
                
                // Let's replace the segment directly
                const targetText = content.substring(pos1, closingBrace + 1);
                content = content.replace(targetText, newSyncBlock);
                console.log("✅ Symmetrical locks dynamically matched and patched.");
            } else {
                console.log("❌ Could not match lock synchronization block.");
            }
        }
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`💾 Saved changes to: ${filePath}`);
});
