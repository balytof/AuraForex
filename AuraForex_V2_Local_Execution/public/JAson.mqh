//+------------------------------------------------------------------+
//|                                                        JAson.mqh |
//|                                  Copyright 2026, AuraForex Corp  |
//|                                             https://auraforex.pt |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, AuraForex Corp"
#property link      "https://auraforex.pt"
#property strict

enum ENUM_JTYPE { jtUNDEF, jtOBJ, jtARRAY, jtSTR, jtINT, jtDBL, jtBOOL, jtNULL };

class CJAVal
{
public:
   ENUM_JTYPE  m_type;
   string      m_key;
   string      m_bv;
   CJAVal      *m_parent;
   CJAVal      *m_data[];

   CJAVal() : m_type(jtUNDEF), m_parent(NULL), m_bv("") {}
   CJAVal(CJAVal *parent, ENUM_JTYPE type) : m_parent(parent), m_type(type), m_bv("") {}
   CJAVal(const CJAVal &other) { Copy(other); }
   ~CJAVal() { Clear(); }

   void operator=(const CJAVal &other) { Copy(other); }

   void Copy(const CJAVal &other)
   {
      Clear();
      m_type = other.m_type;
      m_key  = other.m_key;
      m_bv   = other.m_bv;
      // Note: m_parent is not copied to avoid loops, usually handled by owner
      for(int i = 0; i < ArraySize(other.m_data); i++)
      {
         CJAVal *v = new CJAVal();
         v.Copy(*other.m_data[i]);
         v.m_parent = GetPointer(this);
         int sz = ArraySize(m_data);
         ArrayResize(m_data, sz + 1);
         m_data[sz] = v;
      }
   }

   void Clear()
   {
      for(int i = 0; i < ArraySize(m_data); i++) if(CheckPointer(m_data[i]) == POINTER_DYNAMIC) delete m_data[i];
      ArrayFree(m_data);
      m_type = jtUNDEF;
   }

   CJAVal operator[](string key)
   {
      if(m_type != jtOBJ) { m_type = jtOBJ; Clear(); }
      for(int i = 0; i < ArraySize(m_data); i++) if(m_data[i].m_key == key) return *m_data[i];
      CJAVal *v = new CJAVal(GetPointer(this), jtUNDEF);
      v.m_key = key;
      int s = ArraySize(m_data);
      ArrayResize(m_data, s + 1);
      m_data[s] = v;
      return *v;
   }

   CJAVal operator[](int i)
   {
      if(m_type != jtARRAY) { m_type = jtARRAY; Clear(); }
      int s = ArraySize(m_data);
      if(i >= s)
      {
         for(int j = s; j <= i; j++)
         {
            ArrayResize(m_data, j + 1);
            m_data[j] = new CJAVal(GetPointer(this), jtUNDEF);
         }
      }
      return *m_data[i];
   }

   void operator=(string v) { m_bv = v; m_type = jtSTR; }
   void operator=(double v) { m_bv = (string)v; m_type = jtDBL; }
   void operator=(int v)    { m_bv = (string)v; m_type = jtINT; }
   void operator=(bool v)   { m_bv = (string)v; m_type = jtBOOL; }

   string ToStr() { return m_bv; }
   double ToDbl() { return StringToDouble(m_bv); }
   int    ToInt() { return (int)StringToInteger(m_bv); }
   bool   ToBool(){ return (m_bv != "0" && m_bv != "false" && m_bv != ""); }
   int    Size() { return ArraySize(m_data); }

   string Serialize()
   {
      string s = "";
      if(m_type == jtOBJ)
      {
         s = "{";
         for(int i = 0; i < ArraySize(m_data); i++)
         {
            s += "\"" + m_data[i].m_key + "\":";
            s += m_data[i].Serialize();
            if(i < ArraySize(m_data) - 1) s += ",";
         }
         s += "}";
      }
      else if(m_type == jtARRAY)
      {
         s = "[";
         for(int i = 0; i < ArraySize(m_data); i++)
         {
            s += m_data[i].Serialize();
            if(i < ArraySize(m_data) - 1) s += ",";
         }
         s += "]";
      }
      else if(m_type == jtSTR)  s = "\"" + m_bv + "\"";
      else                      s = m_bv;
      return s;
   }

   bool Deserialize(string s, int &pos)
   {
      Clear();
      Skip(s, pos);
      if(pos >= StringLen(s)) return false;
      ushort c = StringGetCharacter(s, pos);
      if(c == '{') return ParseObj(s, pos);
      if(c == '[') return ParseArray(s, pos);
      if(c == '\"') return ParseStr(s, pos);
      return ParseValue(s, pos);
   }

   bool Deserialize(string s) { int pos = 0; return Deserialize(s, pos); }

private:
   void Skip(string s, int &pos)
   {
      while(pos < StringLen(s))
      {
         ushort c = StringGetCharacter(s, pos);
         if(c > 32) break;
         pos++;
      }
   }

   bool ParseObj(string s, int &pos)
   {
      m_type = jtOBJ;
      pos++; // skip '{'
      while(pos < StringLen(s))
      {
         Skip(s, pos);
         if(StringGetCharacter(s, pos) == '}') { pos++; return true; }
         CJAVal *v = new CJAVal(GetPointer(this), jtUNDEF);
         if(!v.ParseKey(s, pos)) { delete v; return false; }
         Skip(s, pos);
         if(StringGetCharacter(s, pos) != ':') { delete v; return false; }
         pos++;
         if(!v.Deserialize(s, pos)) { delete v; return false; }
         int sz = ArraySize(m_data);
         ArrayResize(m_data, sz + 1);
         m_data[sz] = v;
         Skip(s, pos);
         ushort c = (ushort)StringGetCharacter(s, pos);
         if(c == ',') pos++;
         else if(c == '}') { pos++; return true; }
      }
      return false;
   }

   bool ParseKey(string s, int &pos)
   {
      Skip(s, pos);
      if(StringGetCharacter(s, pos) != '\"') return false;
      pos++;
      int start = pos;
      while(pos < StringLen(s))
      {
         if(StringGetCharacter(s, pos) == '\"')
         {
            m_key = StringSubstr(s, start, pos - start);
            pos++;
            return true;
         }
         pos++;
      }
      return false;
   }

   bool ParseArray(string s, int &pos)
   {
      m_type = jtARRAY;
      pos++; // skip '['
      while(pos < StringLen(s))
      {
         Skip(s, pos);
         if(StringGetCharacter(s, pos) == ']') { pos++; return true; }
         CJAVal *v = new CJAVal(GetPointer(this), jtUNDEF);
         if(!v.Deserialize(s, pos)) { delete v; return false; }
         int sz = ArraySize(m_data);
         ArrayResize(m_data, sz + 1);
         m_data[sz] = v;
         Skip(s, pos);
         ushort c = (ushort)StringGetCharacter(s, pos);
         if(c == ',') pos++;
         else if(c == ']') { pos++; return true; }
      }
      return false;
   }

   bool ParseStr(string s, int &pos)
   {
      m_type = jtSTR;
      pos++; // skip '\"'
      int start = pos;
      while(pos < StringLen(s))
      {
         if(StringGetCharacter(s, pos) == '\"' && StringGetCharacter(s, pos - 1) != '\\')
         {
            m_bv = StringSubstr(s, start, pos - start);
            m_bv = Unescape(m_bv);
            pos++;
            return true;
         }
         pos++;
      }
      return false;
   }

   bool ParseValue(string s, int &pos)
   {
      Skip(s, pos);
      int start = pos;
      while(pos < StringLen(s))
      {
         ushort c = StringGetCharacter(s, pos);
         if(c == ',' || c == '}' || c == ']' || c <= 32) break;
         pos++;
      }
      m_bv = StringSubstr(s, start, pos - start);
      if(m_bv == "true" || m_bv == "false") m_type = jtBOOL;
      else if(m_bv == "null") m_type = jtNULL;
      else m_type = jtDBL;
      return true;
   }

   string Unescape(string s)
   {
      StringReplace(s, "\\\"", "\"");
      StringReplace(s, "\\\\", "\\");
      StringReplace(s, "\\/", "/");
      StringReplace(s, "\\b", ShortToString(8));
      StringReplace(s, "\\f", ShortToString(12));
      StringReplace(s, "\\n", "\n");
      StringReplace(s, "\\r", "\r");
      StringReplace(s, "\\t", "\t");
      return s;
   }
};
