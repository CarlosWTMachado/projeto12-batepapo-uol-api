import express, { json } from 'express';
import cors from 'cors';
import dotenv from "dotenv";
import {MongoClient, ObjectId} from "mongodb";
import dayjs from 'dayjs';
import joi from 'joi';
import { stripHtml } from "string-strip-html";

const server = express();
server.use(cors());
server.use(json());

dotenv.config();

let participantesCollection = null;
let mensagensCollection = null;
const mongoClient = new MongoClient(process.env.MONGO_URI);
mongoClient.connect().then(() => {
	participantesCollection = mongoClient.db("bate-papo-uol").collection("participantes");
	mensagensCollection = mongoClient.db("bate-papo-uol").collection("mensagens");
});

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
		await mensagensCollection.insertOne({
			from: from,
			to: to,
			text: text,
			type: type,
			time: dayjs().format('HH:mm:ss')
		});
	}catch (error){
		throw error;
	}
}

server.post('/participants', async (req, res) => {
	const validation = participanteSchema.validate({name: req.body.name}, { abortEarly: true });
	if(validation.error) return res.sendStatus(422);
	const name = stripHtml(req.body.name).result.trim();
	const encontrado = await participantesCollection.findOne({name: name});
	if(!encontrado){
		try {
			await participantesCollection.insertOne({
				name: name, 
				lastStatus: Date.now()
			});
			await sendMessage(name, 'Todos', 'entra na sala...', 'status');
			res.sendStatus(201);
		} catch (error) {
			res.status(500).send(error);
		}
	}else return res.sendStatus(409);
});

server.get('/participants', async (_, res) => {
	try {
		const participantes = await participantesCollection.find({}).toArray();
		res.status(200).send(participantes);
	} catch (error) {
		res.status(500).send(error);
	}
});

server.post('/messages', async (req, res) => {
	const validation = mensagemSchema.validate({
		from: req.headers.user,
		to: req.body.to,
		text: req.body.text,
		type: req.body.type
	}, { abortEarly: true });
	if(validation.error) return res.sendStatus(422);
	const to = stripHtml(req.body.to).result.trim();
	const text = stripHtml(req.body.text).result.trim();
	const type = stripHtml(req.body.type).result.trim();
	const user = stripHtml(req.headers.user).result.trim();
	const encontrado = await participantesCollection.findOne({name: user});
	if(!encontrado) return res.status(404).send("usuario nao cadastrado");
	try {
		await sendMessage(user, to, text, type);
		res.sendStatus(201);
	} catch (error) {
		res.status(500).send(error);
	}
});

server.get('/messages', async (req, res) => {
	const { limit } = parseInt(req.query);
	const validation = participanteSchema.validate({name: req.headers.user}, { abortEarly: true });
	if(validation.error) return res.sendStatus(422);
	const user = stripHtml(req.headers.user).result.trim();
	try {
		const mensagens = await mensagensCollection.find({}).toArray();
		const mensagens_permitidas = mensagens.filter(value => (
			value.from === user ||
			value.to === user ||
			value.to === "Todos" ||
			value.type === "messages"
		));
		res.send((!limit) ? (mensagens_permitidas) : (mensagens_permitidas.slice(-limit)));
	} catch (error) {
		res.status(500).send(error);
	}
});

server.post('/status', async (req, res) => {
	const validation = participanteSchema.validate({name: req.headers.user}, { abortEarly: true });
	if(validation.error) return res.status(422).send("Envie um usuario valido");
	const user = stripHtml(req.headers.user).result.trim();
	const participante = await participantesCollection.findOne({name: user});
	if(!participante) return res.status(404).send("usuario nao cadastrado");
	try {
		const promise_status = await participantesCollection
		.updateOne({name: user}, {$set: {lastStatus: Date.now()}});
		res.sendStatus(200);
	} catch (error) {
		res.status(500).send(error);
	}
});

server.delete('/messages/:id', async (req, res) => {
	const validation = participanteSchema.validate({name: req.headers.user}, { abortEarly: true });
	if(validation.error) return res.status(422).send("Envie um usuario valido");
	const user = stripHtml(req.headers.user).result.trim();
	const { id } = req.params;
	const mensagem = await mensagensCollection.findOne({_id: ObjectId(id)});
	if(!mensagem) return res.sendStatus(404);
	if(mensagem.from !== user) return res.sendStatus(401);
	try {
		await mensagensCollection.deleteOne({_id: new ObjectId(id)});
		res.status(200).send("removido");
	} catch (error) {
		res.status(500).send(error);
	}
});

server.put('/messages/:id', async (req, res) => {
	const { id } = req.params;
	const validation = mensagemSchema.validate({
		from: req.headers.user,
		to: req.body.to,
		text: req.body.text,
		type: req.body.type
	}, { abortEarly: true });
	if(validation.error) return res.status(422).send("Todos os campos sao obrigatorios");
	const user = stripHtml(req.headers.user).result.trim();
	const to = stripHtml(req.body.to).result.trim();
	const text = stripHtml(req.body.text).result.trim();
	const type = stripHtml(req.body.type).result.trim();
	const mensagem = await mensagensCollection.findOne({_id: ObjectId(id)});
	if(!mensagem) return res.sendStatus(404);
	if(mensagem.from !== user) return res.sendStatus(401);
	try {
		await mensagensCollection
		.updateOne({_id: new ObjectId(id)}, {$set: {
			to: to,
			text: text,
			type: type,
			time: dayjs().format('HH:mm:ss')
		}});
		res.status(200).send("modificado");
	} catch (error) {
		res.status(500).send(error);
	}
});

setInterval(async () => {
	const tempo_atual = Date.now();
	const participantes = await participantesCollection.find({}).toArray();
	const participantes_inativos = participantes.filter(
		(participante) => (tempo_atual - participante.lastStatus) > 10000
	);
	participantes_inativos.forEach(async (participante) => {
		try {
			await sendMessage(participante.name, 'Todos', 'sai da sala...', 'status');
			await participantesCollection.deleteOne({name: participante.name});
			console.log("removido");
		} catch (error) {
			console.log(error);
		}
	});
}, 150000);

server.listen(5000, () => {
	console.log("Rodando em http://localhost:5000");
});