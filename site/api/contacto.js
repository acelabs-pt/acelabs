function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }
  body = body || {};

  const { nome, email, telefone, empresa, horario, contacto_preferido, mensagem, empresa_site } = body;

  // Campo honeypot: bots preenchem, humanos nunca veem este campo.
  if (empresa_site) {
    return res.status(200).json({ ok: true });
  }

  if (!nome || !email || !mensagem) {
    return res.status(400).json({ error: 'missing_fields' });
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (typeof email !== 'string' || !emailRe.test(email)) {
    return res.status(400).json({ error: 'invalid_email' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY nao configurada no Vercel');
    return res.status(500).json({ error: 'server_misconfigured' });
  }

  const html = [
    '<p><strong>Nome:</strong> ' + escapeHtml(nome) + '</p>',
    '<p><strong>Email:</strong> ' + escapeHtml(email) + '</p>',
    '<p><strong>Telefone:</strong> ' + escapeHtml(telefone || '-') + '</p>',
    '<p><strong>Empresa:</strong> ' + escapeHtml(empresa || '-') + '</p>',
    '<p><strong>Melhor horário para ligar:</strong> ' + escapeHtml(horario || '-') + '</p>',
    '<p><strong>Contacto preferido:</strong> ' + escapeHtml(contacto_preferido || '-') + '</p>',
    '<p><strong>Mensagem:</strong><br>' + escapeHtml(mensagem).replace(/\n/g, '<br>') + '</p>',
  ].join('\n');

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Ace Labs <site@acelabs.pt>',
        to: ['miguel@acelabs.pt'],
        bcc: ['pedro@acelabs.pt'],
        reply_to: email,
        subject: 'Novo pedido de diagnostico - ' + nome,
        html: html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('Resend error', resendRes.status, errText);
      return res.status(502).json({ error: 'send_failed' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erro ao enviar email', err);
    return res.status(500).json({ error: 'send_failed' });
  }
};
