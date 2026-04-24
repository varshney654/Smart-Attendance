const axios = require('axios');

async function test() {
  try {
    const api = axios.create({ baseURL: 'http://127.0.0.1:5000/api' });

    console.log('Registering user...');
    const email = `test${Date.now()}@example.com`;
    try {
      await api.post('/auth/register', {
        name: 'Test User',
        email: email,
        password: 'password123',
        role: 'Admin',
        department: 'IT'
      });
    } catch (e) {
      console.log('Register failed (might exist):', e.response?.data || e.message);
    }

    console.log('Logging in...');
    const loginRes = await api.post('/auth/login', {
      email: email,
      password: 'password123'
    });
    const token = loginRes.data.token;
    console.log('Got token:', token.substring(0, 10) + '...');

    console.log('Fetching dashboard...');
    const dashRes = await api.get('/analytics/dashboard', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Dashboard data:', dashRes.data);
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}

test();
