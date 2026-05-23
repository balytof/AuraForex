const fs = require('fs');
let txt = fs.readFileSync('smc_bot_dashboard.html', 'utf8');

const langSelectorHTML = `
      <div class="nav-item lang-selector" style="padding: 0 20px; margin-top: 10px;">
        <i class="fas fa-globe"></i>
        <select id="langSelect" onchange="changeLanguage(this.value)" style="background: transparent; color: inherit; border: none; outline: none; margin-left: 10px; cursor: pointer;">
          <option value="pt" style="color: #000;">Português</option>
          <option value="en" style="color: #000;">English</option>
          <option value="es" style="color: #000;">Español</option>
        </select>
      </div>

      <script>
        function changeLanguage(langCode) {
          document.cookie = "googtrans=/pt/" + langCode + "; path=/; domain=" + window.location.hostname;
          document.cookie = "googtrans=/pt/" + langCode + "; path=/";
          window.location.reload();
        }
        document.addEventListener("DOMContentLoaded", () => {
          const match = document.cookie.match(/googtrans=\\/pt\\/([a-z]{2})/);
          if (match && match[1]) {
            const sel = document.getElementById("langSelect");
            if(sel) sel.value = match[1];
          }
        });
      </script>
`;

if (!txt.includes('langSelect')) {
  txt = txt.replace('<!-- Sair -->', langSelectorHTML + '\n      <!-- Sair -->');
  // If <!-- Sair --> is not there, insert before the logout link
  if (!txt.includes(langSelectorHTML.trim().substring(0, 50))) {
    txt = txt.replace(/<a href="#" class="nav-item" onclick="logout\(\)" style="color: var\(--bear\);">/, langSelectorHTML + '\n      <a href="#" class="nav-item" onclick="logout()" style="color: var(--bear);">');
  }
  fs.writeFileSync('smc_bot_dashboard.html', txt, 'utf8');
  console.log('Language selector added successfully.');
} else {
  console.log('Language selector already exists.');
}
