const str = 'TOTAL DEPOSITADO (CLIENTES)';
const m = {ptLower: 'total depositado (clientes)', original: 'Total Depositado (Clientes)', target: 'Total Deposited (Clients)'};
try {
const regex = new RegExp(`(?<![\\p{L}\\p{N}])${m.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'gui');
console.log("Regex:", regex);
console.log("Replaced:", str.replace(regex, m.target));
} catch(e) { console.error("Error:", e.message); }
