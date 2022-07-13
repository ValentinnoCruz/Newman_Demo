const express = require('express');
const route = express.Router();
const UserController = require('../controllers/userController');
route.post('/init', UserController.init)

module.exports = route;
