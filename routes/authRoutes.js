const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/login', (req, res) => {
    res.render('auth/login.ejs');
});

router.post('/login', authController.login);

router.get('/logout', authController.logout);

module.exports = router;