import express, { json } from 'express';
import cors from 'cors';

const server = express();
server.use(cors());
server.use(json());

server.listen(5000, () => {
	console.log("Rodando em http://localhost:5000");
});