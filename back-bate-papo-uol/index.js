import express, { json } from 'express';
import cors from 'cors';
import dotenv from "dotenv";
import {MongoClient} from "mongodb";
import dayjs from 'dayjs';

const server = express();
server.use(cors());
server.use(json());

dotenv.config();


let db = null;
const mongoClient = new MongoClient(process.env.MONGO_URI);
const promise = mongoClient.connect();
promise.then(() => db = mongoClient.db("bate-papo-uol"));

server.post('/participants', (req, res) => {
	const { name } = req.body;
	if(!name) return res.sendStatus(422);
	const promise_find = db.collection("participantes").findOne({name: name});
	promise_find.then(participante => {
		if(!participante){
			const promise_inserir = db.collection("participantes").insertOne({
				name: name, 
				lastStatus: Date.now()
			});
			promise_inserir.then(() => {
				const promise_mensagem = db.collection("mensagens").insertOne({
					from: name,
					to: 'Todos', 
					text: 'entra na sala...', 
					type: 'status', 
					time: dayjs().format('HH:mm:ss')
				});
				promise_mensagem.then(() => res.sendStatus(201));
				promise_mensagem.catch(e => console.log("deu erro pra inserir a mensagem"));
			});
			promise_inserir.catch(e => console.log("deu erro pra inserir o participante"));
		}
		else return res.sendStatus(409);
	});
});


server.get('/participants', (_, res) => {
	const promise = db.collection("participantes").find({}).toArray();
	promise.then(participantes => res.send(participantes));
	promise.catch(e => console.log(e));
});

server.post('/messages', (req, res) => {
	const { to, text, type } = req.body;
	const { user } = req.headers;
	if(!to || !text || !type || !user) return res.status(422).send("Todos os campos sao obrigatorios");
	if(type !== 'message' && type !== 'private_message') return res.status(422).send("type deve ser 'message' ou 'private_message'");
	const promise_find = db.collection("participantes").findOne({name: user});
	promise_find.then(participante => {
		if(!participante) return res.status(422).send("usuario nao cadastrado");
		else{
			const promise_mensagem = db.collection("mensagens").insertOne({
				from: user,
				to: to, 
				text: text, 
				type: type, 
				time: dayjs().format('HH:mm:ss')
			});
			promise_mensagem.then(() => res.sendStatus(201));
			promise_mensagem.catch(e => console.log("deu erro pra inserir a mensagem"));
		}
	});
});

server.listen(5000, () => {
	console.log("Rodando em http://localhost:5000");
});