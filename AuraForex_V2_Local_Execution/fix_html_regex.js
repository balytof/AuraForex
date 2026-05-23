const fs = require('fs');
let txt = fs.readFileSync('smc_bot_dashboard.html', 'utf8');

txt = txt.replace(/if\s*\(\s*pammRes\.success\s*&&\s*txRes\.success\s*\)\s*\{\s*updatePammUI\(pammRes\.pammAccount,\s*txRes\.walletBalance,\s*pammRes\.pammPerformanceFeePct,\s*txRes\.transactions\);\s*\}/, 
`    updatePammUI(
      pammRes.pammAccount || null,
      txRes.walletBalance || 0,
      pammRes.pammPerformanceFeePct || 30,
      txRes.transactions || []
    );`
);

// Second request: Remove the google translate script I added.
txt = txt.replace(/<script type="text\/javascript">\s*function googleTranslateElementInit\(\) \{\s*new google\.translate\.TranslateElement\(\{pageLanguage: 'pt', layout: google\.translate\.TranslateElement\.InlineLayout\.SIMPLE\}, 'google_translate_element'\);\s*\}\s*<\/script>\s*<script type="text\/javascript" src="https:\/\/translate\.google\.com\/translate_a\/element\.js\?cb=googleTranslateElementInit"><\/script>/, '');

// And remove the div for it
txt = txt.replace(/<div id="google_translate_element" style="margin-top: 20px; padding: 0 20px;"><\/div>/, '');

fs.writeFileSync('smc_bot_dashboard.html', txt, 'utf8');
console.log('Replaced successfully.');
