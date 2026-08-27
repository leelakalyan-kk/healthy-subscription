const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
  const { username, role } = req.body;
  res.json({
    success: true,
    user: {
      id: username || 'user_123',
      username: username || 'kalyan',
      role: role || 'seller'
    },
    token: 'jwt_mock_token'
  });
});

router.post('/register', (req, res) => {
  res.json({ success: true, message: 'Registered successfully' });
});

module.exports = router;
