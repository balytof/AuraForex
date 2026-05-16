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
 * Helper para chamar a API do Gemini 1.5 Flash
 */
async function callGeminiAI(userMessage) {
    // 1. Tentar buscar a chave e URL na base de dados (Configurada no Admin)
    let apiKey = process.env.GEMINI_API_KEY;
    let apiUrl = "https://generativelanguage.googleapis.com";

    try {
        const settings = await prisma.systemSettings.findFirst();
        if (settings) {
            if (settings.geminiApiKey && !settings.geminiApiKey.includes("COLOQUE_SUA_CHAVE")) {
                apiKey = settings.geminiApiKey;
            }
            if (settings.geminiApiUrl) {
                apiUrl = settings.geminiApiUrl.replace(/\/$/, ""); // Remove barra final se houver
            }
        }
    } catch (dbErr) {
        console.warn("[AURA] Erro ao buscar SystemSettings, usando fallback do env.", dbErr);
    }
    
    // Se não houver chave real, retorna null para cair no fallback
    if (!apiKey || apiKey.includes("COLOQUE_SUA_CHAVE")) {
        console.warn("[AURA] ⚠️ Chave GEMINI_API_KEY não configurada no .env nem no Banco de Dados.");
        return null;
    }

    try {
        const url = `${apiUrl}/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ 
                        parts: [{ 
                            text: `Você é a Aura, a assistente de IA da AuraTrade.\n\nCONTEXTO DO SISTEMA:\n${AURA_KNOWLEDGE}\n\nPERGUNTA DO USUÁRIO:\n${userMessage}\n\nResponda de forma curta, prestativa e profissional.` 
                        }] 
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 1024,
                    }
                }),
            }
        );

        const data = await response.json();
        
        if (data.error) {
            console.error("[AURA-GEMINI-API-ERROR]", data.error);
            return null;
        }

        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            return data.candidates[0].content.parts[0].text;
        }
        return null;
    } catch (err) {
        console.error("[AURA-GEMINI-FETCH-ERROR]", err);
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

        // Fallback Inteligente se o Gemini falhar ou não estiver configurado
        const m = message.toLowerCase();
        let reply = "Olá! Eu sou a **Aura**, a assistente oficial da AuraTrade. Como posso ajudar com sua primeira conta?";

        if (m.includes("como funciona") || m.includes("o que é") || m.includes("sobre")) {
            reply = "A **AuraTrade** é um ecossistema de trading institucional non-custodial. \n\n1. Você escolhe um plano de licença.\n2. Conecta sua conta MT5.\n3. O robô opera automaticamente seguindo Smart Money Concepts.\n\nSeus fundos ficam sempre na sua corretora, nós nunca tocamos no seu dinheiro!";
        } else if (m.includes("investir") || m.includes("plano") || m.includes("preço") || m.includes("valor")) {
            reply = "Temos diversos planos (Starter, Pro, Institutional) conforme sua banca! Veja a seção **'Planos'** na nossa página inicial para detalhes de validade e suporte.";
        } else if (m.includes("rede") || m.includes("convite") || m.includes("afiliado") || m.includes("patrocinador")) {
            reply = "A AuraTrade funciona via convites. Se não tem um patrocinador direto, use o código oficial **C6D1F1F9** no registo para garantir suporte prioritário!";
        } else if (m.includes("seguro") || m.includes("confiável") || m.includes("dinheiro")) {
            reply = "Sim, a AuraTrade é **Non-Custodial**. Isso significa que você não deposita dinheiro connosco. Seus fundos ficam na sua conta de corretora e apenas você tem o poder de levantamento.";
        } else if (m.includes("olá") || m.includes("oi") || m.includes("bom dia") || m.includes("boa tarde")) {
            reply = "Olá! Sou a Aura. Estou pronta para tirar suas dúvidas sobre a AuraTrade. O que gostaria de saber?";
        }

        return res.json({ reply });

    } catch (err) {
        console.error("[AURA-CHAT-ERROR]", err);
        res.status(500).json({ error: "Erro interno na Aura." });
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
        const m = message.toLowerCase();
        let reply = "Desculpe, não entendi perfeitamente. Pode reformular? Sou treinada para ajudar com 'instalação', 'plano de rede', 'segurança' ou 'renovação'.";
        
        if (m.includes("rede") || m.includes("afiliado") || m.includes("comissão") || m.includes("ganhar")) {
            reply = "Nosso **Plano de Rede** distribui 14% em 5 níveis de profundidade:\n- 1º Nível: **6%** (Indicação Direta)\n- 2º Nível: **4%**\n- 3º Nível: **2%**\n- 4º Nível: **1%**\n- 5º Nível: **1%**\n\nAs comissões são pagas instantaneamente após a ativação da licença do seu indicado.";
        } else if (m.includes("instalar") || m.includes("configurar") || m.includes("mt5") || m.includes("setup")) {
            reply = "Para configurar o seu robô **SMC V8.1**:\n1. Descarregue o ficheiro `.ex5` no seu Dashboard.\n2. Abra o MT5 > Ficheiro > Abrir Pasta de Dados > MQL5 > Experts e cole o ficheiro.\n3. Vá a Ferramentas > Opções > Expert Advisors e ative o 'Allow WebRequest' para o nosso domínio.\n4. Arraste o bot para um gráfico (ex: EURUSD M15) e insira sua chave de licença.";
        } else if (m.includes("seguro") || m.includes("corretora") || m.includes("custódia")) {
            reply = "A AuraTrade é **Non-Custodial**. Isso significa que a tecnologia opera na sua conta mas o capital nunca sai da sua corretora de confiança. Você mantém 100% do controlo e pode desligar o sistema a qualquer momento.";
        } else if (m.includes("olá") || m.includes("oi") || m.includes("aura") || m.includes("ajuda")) {
            reply = "Olá! Eu sou a **Aura**, sua assistente inteligente da AuraTrade. Como posso ajudar com sua operação institucional hoje?";
        }

        return res.json({ reply });
    } catch (err) {
        console.error("[AURA-AI-ERROR]", err);
        res.status(500).json({ error: "Erro interno na Aura." });
    }
});

module.exports = router;
