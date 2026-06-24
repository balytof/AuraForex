
        function toggleProfitLockFields() {
          const mode = document.getElementById("advRunnerMode").value;
          const container = document.getElementById("profitLockOptions");
          if(mode === "profit_lock") {
            container.style.display = "flex";
          } else {
            container.style.display = "none";
          }
        }
        function toggleExitStrategyFields() {
          const mode = document.getElementById("advExitMode").value;
          const container = document.getElementById("timeLimitOptions");
          if(mode === "time_limit") {
            container.style.display = "flex";
          } else {
            container.style.display = "none";
          }
        }
      