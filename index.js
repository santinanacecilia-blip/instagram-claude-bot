const express = require('express');
const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'meu_token_secreto';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  const body = req.body;
  console.log('Webhook recebido:', JSON.stringify(body));
  
  if (body.object === 'instagram') {
    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        if (event.message && !event.message.is_echo) {
          const senderId = event.sender.id;
          const text = event.message.text;
          console.log(`Mensagem recebida de ${senderId}: ${text}`);
          if (text) {
            try {
              const reply = await askClaude(text);
              await sendMessage(senderId, reply);
              console.log(`Resposta enviada para ${senderId}: ${reply}`);
            } catch (err) {
              console.error('Erro ao processar mensagem:', err);
            }
          }
        }
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

async function askClaude(userMessage) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: 'Você é um assistente de atendimento ao cliente do Instagram da Galera Fit Life LTDA. Responda de forma simpática, breve e profissional em português.',
      messages: [{ role: 'user', content: userMessage }]
    })
  });
  const data = await response.json();
  console.log('Resposta Claude:', JSON.stringify(data));
  if (data.content && data.content[0]) {
    return data.content[0].text;
  }
  throw new Error('Resposta inválida da API Claude');
}

async function sendMessage(recipientId, text) {
  const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: text }
    })
  });
  const data = await response.json();
  console.log('Resposta envio mensagem:', JSON.stringify(data));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
