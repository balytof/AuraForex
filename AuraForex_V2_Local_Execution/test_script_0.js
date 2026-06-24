
        function changeLanguage(langCode) {
          if(window.forceDashboardLang) {
              window.forceDashboardLang(langCode);
          } else {
              localStorage.setItem('aura_lang', langCode);
              window.location.reload();
          }
        }
      // --- Download Seguro Master ---
async function downloadMasterSignal() {
  const token = prompt("Para descarregar o Robô Master, insira o seu Token Secreto de Provedor:");
  if (!token) return;

  try {
    const res = await fetch(`/api/user/download-master?token=${encodeURIComponent(token)}`, {
      method: "GET",
      headers: { "Authorization": "Bearer " + localStorage.getItem("aura_token") }
    });

    if (!res.ok) {
      const errorText = await res.text();
      alert("ERRO: " + errorText);
      return;
    }

    // Se OK, forçar download do ficheiro
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = "AuraMaster_Signal.ex5";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert("Erro ao efetuar o download seguro.");
  }
}

// Initial Load
document.addEventListener("DOMContentLoaded", () => {
          const lang = localStorage.getItem('aura_lang') || 'pt';
          const sel = document.getElementById("langSelect");
          if(sel) sel.value = lang;
        });
      