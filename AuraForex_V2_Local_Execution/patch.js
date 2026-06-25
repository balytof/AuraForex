const fs = require('fs');
let f = fs.readFileSync('smc_bot_dashboard.html', 'utf8');

const target1 = `<a href="/admin_dashboard.html" class="nav-item" id="adminLink" style="display: none;">
          <i class="fas fa-user-shield"></i>
          <span>Admin Panel</span>
        </a>`;

const replace1 = `<a href="/admin_dashboard.html" class="nav-item" id="adminLink" style="display: none;">
          <i class="fas fa-user-shield"></i>
          <span>Admin Panel</span>
        </a>
        <a href="#" class="nav-item" id="resetLocksLink" style="display: none; color: var(--warn);" onclick="resetClientLocks()">
          <i class="fas fa-unlock-alt"></i>
          <span>Destravar Bot</span>
        </a>`;

f = f.replace(target1, replace1);

const target2 = `if (btnResetLoss) btnResetLoss.style.display = status.canResetLocks ? "block" : "none";`;
const replace2 = `if (btnResetLoss) btnResetLoss.style.display = status.canResetLocks ? "block" : "none";
        
        const resetLocksLink = document.getElementById("resetLocksLink");
        if (resetLocksLink) resetLocksLink.style.display = status.canResetLocks ? "flex" : "none";`;

f = f.replace(target2, replace2);

fs.writeFileSync('smc_bot_dashboard.html', f);
console.log("Patched smc_bot_dashboard.html");
