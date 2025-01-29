import http from 'http';
import app from './app.js';
import dotenv from 'dotenv';
dotenv.config();

const port = process.env.PORT || 3000;

const server = http.createServer(app);

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});