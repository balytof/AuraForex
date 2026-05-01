function getPipValue(pair) {
  if (pair.includes("XAU") || pair.includes("GOLD")) return 0.1;
  if (pair.includes("JPY")) return 0.01;
  return 0.0001;
}

function getPrecision(pair) {
  if (pair.includes("XAU") || pair.includes("GOLD")) return 2;
  if (pair.includes("JPY")) return 3;
  return 5;
}

function normPrice(price, pair) {
  const p = getPrecision(pair);
  return parseFloat(price.toFixed(p));
}

async function computeDynamicSlTp(broker, pair, direction, entry) {
  try {
    const pip = getPipValue(pair);
    const slPips = 18; 
    const slDist = pip * slPips;
    const tpDist = slDist * 1.5; 
    
    const sl = direction === "BUY" ? normPrice(entry - slDist, pair) : normPrice(entry + slDist, pair);
    const tp = direction === "BUY" ? normPrice(entry + tpDist, pair) : normPrice(entry - tpDist, pair);

    console.log(`[DYN] ${pair} ${direction} Entry=${entry} SL=${sl} TP=${tp} (RR=${((Math.abs(entry-tp))/(Math.abs(entry-sl))).toFixed(2)})`);
    return { sl, tp };
  } catch (e) {
    console.error(e);
  }
}

// Test cases from the image
computeDynamicSlTp({}, "XAUUSD", "SELL", 4585.55);
computeDynamicSlTp({}, "GBPJPY", "BUY", 215.564);
computeDynamicSlTp({}, "EURUSDw", "SELL", 1.17147);
computeDynamicSlTp({}, "USDJPY", "BUY", 159.524);
