import express, { json } from 'express';
import cors from 'cors';
import dotenv from "dotenv";
import {MongoClient} from "mongodb";
import dayjs from 'dayjs';
import joi from 'joi';

const server = express();
server.use(cors());
server.use(json());

dotenv.config();

let db = null;
const mongoClient = new MongoClient(process.env.MONGO_URI);
const promise = mongoClient.connect();
promise.then(() => db = mongoClient.db("bate-papo-uol"));

const participanteSchema = joi.object({
	name: joi.string().required(),
	lastStatus: joi.number()
});

const mensagemSchema = joi.object({
	from: joi.string().required(),
	to: joi.string().required(),
	text: joi.string().required(),
	type: joi.string().pattern(new RegExp('^(private_)?message$')),
	time: joi.string()
});

async function sendMessage(from, to, text, type){
	try{
		await db.collection("mensagens").insertOne({
			from: from,
			to: to,
			text: text,
			type: type,
			time: dayjs().format('HH:mm:ss')
		});
	}catch (error){
		return error;
	}
	
}

server.post('/participants', async (req, res) => {
	const { name } = req.body;
	const validation = participanteSchema.validate({name: name}, { abortEarly: true });
	if(validation.error) return res.sendStatus(422);
	const encontrado = await db.collection("participantes").findOne({name: name});
	if(!encontrado){
		try {
			await db.collection("participantes").insertOne({
				name: name, 
				lastStatus: Date.now()
			});
			await sendMessage(name, 'Todos', 'entra na sala...', 'status');
			res.sendStatus(201);
		} catch (error) {
			console.log(error);
		}
	}else return res.sendStatus(409);
});

server.get('/participants', async (_, res) => {
	try {
		const participantes = await db.collection("participantes").find({}).toArray();
		res.status(200).send(participantes);
	} catch (error) {
		res.status(408).send(error);
	}
});

server.post('/messages', async (req, res) => {
	const { to, text, type } = req.body;
	const { user } = req.headers;
	const validation = mensagemSchema.validate({
		from: user,
		to: to,
		text: text,
		type: type
	}, { abortEarly: true });
	if(validation.error) return res.status(422).send("Todos os campos sao obrigatorios");
	const encontrado = await db.collection("participantes").findOne({name: user});
	if(!encontrado) return res.status(404).send("usuario nao cadastrado");
	try {
		await sendMessage(user, to, text, type);
		res.sendStatus(201);
	} catch (error) {
		res.status(408).send(error);
	}
});

server.get('/messages', async (req, res) => {
	const { limit } = req.query;
	const { user } = req.headers;
	const validation = participanteSchema.validate({name: user}, { abortEarly: true });
	if(validation.error) return res.sendStatus(422);
	try {
		const mensagens = await db.collection("mensagens").find({}).toArray();
		const mensagens_permitidas = mensagens.filter(value => (
			value.from === user ||
			value.to === user ||
			value.to === "Todos" ||
			value.type === "messages"
		));
		res.send((!limit) ? (mensagens_permitidas) : (mensagens_permitidas.slice(-limit)));
	} catch (error) {
		res.status(408).send(error);
	}
});

server.post('/status', async (req, res) => {
	const { user } = req.headers;
	const validation = participanteSchema.validate({name: user}, { abortEarly: true });
	if(validation.error) return res.status(422).send("Envie um usuario valido");
	const participante = await db.collection("participantes").findOne({name: user});
	if(!participante) return res.status(404).send("usuario nao cadastrado");
	try {
		const promise_status = await db.collection("participantes")
		.updateOne({name: user}, {$set: {lastStatus: Date.now()}});
		res.sendStatus(200);
	} catch (error) {
		res.status(408).send(error);
	}
});

server.delete('/messages/:id', async (req, res) => {
	const { user } = req.headers;
	const validation = participanteSchema.validate({name: user}, { abortEarly: true });
	if(validation.error) return res.status(422).send("Envie um usuario valido");
	const id = req.params.id;
	const mensagem = await db.collection("mensagens").findOne({id});
	if(!mensagem) return res.sendStatus(404);
	res.send(mensagem);
});

setInterval(async () => {
	const tempo_atual = Date.now();
	const participantes = await db.collection("participantes").find({}).toArray();
	const participantes_inativos = participantes.filter(
		(participante) => (tempo_atual - participante.lastStatus) > 10000
	);
	participantes_inativos.forEach(async (participante) => {
		try {
			await sendMessage(participante.name, 'Todos', 'sai da sala...', 'status');
			await db.collection("participantes").deleteOne({name: participante.name});
			console.log("removido");
		} catch (error) {
			console.log(error);
		}
	});
}, 15000);

server.listen(5000, () => {
	console.log("Rodando em http://localhost:5000");
});