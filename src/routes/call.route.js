const express = require('express');
const route = express.Router();
const CallController = require('../controllers/callController');
const { isAuthorized } = require('../middlewares/authMiddleware')

route.post('/initialize', isAuthorized, CallController.initialize);
route.post('/requestserver', isAuthorized, CallController.requestServer);
route.get('/getremoteserver', isAuthorized, CallController.getRemoteServer);
route.post('/end', isAuthorized, CallController.end);

module.exports = route;
