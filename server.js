const express = require('express');

const routes = require('./routes/index');

// env variables
const port = process.env.PORT || 5000;

// app
const app = express();

// middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes
app.use('/', routes);

// start server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
