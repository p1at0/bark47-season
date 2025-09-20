const crypto = require('crypto');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  try {
    const data = JSON.parse(event.body || '{}');
    const { hash, ...fields } = data;
    const token = process.env.BOT_TOKEN;
    if (!token) return { statusCode: 500, body: JSON.stringify({ error: 'BOT_TOKEN is not set' }) };

    const checkString = Object.keys(fields).sort().map(k => `${k}=${fields[k]}`).join('\n');
    const secret = crypto.createHash('sha256').update(token).digest();
    const hmac = crypto.createHmac('sha256', secret).update(checkString).digest('hex');

    if (hmac !== hash) return { statusCode: 403, body: JSON.stringify({ error: 'Invalid hash' }) };

    const now = Math.floor(Date.now() / 1000);
    const authDate = Number(fields.auth_date || 0);
    if (!authDate || now - authDate > 86400) return { statusCode: 403, body: JSON.stringify({ error: 'Auth data is too old' }) };

    return { statusCode: 200, body: JSON.stringify({ ok:true, user: {
      id: fields.id, username: fields.username || '', first_name: fields.first_name || '', last_name: fields.last_name || '', photo_url: fields.photo_url || ''
    }})};
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
};