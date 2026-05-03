const express = require("express");
const router = express.Router();
const prisma = require("./db");
const jwt = require("jsonwebtoken");

// Conhecimento da Aura (Knowledge Base)
const AURA_KNOWLEDGE = `
Você é a Aura, a assistente oficial da AuraTrade.
Seu objetivo é dar suporte preciso, coerente e educado aos usuários.

REGRAS DE CONHECIMENTO:
1. INSTALAÇÃO DO EA:
   - O usuário deve baixar o ficheiro SMC_APEX_EA.ex5.
   - Deve permitir o WebRequest para a URL do servidor nas configurações do MT5.
   - O botão "Algotrading" deve estar VERDE.
   - Deve colocar a LICENSE_KEY e a API_URL nos inputs do robô.

2. PLANO DE REDE (AFILIADOS):
   - Nível 1: 6% de comissão sobre a licença comprada.
   - Nível 2: 4%.
   - Nível 3: 2%.
   - Nível 4: 1%.
   - Nível 5: 1%.
   - Total de 14% de distribuição em rede.

3. LICENÇAS:
   - Planos variam conforme o capital da banca (ex: Starter, Pro, Institutional).
   - O suporte não pode dar licenças grátis sem aprovação do Admin.

4. ERROS COMUNS:
   - "License Expired": O usuário deve renovar a licença no dashboard.
   - "MT5 connection failure": Verificar se o token e o accountId da MetaApi estão corretos.

5. RISK MANAGER:
   - A AuraTrade possui proteção de lucro (Profit Lock).
   - O robô fecha ordens automaticamente ao atingir a meta de lucro ou drawdown máximo definido.

INSTRUÇÕES DE RESPOSTA:
- Use Markdown para formatar (negrito, listas).
- Seja direta e evite respostas muito longas a menos que seja um guia passo-a-passo.
- Se não souber a resposta, peça ao usuário para contatar o suporte humano no Telegram @AuraTradeSupport.
`;

router.post("/chat/public", async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Mensagem vazia." });
    
    try {
        const AI_KEY = process.env.SUPPORT_AI_KEY;
        if (AI_KEY && AI_KEY.startsWith("sk-")) {
            // Chamada AI (Simulada ou Real)
            return res.json({ reply: "A Aura (Pública) está ativa! (Configure a AI_KEY para respostas reais)." });
        } else {
            let reply = "Olá! Sou a Aura. Como posso ajudar com sua primeira conta na AuraTrade?";
            const m = message.toLowerCase();
            if (m.includes("investir") || m.includes("plano") || m.includes("preço")) {
                reply = "Temos diversos planos conforme sua banca! Veja a seção 'Planos' na nossa página inicial.";
            } else if (m.includes("rede") || m.includes("convite")) {
                reply = "A AuraTrade funciona via convites. Se não tem um, use o código oficial **1630FBED** no registo!";
            }
            return res.json({ reply });
        }
    } catch (err) {
        res.status(500).json({ error: "Erro na Aura." });
    }
});

// Middleware de autenticação simples (pode ser importado se houver um arquivo de utils)
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Não autorizado." });
    }
    const token = authHeader.split(" ")[1];
    try {
        const JWT_SECRET = process.env.JWT_SECRET || "auraforex_default_jwt_secret";
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Token inválido." });
    }
}

router.post("/chat", requireAuth, async (req, res) => {
    const { message } = req.body;
    const authHeader = req.headers.authorization;

    if (!message) return res.status(400).json({ error: "Mensagem vazia." });

    try {
        // [EXPERT AI LOGIC]
        // Se houver uma chave de API, usamos o LLM. Caso contrário, usamos um fallback básico.
        const AI_KEY = process.env.SUPPORT_AI_KEY;

        if (AI_KEY && AI_KEY.startsWith("sk-")) {
            // Integração Real com OpenAI (Simulação de chamada)
            // Aqui você usaria o pacote 'openai' ou um fetch direto.
            /*
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${AI_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: [
                        { role: "system", content: AURA_KNOWLEDGE },
                        { role: "user", content: message }
                    ]
                })
            });
            const data = await response.json();
            return res.json({ reply: data.choices[0].message.content });
            */
           
           // Por agora, para não travar o sistema sem a chave, vamos responder com o conhecimento base
           // ou pedir para configurar a chave no .env
           return res.json({ reply: "A Aura está quase pronta para conversar! (Configure a SUPPORT_AI_KEY no seu .env para ativar o cérebro da IA)." });
        } else {
            // Fallback Inteligente (Simple Matching)
            let reply = "Desculpe, não entendi. Pode reformular? Ou tente perguntar sobre 'instalação' ou 'plano de rede'.";
            
            const m = message.toLowerCase();
            if (m.includes("rede") || m.includes("afiliado") || m.includes("comissão")) {
                reply = "Nosso **Plano de Rede** distribui 14% em 5 níveis:\n- 1º Nível: **6%**\n- 2º Nível: **4%**\n- 3º Nível: **2%**\n- 4º Nível: **1%**\n- 5º Nível: **1%**";
            } else if (m.includes("instalar") || m.includes("configurar") || m.includes("mt5")) {
                reply = "Para instalar o **SMC APEX EA**:\n1. Baixe o .ex5 no Dashboard.\n2. No MT5, vá em Ferramentas > Opções > Expert Advisors e adicione nossa URL.\n3. Arraste o robô para o gráfico e insira sua LICENSE_KEY.";
            } else if (m.includes("olá") || m.includes("oi") || m.includes("aura")) {
                reply = "Olá! Eu sou a **Aura**, sua assistente inteligente. Como posso ajudar com seus trades hoje?";
            }

            return res.json({ reply });
        }
    } catch (err) {
        console.error("[AURA-AI-ERROR]", err);
        res.status(500).json({ error: "Erro na Aura." });
    }
});

module.exports = router;
