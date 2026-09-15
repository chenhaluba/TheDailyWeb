const express = require('express');
const router = express.Router();

const { createUser, deleteUser, getAllUsers, getUser, updateUser } = require('../controllers/userController');
const { validateSession } = require('../middleware/authMiddleware');
const { validateRole } = require('../middleware/roleMiddleware');


//router.get('/users', validateSession, validateRole('editor'), getAllUsers);

router.get('/user/:username', validateSession, validateRole('editor'), getUser);

router.post('/user', validateSession, validateRole('editor'), createUser);

router.put('/user', validateSession, validateRole('editor'), updateUser);

router.delete('/user', validateSession, validateRole('editor'), deleteUser);

module.exports = router;