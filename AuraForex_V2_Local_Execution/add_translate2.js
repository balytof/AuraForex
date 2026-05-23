const fs = require('fs');
let txt = fs.readFileSync('smc_bot_dashboard.html', 'utf8');

const translateScript = `
<script type="text/javascript">
function googleTranslateElementInit() {
  new google.translate.TranslateElement({pageLanguage: 'pt', layout: google.translate.TranslateElement.InlineLayout.SIMPLE}, 'google_translate_element');
}
</script>
<script type="text/javascript" src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"></script>
</body>
</html>
`;

if (!txt.includes('googleTranslateElementInit')) {
  txt = txt.replace('</html>', translateScript);
  fs.writeFileSync('smc_bot_dashboard.html', txt, 'utf8');
  console.log('Script replaced.');
} else {
  console.log('Script already present.');
}
