import express, { json } from 'express';
import cors from 'cors';
import dotenv from "dotenv";
import {MongoClient} from "mongodb";

const server = express();
server.use(cors());
server.use(json());

dotenv.config();


let db = null;
const mongoClient = new MongoClient(process.env.MONGO_URI);
const promise = mongoClient.connect();
promise.then(() => db = mongoClient.db("bate-papo-uol"));

const participante = [
	{
		name: 'João', 
		lastStatus: 12313123
	}
];

const mensagem = [
	{
		from: 'João', 
		to: 'Todos', 
		text: 'oi galera', 
		type: 'message', 
		time: '20:04:37'
	}
];

server.post('/participants', (req, res) => {
	const { name } = req.body;
	if(!name) return res.sendStatus(422);
	res.send(!name);
	/*
	const receitaExistente = receitas.find(value => {return value.titulo === titulo});
	if(!receitaExistente){
		if(!titulo || !ingredientes || !preparo){
			res.status(422).send("Todos os campos são obrigatórios");
			return;
		}else{
			receitas.push({
				id: receitas.length+1,
				titulo: titulo,
				ingredientes: ingredientes,
				preparo: preparo,
				views: 0,
			});
			res.status(201).send("Criado");
			return;
		}
	}else{
		res.status(409).send("Receita já existente");
		return;
	}
	*/
});

server.listen(5000, () => {
	console.log("Rodando em http://localhost:5000");
});