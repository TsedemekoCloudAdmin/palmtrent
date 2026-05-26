const express = require('express');
const http = require('http');
const { validateLogin } = require('../middleware/validation');
const { validateRegistration } = require('../middleware/validation');

function createApp() {
  const app = express();
  app.use(express.json());
  app.post('/login', validateLogin, (req, res) => {
    res.json({ success: true });
  });
  app.post('/register', validateRegistration, (req, res) => {
    res.json({ success: true });
  });
  return app;
}

function request(app, body, path = '/login') {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const payload = JSON.stringify(body);
      const req = http.request({
        hostname: '127.0.0.1',
        port: server.address().port,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let raw = '';
        res.on('data', chunk => {
          raw += chunk;
        });
        res.on('end', () => {
          server.close(() => resolve({
            status: res.statusCode,
            body: raw ? JSON.parse(raw) : null
          }));
        });
      });

      req.on('error', error => {
        server.close(() => reject(error));
      });
      req.write(payload);
      req.end();
    });
  });
}

test('login validation accepts email or phone identifiers', async () => {
  const app = createApp();

  await expect(request(app, {
    email: 'shipper@example.com',
    password: 'password123'
  })).resolves.toEqual({
    status: 200,
    body: { success: true }
  });

  await expect(request(app, {
    phone: '+263771234567',
    password: 'password123'
  })).resolves.toEqual({
    status: 200,
    body: { success: true }
  });
});

test('login validation rejects missing identifiers', async () => {
  const response = await request(createApp(), {
    password: 'password123'
  });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe('Validation errors');
});

test('registration validation accepts corporate users from web signup', async () => {
  const response = await request(createApp(), {
    fullName: 'Corporate Shipper',
    email: 'ops@example.com',
    phone: '+263771234567',
    password: 'password123',
    userType: 'corporate'
  }, '/register');

  expect(response).toEqual({
    status: 200,
    body: { success: true }
  });
});
