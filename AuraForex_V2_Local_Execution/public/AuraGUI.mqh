//+------------------------------------------------------------------+
//|                                                      AuraGUI.mqh |
//|                                  Copyright 2026, AuraForex Corp  |
//+------------------------------------------------------------------+
#include <Controls\Dialog.mqh>
#include <Controls\Button.mqh>
#include <Controls\Edit.mqh>
#include <Controls\Label.mqh>
#include <Controls\CheckBox.mqh>

// --- GLOBAIS (Substitutos dos Inputs) ---
string g_LicenseKey = "COLE_SUA_LICENCA_AQUI";
string g_ServerUrl = "https://www.auratradebots.com/api";
bool   g_IsCentAccount = false;
double g_RiskPercent = 1.0;
int    g_MagicNumber = 888222;
int    g_TimerSeconds = 2;

int    g_MaxSLForex = 1500;
int    g_MaxSLJPY = 3000;
int    g_MaxSLOuro = 500;

int    g_MaxOrders = 4;
int    g_MaxBuys = 2;
int    g_MaxSells = 2;
int    g_TradeCooldown = 60;

double g_ProfitLockMin = 3.0;
double g_ProfitLockDrop = 30.0;

bool   g_TrailingEnabled = true;
int    g_TrailingStart = 50;
int    g_TrailingDistance = 80;
int    g_TrailingStep = 10;

bool   g_DailyTargetLockActive = true;
double g_DailyTargetPct = 5.0;
double g_MaxDailyLossPct = 10.0;
double g_DailyTargetLockPct = 80.0;
double g_DailyTargetFloorPct = 50.0;

bool   g_BreakevenEnabled = true;
int    g_BreakevenTrigger = 40;
int    g_BreakevenSecure = 10;

bool   g_FridaySafeLock = true;
int    g_FridayHour = 20;
int    g_FridayMinute = 0;

bool   g_SpreadGuardianActive = true;
double g_MaxSpreadPips = 5.0;

bool   g_SessionFilter = false;
bool   g_ManageManualOrders = true;

//+------------------------------------------------------------------+
//| Classe do Painel Principal                                       |
//+------------------------------------------------------------------+
class CAuraPanel : public CAppDialog
{
private:
   // Separadores (Tabs)
   CButton           m_btnTabGeral;
   CButton           m_btnTabRisco;
   CButton           m_btnTabLimites;
   CButton           m_btnTabTrailing;
   
   // --- TAB GERAL ---
   CLabel            m_lblLicense; CEdit m_editLicense;
   CLabel            m_lblServer;  CEdit m_editServer;
   CLabel            m_lblMagic;   CEdit m_editMagic;
   CCheckBox         m_chkCent;
   
   // --- TAB RISCO ---
   CLabel            m_lblRisk;    CEdit m_editRisk;
   CLabel            m_lblPLMin;   CEdit m_editPLMin;
   CLabel            m_lblPLDrop;  CEdit m_editPLDrop;
   CCheckBox         m_chkDaily;
   CLabel            m_lblDailyTg; CEdit m_editDailyTg;
   CLabel            m_lblDailyLs; CEdit m_editDailyLs;
   
   // --- TAB LIMITES ---
   CLabel            m_lblSLFx;    CEdit m_editSLFx;
   CLabel            m_lblSLJpy;   CEdit m_editSLJpy;
   CLabel            m_lblSLGold;  CEdit m_editSLGold;
   CLabel            m_lblMaxOrd;  CEdit m_editMaxOrd;
   
   // --- TAB TRAILING ---
   CCheckBox         m_chkTrail;
   CLabel            m_lblTStart;  CEdit m_editTStart;
   CLabel            m_lblTDist;   CEdit m_editTDist;
   CLabel            m_lblTStep;   CEdit m_editTStep;

   // Botão Guardar
   CButton           m_btnSave;

   int               m_currentTab;

public:
                     CAuraPanel(void);
                    ~CAuraPanel(void);
   virtual bool      Create(const long chart, const string name, const int subwin, const int x1, const int y1, const int x2, const int y2);
   virtual bool      OnEvent(const int id, const long &lparam, const double &dparam, const string &sparam);

protected:
   bool              CreateTabs(void);
   bool              CreateElements(void);
   void              HideAll(void);
   void              SwitchTab(int tab);
   void              SaveConfig(void);
   void              LoadConfig(void);
   void              FillUI(void);
};

//+------------------------------------------------------------------+
//| Implementação                                                    |
//+------------------------------------------------------------------+
CAuraPanel::CAuraPanel(void) : m_currentTab(1) {}
CAuraPanel::~CAuraPanel(void) {}

bool CAuraPanel::Create(const long chart, const string name, const int subwin, const int x1, const int y1, const int x2, const int y2)
{
   if(!CAppDialog::Create(chart, name, subwin, x1, y1, x2, y2)) return false;
   
   if(!CreateTabs()) return false;
   if(!CreateElements()) return false;
   
   // Botão Salvar
   if(!m_btnSave.Create(m_chart_id, m_name + "BtnSave", m_subwin, 10, y2-y1-40, x2-x1-10, y2-y1-10)) return false;
   m_btnSave.Text("GUARDAR CONFIGURAÇÃO");
   if(!Add(m_btnSave)) return false;
   
   LoadConfig();
   SwitchTab(1); // Inicia na Tab Geral
   
   return true;
}

bool CAuraPanel::CreateTabs(void)
{
   int y = 5, h = 30, w = 85, space = 90;
   
   if(!m_btnTabGeral.Create(m_chart_id, m_name + "Tab1", m_subwin, 10, y, 10+w, y+h)) return false;
   m_btnTabGeral.Text("Geral"); Add(m_btnTabGeral);
   
   if(!m_btnTabRisco.Create(m_chart_id, m_name + "Tab2", m_subwin, 10+space, y, 10+space+w, y+h)) return false;
   m_btnTabRisco.Text("Risco"); Add(m_btnTabRisco);

   if(!m_btnTabLimites.Create(m_chart_id, m_name + "Tab3", m_subwin, 10+(space*2), y, 10+(space*2)+w, y+h)) return false;
   m_btnTabLimites.Text("Limites"); Add(m_btnTabLimites);

   if(!m_btnTabTrailing.Create(m_chart_id, m_name + "Tab4", m_subwin, 10+(space*3), y, 10+(space*3)+w, y+h)) return false;
   m_btnTabTrailing.Text("Trailing"); Add(m_btnTabTrailing);

   return true;
}

bool CAuraPanel::CreateElements(void)
{
   int y = 50, h = 25, lx = 10, ex = 150, ew = 200;
   
   // --- TAB 1 (Geral) ---
   m_lblLicense.Create(m_chart_id, m_name + "LblLic", m_subwin, lx, y, ex, y+h); m_lblLicense.Text("Chave Licença:"); Add(m_lblLicense);
   m_editLicense.Create(m_chart_id, m_name + "EdLic", m_subwin, ex, y, ex+ew, y+h); Add(m_editLicense); y+=30;
   
   m_lblServer.Create(m_chart_id, m_name + "LblSrv", m_subwin, lx, y, ex, y+h); m_lblServer.Text("URL Servidor:"); Add(m_lblServer);
   m_editServer.Create(m_chart_id, m_name + "EdSrv", m_subwin, ex, y, ex+ew, y+h); Add(m_editServer); y+=30;
   
   m_lblMagic.Create(m_chart_id, m_name + "LblMag", m_subwin, lx, y, ex, y+h); m_lblMagic.Text("Magic Number:"); Add(m_lblMagic);
   m_editMagic.Create(m_chart_id, m_name + "EdMag", m_subwin, ex, y, ex+ew, y+h); Add(m_editMagic); y+=30;

   m_chkCent.Create(m_chart_id, m_name + "ChkCent", m_subwin, lx, y, ex+100, y+h); m_chkCent.Text("Conta Cent"); Add(m_chkCent);
   
   y = 50; // Reset Y para a próxima Tab
   // --- TAB 2 (Risco) ---
   m_lblRisk.Create(m_chart_id, m_name + "LblRsk", m_subwin, lx, y, ex, y+h); m_lblRisk.Text("Risco por Trade (%):"); Add(m_lblRisk);
   m_editRisk.Create(m_chart_id, m_name + "EdRsk", m_subwin, ex, y, ex+ew, y+h); Add(m_editRisk); y+=30;
   
   m_lblPLMin.Create(m_chart_id, m_name + "LblPL1", m_subwin, lx, y, ex, y+h); m_lblPLMin.Text("ProfitLock Mínimo ($):"); Add(m_lblPLMin);
   m_editPLMin.Create(m_chart_id, m_name + "EdPL1", m_subwin, ex, y, ex+ew, y+h); Add(m_editPLMin); y+=30;
   
   m_lblPLDrop.Create(m_chart_id, m_name + "LblPL2", m_subwin, lx, y, ex, y+h); m_lblPLDrop.Text("ProfitLock Drop (%):"); Add(m_lblPLDrop);
   m_editPLDrop.Create(m_chart_id, m_name + "EdPL2", m_subwin, ex, y, ex+ew, y+h); Add(m_editPLDrop); y+=30;

   m_chkDaily.Create(m_chart_id, m_name + "ChkDly", m_subwin, lx, y, ex+100, y+h); m_chkDaily.Text("Ativar Meta Diária"); Add(m_chkDaily); y+=30;
   
   m_lblDailyTg.Create(m_chart_id, m_name + "LblDTg", m_subwin, lx, y, ex, y+h); m_lblDailyTg.Text("Meta Diária (%):"); Add(m_lblDailyTg);
   m_editDailyTg.Create(m_chart_id, m_name + "EdDTg", m_subwin, ex, y, ex+ew, y+h); Add(m_editDailyTg); y+=30;
   
   y = 50; // Reset Y
   // --- TAB 3 (Limites) ---
   m_lblSLFx.Create(m_chart_id, m_name + "LblFx", m_subwin, lx, y, ex, y+h); m_lblSLFx.Text("Max SL Forex (Pts):"); Add(m_lblSLFx);
   m_editSLFx.Create(m_chart_id, m_name + "EdFx", m_subwin, ex, y, ex+ew, y+h); Add(m_editSLFx); y+=30;
   
   m_lblSLJpy.Create(m_chart_id, m_name + "LblJpy", m_subwin, lx, y, ex, y+h); m_lblSLJpy.Text("Max SL JPY (Pts):"); Add(m_lblSLJpy);
   m_editSLJpy.Create(m_chart_id, m_name + "EdJpy", m_subwin, ex, y, ex+ew, y+h); Add(m_editSLJpy); y+=30;

   m_lblSLGold.Create(m_chart_id, m_name + "LblGld", m_subwin, lx, y, ex, y+h); m_lblSLGold.Text("Max SL Ouro (Pts):"); Add(m_lblSLGold);
   m_editSLGold.Create(m_chart_id, m_name + "EdGld", m_subwin, ex, y, ex+ew, y+h); Add(m_editSLGold); y+=30;

   m_lblMaxOrd.Create(m_chart_id, m_name + "LblMO", m_subwin, lx, y, ex, y+h); m_lblMaxOrd.Text("Máximo Ordens:"); Add(m_lblMaxOrd);
   m_editMaxOrd.Create(m_chart_id, m_name + "EdMO", m_subwin, ex, y, ex+ew, y+h); Add(m_editMaxOrd); y+=30;

   y = 50; // Reset Y
   // --- TAB 4 (Trailing) ---
   m_chkTrail.Create(m_chart_id, m_name + "ChkTrl", m_subwin, lx, y, ex+100, y+h); m_chkTrail.Text("Ativar Trailing Stop"); Add(m_chkTrail); y+=30;

   m_lblTStart.Create(m_chart_id, m_name + "LblT1", m_subwin, lx, y, ex, y+h); m_lblTStart.Text("Trailing Start (Pts):"); Add(m_lblTStart);
   m_editTStart.Create(m_chart_id, m_name + "EdT1", m_subwin, ex, y, ex+ew, y+h); Add(m_editTStart); y+=30;

   m_lblTDist.Create(m_chart_id, m_name + "LblT2", m_subwin, lx, y, ex, y+h); m_lblTDist.Text("Trailing Distance (Pts):"); Add(m_lblTDist);
   m_editTDist.Create(m_chart_id, m_name + "EdT2", m_subwin, ex, y, ex+ew, y+h); Add(m_editTDist); y+=30;
   
   return true;
}

void CAuraPanel::HideAll(void) {
   m_lblLicense.Hide(); m_editLicense.Hide(); m_lblServer.Hide(); m_editServer.Hide(); m_lblMagic.Hide(); m_editMagic.Hide(); m_chkCent.Hide();
   m_lblRisk.Hide(); m_editRisk.Hide(); m_lblPLMin.Hide(); m_editPLMin.Hide(); m_lblPLDrop.Hide(); m_editPLDrop.Hide(); m_chkDaily.Hide(); m_lblDailyTg.Hide(); m_editDailyTg.Hide();
   m_lblSLFx.Hide(); m_editSLFx.Hide(); m_lblSLJpy.Hide(); m_editSLJpy.Hide(); m_lblSLGold.Hide(); m_editSLGold.Hide(); m_lblMaxOrd.Hide(); m_editMaxOrd.Hide();
   m_chkTrail.Hide(); m_lblTStart.Hide(); m_editTStart.Hide(); m_lblTDist.Hide(); m_editTDist.Hide();
   
   // m_btnTabGeral.ColorBackground(C'45,45,50');
   // m_btnTabRisco.ColorBackground(C'45,45,50');
   // m_btnTabLimites.ColorBackground(C'45,45,50');
   // m_btnTabTrailing.ColorBackground(C'45,45,50');
}

void CAuraPanel::SwitchTab(int tab) {
   HideAll();
   m_currentTab = tab;
   
   if(tab == 1) {
      m_lblLicense.Show(); m_editLicense.Show(); m_lblServer.Show(); m_editServer.Show(); m_lblMagic.Show(); m_editMagic.Show(); m_chkCent.Show();
      // m_btnTabGeral.ColorBackground(C'40,150,255');
   }
   if(tab == 2) {
      m_lblRisk.Show(); m_editRisk.Show(); m_lblPLMin.Show(); m_editPLMin.Show(); m_lblPLDrop.Show(); m_editPLDrop.Show(); m_chkDaily.Show(); m_lblDailyTg.Show(); m_editDailyTg.Show();
      // m_btnTabRisco.ColorBackground(C'40,150,255');
   }
   if(tab == 3) {
      m_lblSLFx.Show(); m_editSLFx.Show(); m_lblSLJpy.Show(); m_editSLJpy.Show(); m_lblSLGold.Show(); m_editSLGold.Show(); m_lblMaxOrd.Show(); m_editMaxOrd.Show();
      // m_btnTabLimites.ColorBackground(C'40,150,255');
   }
   if(tab == 4) {
      m_chkTrail.Show(); m_lblTStart.Show(); m_editTStart.Show(); m_lblTDist.Show(); m_editTDist.Show();
      // m_btnTabTrailing.ColorBackground(C'40,150,255');
   }
}

void CAuraPanel::SaveConfig(void)
{
   g_LicenseKey = m_editLicense.Text();
   g_ServerUrl = m_editServer.Text();
   g_MagicNumber = (int)StringToInteger(m_editMagic.Text());
   g_IsCentAccount = m_chkCent.Checked();
   
   g_RiskPercent = StringToDouble(m_editRisk.Text());
   g_ProfitLockMin = StringToDouble(m_editPLMin.Text());
   g_ProfitLockDrop = StringToDouble(m_editPLDrop.Text());
   g_DailyTargetLockActive = m_chkDaily.Checked();
   g_DailyTargetPct = StringToDouble(m_editDailyTg.Text());
   
   g_MaxSLForex = (int)StringToInteger(m_editSLFx.Text());
   g_MaxSLJPY = (int)StringToInteger(m_editSLJpy.Text());
   g_MaxSLOuro = (int)StringToInteger(m_editSLGold.Text());
   g_MaxOrders = (int)StringToInteger(m_editMaxOrd.Text());
   
   g_TrailingEnabled = m_chkTrail.Checked();
   g_TrailingStart = (int)StringToInteger(m_editTStart.Text());
   g_TrailingDistance = (int)StringToInteger(m_editTDist.Text());
   
   // Criar JSON Simples no FileWrite
   int handle = FileOpen("AuraForexConfig.txt", FILE_WRITE|FILE_TXT|FILE_COMMON);
   if(handle != INVALID_HANDLE) {
      FileWriteString(handle, "License=" + g_LicenseKey + "\n");
      FileWriteString(handle, "Server=" + g_ServerUrl + "\n");
      FileWriteString(handle, "Magic=" + (string)g_MagicNumber + "\n");
      FileWriteString(handle, "Cent=" + (string)g_IsCentAccount + "\n");
      
      FileWriteString(handle, "Risk=" + DoubleToString(g_RiskPercent, 2) + "\n");
      FileWriteString(handle, "PLMin=" + DoubleToString(g_ProfitLockMin, 2) + "\n");
      FileWriteString(handle, "PLDrop=" + DoubleToString(g_ProfitLockDrop, 2) + "\n");
      FileWriteString(handle, "DailyL=" + (string)g_DailyTargetLockActive + "\n");
      FileWriteString(handle, "DailyT=" + DoubleToString(g_DailyTargetPct, 2) + "\n");
      
      FileWriteString(handle, "SLFx=" + (string)g_MaxSLForex + "\n");
      FileWriteString(handle, "SLJpy=" + (string)g_MaxSLJPY + "\n");
      FileWriteString(handle, "SLGold=" + (string)g_MaxSLOuro + "\n");
      FileWriteString(handle, "MaxOrd=" + (string)g_MaxOrders + "\n");
      
      FileWriteString(handle, "TrailE=" + (string)g_TrailingEnabled + "\n");
      FileWriteString(handle, "TrailS=" + (string)g_TrailingStart + "\n");
      FileWriteString(handle, "TrailD=" + (string)g_TrailingDistance + "\n");
      
      FileClose(handle);
      Print("✅ Configuração Guardada com Sucesso no Common Files!");
   }
}

void CAuraPanel::LoadConfig(void)
{
   int handle = FileOpen("AuraForexConfig.txt", FILE_READ|FILE_TXT|FILE_COMMON);
   if(handle != INVALID_HANDLE) {
      while(!FileIsEnding(handle)) {
         string line = FileReadString(handle);
         string sep[];
         if(StringSplit(line, '=', sep) == 2) {
            if(sep[0] == "License") g_LicenseKey = sep[1];
            if(sep[0] == "Server") g_ServerUrl = sep[1];
            if(sep[0] == "Magic") g_MagicNumber = (int)StringToInteger(sep[1]);
            if(sep[0] == "Cent") g_IsCentAccount = (sep[1] == "true" || sep[1] == "1");
            
            if(sep[0] == "Risk") g_RiskPercent = StringToDouble(sep[1]);
            if(sep[0] == "PLMin") g_ProfitLockMin = StringToDouble(sep[1]);
            if(sep[0] == "PLDrop") g_ProfitLockDrop = StringToDouble(sep[1]);
            if(sep[0] == "DailyL") g_DailyTargetLockActive = (sep[1] == "true" || sep[1] == "1");
            if(sep[0] == "DailyT") g_DailyTargetPct = StringToDouble(sep[1]);
            
            if(sep[0] == "SLFx") g_MaxSLForex = (int)StringToInteger(sep[1]);
            if(sep[0] == "SLJpy") g_MaxSLJPY = (int)StringToInteger(sep[1]);
            if(sep[0] == "SLGold") g_MaxSLOuro = (int)StringToInteger(sep[1]);
            if(sep[0] == "MaxOrd") g_MaxOrders = (int)StringToInteger(sep[1]);
            
            if(sep[0] == "TrailE") g_TrailingEnabled = (sep[1] == "true" || sep[1] == "1");
            if(sep[0] == "TrailS") g_TrailingStart = (int)StringToInteger(sep[1]);
            if(sep[0] == "TrailD") g_TrailingDistance = (int)StringToInteger(sep[1]);
         }
      }
      FileClose(handle);
   }
   FillUI();
}

void CAuraPanel::FillUI(void)
{
   m_editLicense.Text(g_LicenseKey);
   m_editServer.Text(g_ServerUrl);
   m_editMagic.Text((string)g_MagicNumber);
   m_chkCent.Checked(g_IsCentAccount);
   
   m_editRisk.Text(DoubleToString(g_RiskPercent, 2));
   m_editPLMin.Text(DoubleToString(g_ProfitLockMin, 2));
   m_editPLDrop.Text(DoubleToString(g_ProfitLockDrop, 2));
   m_chkDaily.Checked(g_DailyTargetLockActive);
   m_editDailyTg.Text(DoubleToString(g_DailyTargetPct, 2));
   
   m_editSLFx.Text((string)g_MaxSLForex);
   m_editSLJpy.Text((string)g_MaxSLJPY);
   m_editSLGold.Text((string)g_MaxSLOuro);
   m_editMaxOrd.Text((string)g_MaxOrders);
   
   m_chkTrail.Checked(g_TrailingEnabled);
   m_editTStart.Text((string)g_TrailingStart);
   m_editTDist.Text((string)g_TrailingDistance);
}

bool CAuraPanel::OnEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
{
   if(id == CHARTEVENT_CUSTOM+ON_CLICK) {
      if(sparam == m_btnSave.Name()) { SaveConfig(); return true; }
      if(sparam == m_btnTabGeral.Name()) { SwitchTab(1); return true; }
      if(sparam == m_btnTabRisco.Name()) { SwitchTab(2); return true; }
      if(sparam == m_btnTabLimites.Name()) { SwitchTab(3); return true; }
      if(sparam == m_btnTabTrailing.Name()) { SwitchTab(4); return true; }
   }
   return CAppDialog::OnEvent(id, lparam, dparam, sparam);
}
