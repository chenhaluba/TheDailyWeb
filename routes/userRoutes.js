const express = require('express');
const router = express.Router();

const { createUser, deleteUser, getAllUsers, getUser, updateUser } = require('../controllers/userController');
const { validateSession } = require('../middleware/authMiddleware');
const { validateRole } = require('../middleware/roleMiddleware');

router.get('/', validateSession, validateRole('editor'), getAllUsers);

router.get('/:username', validateSession, validateRole('editor'), getUser);

router.post('/', validateSession, validateRole('editor'), createUser);

router.put('/', validateSession, validateRole('editor'), updateUser);

router.delete('/', validateSession, validateRole('editor'), deleteUser);
saddsa
module.exports = router;