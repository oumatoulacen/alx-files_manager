const express = require('express');

// create a new express route
const route = express.Router();

// import the controllers
const AppController = require('../controllers/AppController');
const UsersController = require('../controllers/UsersController');
const AuthController = require('../controllers/AuthController');
const FilesController = require('../controllers/FilesController');

// endpoint to check the status of the API
route.get('/status', AppController.getStatus);
route.get('/stats', AppController.getStats);

// endpoint to create a new user
route.post('/users', UsersController.postNew);

// endpoint to log a user in and out
route.get('/connect', AuthController.getConnect);
route.get('/disconnect', AuthController.getDisconnect);
route.get('/users/me', AuthController.getMe);

// endpoint to create a new file
route.post('/files', FilesController.postUpload);
route.get('/files/:id', FilesController.getShow);
route.get('/files', FilesController.getIndex);

module.exports = route;
