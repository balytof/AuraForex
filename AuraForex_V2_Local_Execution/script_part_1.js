
        function changeLanguage(langCode) {
          document.cookie = "googtrans=/pt/" + langCode + "; path=/; domain=" + window.location.hostname;
          document.cookie = "googtrans=/pt/" + langCode + "; path=/";
          window.location.reload();
        }
        document.addEventListener("DOMContentLoaded", () => {
          const match = document.cookie.match(/googtrans=\/pt\/([a-z]{2})/);
          if (match && match[1]) {
            const sel = document.getElementById("langSelect");
            if(sel) sel.value = match[1];
          }
        });
      