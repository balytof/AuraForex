//+------------------------------------------------------------------+
//|                                                      AuraGUI.mqh |
//|                                  Copyright 2026, AuraForex Corp  |
//|                                   Flat Design Dark Mode Engine   |
//+------------------------------------------------------------------+
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
int    g_XAU_StepDistance = 100;
int    g_XAU_TargetPoints = 200;
int    g_XAU_ReversalPoints = 150;
int    g_XAU_HoldSeconds = 30;
int    g_TrailingStart_XAU = 200;
int    g_TrailingDistance_XAU = 300;
int    g_TrailingStep_XAU = 50;

int    g_TrailingStart_JPY = 150;
int    g_TrailingDistance_JPY = 200;
int    g_TrailingStep_JPY = 30;

int    g_TrailingStart_Forex = 100;
int    g_TrailingDistance_Forex = 150;
int    g_TrailingStep_Forex = 20;

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
//| UI CORES MODERNAS                                                |
//+------------------------------------------------------------------+
#define CLR_BG_HEADER    C'0,80,180'
#define CLR_BG_MAIN      C'20,20,22'
#define CLR_BG_TABS      C'30,30,35'
#define CLR_BG_EDIT      C'40,40,45'
#define CLR_TXT_WHITE    C'240,240,240'
#define CLR_TXT_MUTED    C'150,150,150'
#define CLR_BTN_HOVER    C'0,100,220'
#define CLR_BTN_TAB_ACT  C'0,80,180'
#define CLR_BTN_SAVE     C'10,180,50'

//+------------------------------------------------------------------+
//| Classe do Painel Principal                                       |
//+------------------------------------------------------------------+
class CAuraPanel
{
private:
   long   m_chart;
   string m_prefix;
   int    m_tab;
   bool   m_isCreated;

   // Posições base
   int m_x, m_y, m_w, m_h;
   
   // Dragging variables
   bool   m_dragging;
   int    m_dragOffsetX;
   int    m_dragOffsetY;

public:
                     CAuraPanel(void);
                    ~CAuraPanel(void);
   bool              Create(const long chart, const string name, const int subwin, const int x1, const int y1, const int x2, const int y2);
   void              Destroy(void);
   void              OnEvent(const int id, const long &lparam, const double &dparam, const string &sparam);

private:
   void              DrawBase(void);
   void              DrawTabs(void);
   void              DrawContent(void);
   void              DrawGeral(void);
   void              DrawRisco(void);
   void              DrawLimites(void);
   void              DrawTrailing(void);
   void              ClearContent(void);
   void              MoveAll(int dx, int dy);
   
   void              SaveConfig(void);
   void              LoadConfig(void);
   
   // Primitivas de Desenho
   void              CreateRect(string name, int x, int y, int w, int h, color bg, bool border=false, color borderColor=clrBlack);
   void              CreateLabel(string name, int x, int y, string text, color clr, int size=10, string font="Segoe UI");
   void              CreateEdit(string name, int x, int y, int w, int h, string text, color bg, color fg);
   void              CreateButton(string name, int x, int y, int w, int h, string text, color bg, color fg, int size=10);
   
   string            GetEditText(string name);
   void              SetEditText(string name, string text);
};

//+------------------------------------------------------------------+
//| Implementação                                                    |
//+------------------------------------------------------------------+
CAuraPanel::CAuraPanel(void) : m_tab(1), m_isCreated(false), m_prefix("AuraGUI_"), m_dragging(false) {}
CAuraPanel::~CAuraPanel(void) { Destroy(); }

bool CAuraPanel::Create(const long chart, const string name, const int subwin, const int x1, const int y1, const int x2, const int y2)
{
   m_chart = chart;
   m_prefix = name + "_";
   m_x = x1; m_y = y1;
   m_w = x2 - x1; m_h = y2 - y1;
   
   LoadConfig();
   
   DrawBase();
   DrawTabs();
   DrawContent();
   
   m_isCreated = true;
   ChartRedraw(m_chart);
   return true;
}

void CAuraPanel::Destroy(void)
{
   int total = ObjectsTotal(m_chart);
   for(int i = total - 1; i >= 0; i--) {
      string objName = ObjectName(m_chart, i);
      if(StringFind(objName, m_prefix) == 0) {
         ObjectDelete(m_chart, objName);
      }
   }
   m_isCreated = false;
   ChartRedraw(m_chart);
}

void CAuraPanel::DrawBase(void)
{
   // Sombra / Fundo
   CreateRect("BgMain", m_x, m_y, m_w, m_h, CLR_BG_MAIN, true, C'10,10,10');
   
   // Cabeçalho
   CreateRect("BgHeader", m_x, m_y, m_w, 40, CLR_BG_HEADER);
   CreateLabel("LblTitle", m_x + 20, m_y + 10, "AURA FOREX INSTITUTIONAL", clrWhite, 12, "Segoe UI Bold");
   
   // Botão Fechar X
   CreateButton("BtnClose", m_x + m_w - 40, m_y + 8, 25, 25, "X", C'200,40,40', clrWhite, 10);
   
   // Fundo das Tabs
   CreateRect("BgTabs", m_x, m_y + 40, m_w, 40, CLR_BG_TABS);
   
   // Botão Guardar e Fechar (no rodapé)
   CreateButton("BtnSave", m_x + 30, m_y + m_h - 50, m_w - 60, 35, "GUARDAR & INICIAR", CLR_BTN_SAVE, clrWhite, 11);
}

void CAuraPanel::DrawTabs(void)
{
   int tx = m_x + 20;
   int ty = m_y + 45;
   int tw = 100;
   int th = 30;
   int space = 110;
   
   CreateButton("Tab1", tx, ty, tw, th, "Geral", m_tab == 1 ? CLR_BTN_TAB_ACT : CLR_BG_EDIT, clrWhite);
   CreateButton("Tab2", tx + space, ty, tw, th, "Risco", m_tab == 2 ? CLR_BTN_TAB_ACT : CLR_BG_EDIT, clrWhite);
   CreateButton("Tab3", tx + space*2, ty, tw, th, "Limites", m_tab == 3 ? CLR_BTN_TAB_ACT : CLR_BG_EDIT, clrWhite);
   CreateButton("Tab4", tx + space*3, ty, tw, th, "Trailing", m_tab == 4 ? CLR_BTN_TAB_ACT : CLR_BG_EDIT, clrWhite);
}

void CAuraPanel::ClearContent(void)
{
   int total = ObjectsTotal(m_chart);
   for(int i = total - 1; i >= 0; i--) {
      string objName = ObjectName(m_chart, i);
      if(StringFind(objName, m_prefix + "C_") == 0) { // Todos os elementos de conteúdo terão C_
         ObjectDelete(m_chart, objName);
      }
   }
}

void CAuraPanel::MoveAll(int dx, int dy)
{
   int total = ObjectsTotal(m_chart);
   for(int i = 0; i < total; i++) {
      string objName = ObjectName(m_chart, i);
      if(StringFind(objName, m_prefix) == 0) {
         int ox = (int)ObjectGetInteger(m_chart, objName, OBJPROP_XDISTANCE);
         int oy = (int)ObjectGetInteger(m_chart, objName, OBJPROP_YDISTANCE);
         ObjectSetInteger(m_chart, objName, OBJPROP_XDISTANCE, ox + dx);
         ObjectSetInteger(m_chart, objName, OBJPROP_YDISTANCE, oy + dy);
      }
   }
   m_x += dx;
   m_y += dy;
}

void CAuraPanel::DrawContent(void)
{
   ClearContent();
   if(m_tab == 1) DrawGeral();
   if(m_tab == 2) DrawRisco();
   if(m_tab == 3) DrawLimites();
   if(m_tab == 4) DrawTrailing();
   ChartRedraw(m_chart);
}

// =======================================================
// CONTEÚDO DAS TABS
// =======================================================
void CAuraPanel::DrawGeral(void)
{
   int cy = m_y + 100; int lx = m_x + 30; int ex = m_x + 250; int ew = 200; int eh = 24;
   
   CreateLabel("C_LblLic", lx, cy+4, "Chave de Licença:", CLR_TXT_WHITE);
   CreateEdit("C_EdLic", ex, cy, 280, eh, g_LicenseKey, CLR_BG_EDIT, CLR_TXT_WHITE); cy+=35;
   
   CreateLabel("C_LblUrl", lx, cy+4, "URL do Servidor:", CLR_TXT_WHITE);
   CreateEdit("C_EdUrl", ex, cy, 280, eh, g_ServerUrl, CLR_BG_EDIT, CLR_TXT_WHITE); cy+=35;
   
   CreateLabel("C_LblMag", lx, cy+4, "Magic Number:", CLR_TXT_WHITE);
   CreateEdit("C_EdMag", ex, cy, ew, eh, (string)g_MagicNumber, CLR_BG_EDIT, CLR_TXT_WHITE); cy+=35;
   
   CreateLabel("C_LblCent", lx, cy+4, "Conta Cent (1=Sim 0=Não):", CLR_TXT_WHITE);
   CreateEdit("C_EdCent", ex, cy, 60, eh, g_IsCentAccount ? "1" : "0", CLR_BG_EDIT, CLR_TXT_WHITE); cy+=35;
}

void CAuraPanel::DrawRisco(void)
{
   int cy = m_y + 100; int lx = m_x + 30; int ex = m_x + 250; int ew = 120; int eh = 24;
   
   CreateLabel("C_LblRsk", lx, cy+4, "Risco por Trade (%):", CLR_TXT_WHITE);
   CreateEdit("C_EdRsk", ex, cy, ew, eh, DoubleToString(g_RiskPercent, 2), CLR_BG_EDIT, CLR_TXT_WHITE); cy+=35;
   
   CreateLabel("C_LblPLM", lx, cy+4, "ProfitLock Mínimo ($):", CLR_TXT_WHITE);
   CreateEdit("C_EdPLM", ex, cy, ew, eh, DoubleToString(g_ProfitLockMin, 2), CLR_BG_EDIT, CLR_TXT_WHITE); cy+=35;
   
   CreateLabel("C_LblPLD", lx, cy+4, "ProfitLock Drop (%):", CLR_TXT_WHITE);
   CreateEdit("C_EdPLD", ex, cy, ew, eh, DoubleToString(g_ProfitLockDrop, 2), CLR_BG_EDIT, CLR_TXT_WHITE); cy+=35;

   CreateLabel("C_LblDTg", lx, cy+4, "Meta Diária (%):", CLR_TXT_WHITE);
   CreateEdit("C_EdDTg", ex, cy, ew, eh, DoubleToString(g_DailyTargetPct, 2), CLR_BG_EDIT, CLR_TXT_WHITE); cy+=35;
   
   CreateLabel("C_LblDLs", lx, cy+4, "Perda Diária (%):", CLR_TXT_WHITE);
   CreateEdit("C_EdDLs", ex, cy, ew, eh, DoubleToString(g_MaxDailyLossPct, 2), CLR_BG_EDIT, CLR_TXT_WHITE); cy+=35;
}

void CAuraPanel::DrawLimites(void)
{
   int cy = m_y + 100; int lx = m_x + 30; int ex = m_x + 250; int ew = 120; int eh = 24;
   
   CreateLabel("C_LblSLF", lx, cy+4, "Max SL Forex (Pontos):", CLR_TXT_WHITE);
   CreateEdit("C_EdSLF", ex, cy, ew, eh, (string)g_MaxSLForex, CLR_BG_EDIT, CLR_TXT_WHITE); cy+=35;
   
   CreateLabel("C_LblSLJ", lx, cy+4, "Max SL JPY (Pontos):", CLR_TXT_WHITE);
   CreateEdit("C_EdSLJ", ex, cy, ew, eh, (string)g_MaxSLJPY, CLR_BG_EDIT, CLR_TXT_WHITE); cy+=35;
   
   CreateLabel("C_LblSLG", lx, cy+4, "Max SL Ouro (Pontos):", CLR_TXT_WHITE);
   CreateEdit("C_EdSLG", ex, cy, ew, eh, (string)g_MaxSLOuro, CLR_BG_EDIT, CLR_TXT_WHITE); cy+=35;

   CreateLabel("C_LblMO", lx, cy+4, "Máximo de Ordens Global:", CLR_TXT_WHITE);
   CreateEdit("C_EdMO", ex, cy, ew, eh, (string)g_MaxOrders, CLR_BG_EDIT, CLR_TXT_WHITE); cy+=35;
   
   CreateLabel("C_LblMB", lx, cy+4, "Máximo de Compras:", CLR_TXT_WHITE);
   CreateEdit("C_EdMB", ex, cy, ew, eh, (string)g_MaxBuys, CLR_BG_EDIT, CLR_TXT_WHITE); cy+=35;
   
   CreateLabel("C_LblMS", lx, cy+4, "Máximo de Vendas:", CLR_TXT_WHITE);
   CreateEdit("C_EdMS", ex, cy, ew, eh, (string)g_MaxSells, CLR_BG_EDIT, CLR_TXT_WHITE); cy+=35;
   
   
   
   
   
   
}

void CAuraPanel::DrawTrailing(void)
{
   int cy = m_y + 80; int lx = m_x + 30; int ex = m_x + 300; int ew = 100; int eh = 24;
   
   CreateLabel("C_LblTE", lx, cy+4, "Ativar Trailing (1=Sim 0=Não):", CLR_TXT_WHITE);
   CreateEdit("C_EdTE", ex, cy, 60, eh, g_TrailingEnabled ? "1" : "0", CLR_BG_EDIT, CLR_TXT_WHITE); cy+=30;
   
   CreateLabel("C_LblTSG", lx, cy+4, "Trailing Start Ouro (Pontos):", CLR_TXT_WHITE);
   CreateEdit("C_EdTSG", ex, cy, ew, eh, (string)g_TrailingStart_XAU, CLR_BG_EDIT, CLR_TXT_WHITE); cy+=30;
   
   CreateLabel("C_LblTDG", lx, cy+4, "Trailing Distance Ouro (Pontos):", CLR_TXT_WHITE);
   CreateEdit("C_EdTDG", ex, cy, ew, eh, (string)g_TrailingDistance_XAU, CLR_BG_EDIT, CLR_TXT_WHITE); cy+=30;
   
   CreateLabel("C_LblTSJ", lx, cy+4, "Trailing Start JPY (Pontos):", CLR_TXT_WHITE);
   CreateEdit("C_EdTSJ", ex, cy, ew, eh, (string)g_TrailingStart_JPY, CLR_BG_EDIT, CLR_TXT_WHITE); cy+=30;
   
   CreateLabel("C_LblTDJ", lx, cy+4, "Trailing Distance JPY (Pontos):", CLR_TXT_WHITE);
   CreateEdit("C_EdTDJ", ex, cy, ew, eh, (string)g_TrailingDistance_JPY, CLR_BG_EDIT, CLR_TXT_WHITE); cy+=30;
   
   CreateLabel("C_LblTSF", lx, cy+4, "Trailing Start Forex (Pontos):", CLR_TXT_WHITE);
   CreateEdit("C_EdTSF", ex, cy, ew, eh, (string)g_TrailingStart_Forex, CLR_BG_EDIT, CLR_TXT_WHITE); cy+=30;
   
   CreateLabel("C_LblTDF", lx, cy+4, "Trailing Distance Forex (Pontos):", CLR_TXT_WHITE);
   CreateEdit("C_EdTDF", ex, cy, ew, eh, (string)g_TrailingDistance_Forex, CLR_BG_EDIT, CLR_TXT_WHITE); cy+=30;
}

// =======================================================
// LÓGICA DE GUARDAR / EVENTOS
// =======================================================
void CAuraPanel::SaveConfig(void)
{
   // Tentar apanhar valores da tab atual antes de gravar
   if(m_tab == 1) {
      g_LicenseKey = GetEditText("C_EdLic");
      g_ServerUrl = GetEditText("C_EdUrl");
      g_MagicNumber = (int)StringToInteger(GetEditText("C_EdMag"));
      g_IsCentAccount = (GetEditText("C_EdCent") == "1");
   } else if (m_tab == 2) {
      g_RiskPercent = StringToDouble(GetEditText("C_EdRsk"));
      g_ProfitLockMin = StringToDouble(GetEditText("C_EdPLM"));
      g_ProfitLockDrop = StringToDouble(GetEditText("C_EdPLD"));
      g_DailyTargetPct = StringToDouble(GetEditText("C_EdDTg"));
      g_MaxDailyLossPct = StringToDouble(GetEditText("C_EdDLs"));
   } else if (m_tab == 3) {
      g_MaxSLForex = (int)StringToInteger(GetEditText("C_EdSLF"));
      g_MaxSLJPY = (int)StringToInteger(GetEditText("C_EdSLJ"));
      g_MaxSLOuro = (int)StringToInteger(GetEditText("C_EdSLG"));
      g_MaxOrders = (int)StringToInteger(GetEditText("C_EdMO"));
      g_MaxBuys = (int)StringToInteger(GetEditText("C_EdMB"));
      g_MaxSells = (int)StringToInteger(GetEditText("C_EdMS"));
   } else if (m_tab == 4) {
      g_TrailingEnabled = (GetEditText("C_EdTE") == "1");
      g_XAU_StepDistance = (int)StringToInteger(GetEditText("C_EdXSD"));
   g_XAU_TargetPoints = (int)StringToInteger(GetEditText("C_EdXTP"));
   g_XAU_ReversalPoints = (int)StringToInteger(GetEditText("C_EdXRP"));
   g_XAU_HoldSeconds = (int)StringToInteger(GetEditText("C_EdXHS"));

   g_TrailingStart_XAU = (int)StringToInteger(GetEditText("C_EdTSG"));
      g_TrailingDistance_XAU = (int)StringToInteger(GetEditText("C_EdTDG"));
      g_TrailingStart_JPY = (int)StringToInteger(GetEditText("C_EdTSJ"));
      g_TrailingDistance_JPY = (int)StringToInteger(GetEditText("C_EdTDJ"));
      g_TrailingStart_Forex = (int)StringToInteger(GetEditText("C_EdTSF"));
      g_TrailingDistance_Forex = (int)StringToInteger(GetEditText("C_EdTDF"));
   }

   int handle = FileOpen("AuraForexConfig.txt", FILE_WRITE|FILE_TXT|FILE_COMMON);
   if(handle != INVALID_HANDLE) {
      FileWriteString(handle, "License=" + g_LicenseKey + "\n");
      FileWriteString(handle, "Server=" + g_ServerUrl + "\n");
      FileWriteString(handle, "Magic=" + (string)g_MagicNumber + "\n");
      FileWriteString(handle, "Cent=" + (string)g_IsCentAccount + "\n");
      
      FileWriteString(handle, "Risk=" + DoubleToString(g_RiskPercent, 2) + "\n");
      FileWriteString(handle, "PLMin=" + DoubleToString(g_ProfitLockMin, 2) + "\n");
      FileWriteString(handle, "PLDrop=" + DoubleToString(g_ProfitLockDrop, 2) + "\n");
      FileWriteString(handle, "DailyT=" + DoubleToString(g_DailyTargetPct, 2) + "\n");
      FileWriteString(handle, "DailyL=" + DoubleToString(g_MaxDailyLossPct, 2) + "\n");
      
      FileWriteString(handle, "SLFx=" + (string)g_MaxSLForex + "\n");
      FileWriteString(handle, "SLJpy=" + (string)g_MaxSLJPY + "\n");
      FileWriteString(handle, "SLGold=" + (string)g_MaxSLOuro + "\n");
      FileWriteString(handle, "MaxOrd=" + (string)g_MaxOrders + "\n");
      FileWriteString(handle, "MaxBuy=" + (string)g_MaxBuys + "\n");
      FileWriteString(handle, "MaxSel=" + (string)g_MaxSells + "\n");
      
      FileWriteString(handle, "TrailE=" + (string)g_TrailingEnabled + "\n");
      FileWriteString(handle, "XAUStep=" + (string)g_XAU_StepDistance + "\n");
   FileWriteString(handle, "XAUTarget=" + (string)g_XAU_TargetPoints + "\n");
   FileWriteString(handle, "XAUReverse=" + (string)g_XAU_ReversalPoints + "\n");
   FileWriteString(handle, "XAUHold=" + (string)g_XAU_HoldSeconds + "\n");

   FileWriteString(handle, "TrailSXAU=" + (string)g_TrailingStart_XAU + "\n");
      FileWriteString(handle, "TrailDXAU=" + (string)g_TrailingDistance_XAU + "\n");
      FileWriteString(handle, "TrailSJPY=" + (string)g_TrailingStart_JPY + "\n");
      FileWriteString(handle, "TrailDJPY=" + (string)g_TrailingDistance_JPY + "\n");
      FileWriteString(handle, "TrailSFX=" + (string)g_TrailingStart_Forex + "\n");
      FileWriteString(handle, "TrailDFX=" + (string)g_TrailingDistance_Forex + "\n");
      FileClose(handle);
   }
   Print("✅ Configuração Guardada! A Fechar Painel.");
   Destroy(); // Destruir o painel
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
            if(sep[0] == "DailyT") g_DailyTargetPct = StringToDouble(sep[1]);
            if(sep[0] == "DailyL") g_MaxDailyLossPct = StringToDouble(sep[1]);
            
            if(sep[0] == "SLFx") g_MaxSLForex = (int)StringToInteger(sep[1]);
            if(sep[0] == "SLJpy") g_MaxSLJPY = (int)StringToInteger(sep[1]);
            if(sep[0] == "SLGold") g_MaxSLOuro = (int)StringToInteger(sep[1]);
            if(sep[0] == "MaxOrd") g_MaxOrders = (int)StringToInteger(sep[1]);
            if(sep[0] == "MaxBuy") g_MaxBuys = (int)StringToInteger(sep[1]);
            if(sep[0] == "MaxSel") g_MaxSells = (int)StringToInteger(sep[1]);
            
            if(sep[0] == "TrailE") g_TrailingEnabled = (sep[1] == "true" || sep[1] == "1");
            if(sep[0] == "XAUStep") g_XAU_StepDistance = (int)StringToInteger(sep[1]);
      if(sep[0] == "XAUTarget") g_XAU_TargetPoints = (int)StringToInteger(sep[1]);
      if(sep[0] == "XAUReverse") g_XAU_ReversalPoints = (int)StringToInteger(sep[1]);
      if(sep[0] == "XAUHold") g_XAU_HoldSeconds = (int)StringToInteger(sep[1]);

      if(sep[0] == "TrailSXAU") g_TrailingStart_XAU = (int)StringToInteger(sep[1]);
            if(sep[0] == "TrailDXAU") g_TrailingDistance_XAU = (int)StringToInteger(sep[1]);
            if(sep[0] == "TrailSJPY") g_TrailingStart_JPY = (int)StringToInteger(sep[1]);
            if(sep[0] == "TrailDJPY") g_TrailingDistance_JPY = (int)StringToInteger(sep[1]);
            if(sep[0] == "TrailSFX") g_TrailingStart_Forex = (int)StringToInteger(sep[1]);
            if(sep[0] == "TrailDFX") g_TrailingDistance_Forex = (int)StringToInteger(sep[1]);
         }
      }
      FileClose(handle);
   }
}

void CAuraPanel::OnEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
{
   if(!m_isCreated) return;
   
   if(id == CHARTEVENT_MOUSE_MOVE) {
      int x = (int)lparam;
      int y = (int)dparam;
      int state = (int)StringToInteger(sparam);
      bool leftClick = (state & 1) == 1;

      if(leftClick) {
         if(!m_dragging) {
            // Verificar clique na barra de título (40px de altura)
            if(x >= m_x && x <= m_x + m_w && y >= m_y && y <= m_y + 40) {
               m_dragging = true;
               m_dragOffsetX = x - m_x;
               m_dragOffsetY = y - m_y;
            }
         } else {
            int new_x = x - m_dragOffsetX;
            int new_y = y - m_dragOffsetY;
            int dx = new_x - m_x;
            int dy = new_y - m_y;
            if(dx != 0 || dy != 0) {
               MoveAll(dx, dy);
               ChartRedraw(m_chart);
            }
         }
      } else {
         m_dragging = false;
      }
   }
   
   if(id == CHARTEVENT_OBJECT_CLICK) {
      string objName = sparam;
      if(StringFind(objName, m_prefix) != 0) return;
      
      if(objName == m_prefix + "BtnClose") { Destroy(); return; }
      if(objName == m_prefix + "BtnSave") { SaveConfig(); return; }
      
      // Clique numa das tabs obriga a guardar temporariamente o estado na memoria, depois muda
      if(objName == m_prefix + "Tab1" && m_tab != 1) { m_tab = 1; DrawTabs(); DrawContent(); }
      if(objName == m_prefix + "Tab2" && m_tab != 2) { m_tab = 2; DrawTabs(); DrawContent(); }
      if(objName == m_prefix + "Tab3" && m_tab != 3) { m_tab = 3; DrawTabs(); DrawContent(); }
      if(objName == m_prefix + "Tab4" && m_tab != 4) { m_tab = 4; DrawTabs(); DrawContent(); }
   }
   
   // Quando perde o foco da textbox (EndEdit), atualizar a global imediatamente
   if(id == CHARTEVENT_OBJECT_ENDEDIT) {
      string objName = sparam;
      if(StringFind(objName, m_prefix) != 0) return;
      
      string val = GetEditText(StringSubstr(objName, StringLen(m_prefix)));
      
      if(objName == m_prefix + "C_EdLic") g_LicenseKey = val;
      if(objName == m_prefix + "C_EdUrl") g_ServerUrl = val;
      if(objName == m_prefix + "C_EdMag") g_MagicNumber = (int)StringToInteger(val);
      if(objName == m_prefix + "C_EdCent") g_IsCentAccount = (val == "1");
      
      if(objName == m_prefix + "C_EdRsk") g_RiskPercent = StringToDouble(val);
      if(objName == m_prefix + "C_EdPLM") g_ProfitLockMin = StringToDouble(val);
      if(objName == m_prefix + "C_EdPLD") g_ProfitLockDrop = StringToDouble(val);
      if(objName == m_prefix + "C_EdDTg") g_DailyTargetPct = StringToDouble(val);
      if(objName == m_prefix + "C_EdDLs") g_MaxDailyLossPct = StringToDouble(val);
      
      if(objName == m_prefix + "C_EdSLF") g_MaxSLForex = (int)StringToInteger(val);
      if(objName == m_prefix + "C_EdSLJ") g_MaxSLJPY = (int)StringToInteger(val);
      if(objName == m_prefix + "C_EdSLG") g_MaxSLOuro = (int)StringToInteger(val);
      if(objName == m_prefix + "C_EdMO")  g_MaxOrders = (int)StringToInteger(val);
      if(objName == m_prefix + "C_EdMB")  g_MaxBuys = (int)StringToInteger(val);
      if(objName == m_prefix + "C_EdMS")  g_MaxSells = (int)StringToInteger(val);
      
      if(objName == m_prefix + "C_EdTE") g_TrailingEnabled = (val == "1");
      if(objName == m_prefix + "C_EdXSD") g_XAU_StepDistance = (int)StringToInteger(val);
   if(objName == m_prefix + "C_EdXTP") g_XAU_TargetPoints = (int)StringToInteger(val);
   if(objName == m_prefix + "C_EdXRP") g_XAU_ReversalPoints = (int)StringToInteger(val);
   if(objName == m_prefix + "C_EdXHS") g_XAU_HoldSeconds = (int)StringToInteger(val);

   if(objName == m_prefix + "C_EdTSG") g_TrailingStart_XAU = (int)StringToInteger(val);
      if(objName == m_prefix + "C_EdTDG") g_TrailingDistance_XAU = (int)StringToInteger(val);
      if(objName == m_prefix + "C_EdTSJ") g_TrailingStart_JPY = (int)StringToInteger(val);
      if(objName == m_prefix + "C_EdTDJ") g_TrailingDistance_JPY = (int)StringToInteger(val);
      if(objName == m_prefix + "C_EdTSF") g_TrailingStart_Forex = (int)StringToInteger(val);
      if(objName == m_prefix + "C_EdTDF") g_TrailingDistance_Forex = (int)StringToInteger(val);
   }
}

// =======================================================
// MÉTODOS DE DESENHO VETORIAL
// =======================================================
void CAuraPanel::CreateRect(string name, int x, int y, int w, int h, color bg, bool border=false, color borderColor=clrBlack)
{
   string id = m_prefix + name;
   ObjectCreate(m_chart, id, OBJ_RECTANGLE_LABEL, 0, 0, 0);
   ObjectSetInteger(m_chart, id, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(m_chart, id, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(m_chart, id, OBJPROP_XSIZE, w);
   ObjectSetInteger(m_chart, id, OBJPROP_YSIZE, h);
   ObjectSetInteger(m_chart, id, OBJPROP_BGCOLOR, bg);
   ObjectSetInteger(m_chart, id, OBJPROP_BORDER_TYPE, BORDER_FLAT);
   ObjectSetInteger(m_chart, id, OBJPROP_COLOR, border ? borderColor : bg);
   ObjectSetInteger(m_chart, id, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(m_chart, id, OBJPROP_BACK, false);
   ObjectSetInteger(m_chart, id, OBJPROP_ZORDER, 0);
   ObjectSetInteger(m_chart, id, OBJPROP_SELECTABLE, false);
}

void CAuraPanel::CreateLabel(string name, int x, int y, string text, color clr, int size=10, string font="Segoe UI")
{
   string id = m_prefix + name;
   ObjectCreate(m_chart, id, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(m_chart, id, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(m_chart, id, OBJPROP_YDISTANCE, y);
   ObjectSetString(m_chart, id, OBJPROP_TEXT, text);
   ObjectSetInteger(m_chart, id, OBJPROP_COLOR, clr);
   ObjectSetInteger(m_chart, id, OBJPROP_FONTSIZE, size);
   ObjectSetString(m_chart, id, OBJPROP_FONT, font);
   ObjectSetInteger(m_chart, id, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(m_chart, id, OBJPROP_ZORDER, 1);
   ObjectSetInteger(m_chart, id, OBJPROP_SELECTABLE, false);
}

void CAuraPanel::CreateEdit(string name, int x, int y, int w, int h, string text, color bg, color fg)
{
   string id = m_prefix + name;
   ObjectCreate(m_chart, id, OBJ_EDIT, 0, 0, 0);
   ObjectSetInteger(m_chart, id, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(m_chart, id, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(m_chart, id, OBJPROP_XSIZE, w);
   ObjectSetInteger(m_chart, id, OBJPROP_YSIZE, h);
   ObjectSetString(m_chart, id, OBJPROP_TEXT, text);
   ObjectSetInteger(m_chart, id, OBJPROP_BGCOLOR, bg);
   ObjectSetInteger(m_chart, id, OBJPROP_COLOR, fg);
   ObjectSetInteger(m_chart, id, OBJPROP_BORDER_COLOR, C'80,80,90');
   ObjectSetInteger(m_chart, id, OBJPROP_FONTSIZE, 10);
   ObjectSetString(m_chart, id, OBJPROP_FONT, "Segoe UI");
   ObjectSetInteger(m_chart, id, OBJPROP_ALIGN, ALIGN_LEFT);
   ObjectSetInteger(m_chart, id, OBJPROP_ZORDER, 5);
   ObjectSetInteger(m_chart, id, OBJPROP_READONLY, false);
   ObjectSetInteger(m_chart, id, OBJPROP_SELECTABLE, false);
}

void CAuraPanel::CreateButton(string name, int x, int y, int w, int h, string text, color bg, color fg, int size=10)
{
   string id = m_prefix + name;
   ObjectCreate(m_chart, id, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(m_chart, id, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(m_chart, id, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(m_chart, id, OBJPROP_XSIZE, w);
   ObjectSetInteger(m_chart, id, OBJPROP_YSIZE, h);
   ObjectSetString(m_chart, id, OBJPROP_TEXT, text);
   ObjectSetInteger(m_chart, id, OBJPROP_BGCOLOR, bg);
   ObjectSetInteger(m_chart, id, OBJPROP_COLOR, fg);
   ObjectSetInteger(m_chart, id, OBJPROP_BORDER_COLOR, bg);
   ObjectSetInteger(m_chart, id, OBJPROP_FONTSIZE, size);
   ObjectSetString(m_chart, id, OBJPROP_FONT, "Segoe UI Bold");
   ObjectSetInteger(m_chart, id, OBJPROP_STATE, false);
   ObjectSetInteger(m_chart, id, OBJPROP_ZORDER, 2);
   ObjectSetInteger(m_chart, id, OBJPROP_SELECTABLE, false);
}

string CAuraPanel::GetEditText(string name)
{
   return ObjectGetString(m_chart, m_prefix + name, OBJPROP_TEXT);
}

void CAuraPanel::SetEditText(string name, string text)
{
   ObjectSetString(m_chart, m_prefix + name, OBJPROP_TEXT, text);
}
