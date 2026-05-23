const fs = require('fs');
let txt = fs.readFileSync('smc_bot_dashboard.html', 'utf8');

const translateHtml = `
      <div id="google_translate_element" style="margin-top: 20px; padding: 0 20px;"></div>
`;

const targetAnchor = '<a href="#" class="nav-item" onclick="logout()" style="color: var(--bear);">';

if (txt.includes(targetAnchor)) {
  txt = txt.replace(targetAnchor, translateHtml + '\n      ' + targetAnchor);
}

const translateScript = `
<script type="text/javascript">
function googleTranslateElementInit() {
  new google.translate.TranslateElement({pageLanguage: 'pt', layout: google.translate.TranslateElement.InlineLayout.SIMPLE}, 'google_translate_element');
}
</script>
<script type="text/javascript" src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"></script>
</body>
`;

if (!txt.includes('googleTranslateElementInit')) {
  txt = txt.replace('</body>', translateScript);
}

fs.writeFileSync('smc_bot_dashboard.html', txt, 'utf8');
console.log('Translate added.');
