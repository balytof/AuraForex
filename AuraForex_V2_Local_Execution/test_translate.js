const map = [
  { ptLower: 'aderir ao copy trading', original: 'Aderir ao Copy Trading', target: 'Rejoindre Copy Trading' },
  { ptLower: 'painel admin', original: 'PAINEL ADMIN', target: 'PANNEAU ADMIN' },
  { ptLower: 'provedor', original: 'Provedor', target: 'Fournisseur' }
];

const testStrings = [
  "Aderir ao Copy Trading",
  "PAINEL ADMIN",
  "Provedor"
];

for (let text of testStrings) {
  let lowerText = text.toLowerCase();
  for (let m of map) {
      if (lowerText.includes(m.ptLower)) {
          const regexStr = `(?<![\\p{L}\\p{N}])${m.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`;
          const regex = new RegExp(regexStr, 'gui');
          if (regex.test(text)) {
              text = text.replace(regex, m.target);
          }
      }
  }
  console.log("Result:", text);
}
