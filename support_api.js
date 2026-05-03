const express = require("express");
const router = express.Router();
const prisma = require("./db");
const jwt = require("jsonwebtoken");
const fetch = require("node-fetch");

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
- Responda no idioma que o usuário falar (PT, EN, ES, FR).
`;

/**
 * Helper para chamar a API do Gemini
 */
async function callGeminiAI(userMessage) {
    const apiKey = process.env.GEMINI_API_KEY;
    
    // Se não houver chave real, retorna null para cair no fallback
    if (!apiKey || apiKey === "COLOQUE_SUA_CHAVE_AQUI" || apiKey === "COLOQUE_AQUI_SUA_CHAVE_GEMINI") {
        return null;
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ 
                        parts: [{ 
                            text: `SISTEMA: ${AURA_KNOWLEDGE}\n\nUSUÁRIO: ${userMessage}` 
                        }] 
                    }],
                }),
            }
        );

        const data = await response.json();
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            return data.candidates[0].content.parts[0].text;
        }
        return null;
    } catch (err) {
        console.error("[AURA-GEMINI-ERROR]", err);
        return null;
    }
}

router.post("/chat/public", async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Mensagem vazia." });
    
    try {
        const aiReply = await callGeminiAI(message);
        if (aiReply) {
            return res.json({ reply: aiReply });
        }

        // Fallback se o Gemini falhar ou não estiver configurado
        let reply = "Olá! Sou a Aura. Como posso ajudar com sua primeira conta na AuraTrade?";
        const m = message.toLowerCase();
        if (m.includes("investir") || m.includes("plano") || m.includes("preço")) {
            reply = "Temos diversos planos conforme sua banca! Veja a seção 'Planos' na nossa página inicial.";
        } else if (m.includes("rede") || m.includes("convite")) {
            reply = "A AuraTrade funciona via convites. Se não tem um, use o código oficial **1630FBED** no registo!";
        }
        return res.json({ reply });

    } catch (err) {
        res.status(500).json({ error: "Erro na Aura." });
    }
});

// Middleware de autenticação simples
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
    if (!message) return res.status(400).json({ error: "Mensagem vazia." });

    try {
        const aiReply = await callGeminiAI(message);
        if (aiReply) {
            return res.json({ reply: aiReply });
        }

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
    } catch (err) {
        console.error("[AURA-AI-ERROR]", err);
        res.status(500).json({ error: "Erro na Aura." });
    }
});

module.exports = router;
