import express, { json } from "express";
import cors from 'cors'
import { MongoClient, ObjectId } from "mongodb";
import dotenv from 'dotenv';
import joi from "joi";
import dayjs from "dayjs";
import { stripHtml } from "string-strip-html";

const app = express()
dotenv.config()

app.use(json())
app.use(cors())

const nameSchema = joi.object({
    name: joi.string().required()
})

const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.alternatives().valid('message', 'private_message').required(),
    from: joi.string()
})

async function mongoConnect() {

    try {
        const mongoClient = new MongoClient(process.env.MONGO_URI);
        await mongoClient.connect()
        const db = mongoClient.db('chat_UOL')
        return { mongoClient, db };
    } catch (error) {
        console.error(error)
    }
};

setInterval(async () => {

    const { mongoClient, db } = await mongoConnect()

    const participants = await db.collection('participants').find().toArray()

    try {

        for (let participant of participants) {
            if (participant.lastStatus < Date.now() - 10000) {

                await db.collection('messages').insertOne(
                    {
                        from: participant.name,
                        to: 'Todos',
                        text: 'Sai da sala...',
                        type: 'status',
                        time: dayjs(Date.now()).format('hh:mm:ss')
                    }
                )
                await db.collection('participants').deleteOne({ _id: participant._id })
            }
        }
        mongoClient.close()

    } catch (error) {
        console.error(error)
        mongoClient.close()
    }

}, 15000);

app.post('/participants', async (req, res) => {

    const participant = req.body

    participant.name = stripHtml(participant.name).result.trim()

    const { mongoClient, db } = await mongoConnect()

    const nameIsValid = await db.collection('participants').findOne({ name: participant.name })

    if (nameIsValid) {
        res.sendStatus(409)
        return
    }

    const validation = nameSchema.validate(participant)

    if (validation.error) {
        res.sendStatus(422)
        return
    }

    try {

        await db.collection('participants').insertOne({ ...participant, lastStatus: Date.now() })
        await db.collection('messages').insertOne(
            {
                from: participant.name,
                to: 'Todos',
                text: 'entra na sala...',
                type: 'status',
                time: dayjs().format('hh:mm:ss')
            }
        )
        res.sendStatus(201)
        mongoClient.close()

    } catch (error) {
        console.error(error)
        res.sendStatus(500)
        mongoClient.close()
    }

})

app.get('/participants', async (req, res) => {

    const { mongoClient, db } = await mongoConnect()

    try {
        const participants = await db.collection('participants').find({}).toArray()
        res.send(participants)
        mongoClient.close()

    } catch (error) {
        console.error(error)
        res.sendStatus(500)
        mongoClient.close()
    }

})

app.post('/messages', async (req, res) => {

    const { mongoClient, db } = await mongoConnect()

    const from = req.headers.user
    const msg = { ...req.body, from }

    msg.from = stripHtml(msg.from).result.trim()
    msg.to = stripHtml(msg.to).result.trim()
    msg.text = stripHtml(msg.text).result.trim()
    msg.type = stripHtml(msg.type).result.trim()

    const validation = messageSchema.validate(msg)

    if (validation.error) {
        res.sendStatus(422)
        return
    }

    try {
        await db.collection('messages').insertOne(
            {
                ...msg,
                time: dayjs().format('hh:mm:ss')
            }
        )
        res.sendStatus(201)
        mongoClient.close()

    } catch (error) {
        res.sendStatus(error)
        mongoClient.close()
    }

})

app.get('/messages', async (req, res) => {

    const { mongoClient, db } = await mongoConnect()

    const user = req.headers.user

    const limit = parseInt(req.query.limit)

    try {
        const arrMessages = await db.collection('messages').find(
            {
                $or: [{ to: 'Todos' }, { from: user }, { to: user }, { type: 'message' }]
            }
        ).toArray()

        if (arrMessages.length >= limit) {
            const arrLimit = arrMessages.slice(-limit)
            res.send(arrLimit)
        }
        else {
            res.send(arrMessages)
        }
        mongoClient.close()

    } catch (error) {
        console.error(error)
        res.sendStatus(500)
        mongoClient.close()
    }
})

app.post('/status', async (req, res) => {

    const { mongoClient, db } = await mongoConnect()

    const user = req.headers.user

    try {
        const participants = await db.collection('participants').findOne({ name: user })

        if (participants.name) {
            await db.collection('participants').updateOne({ _id: participants._id }, { $set: { lastStatus: Date.now() } })
            res.sendStatus(200)
        } else {
            res.sendStatus(404)
        }

        mongoClient.close()

    } catch (error) {
        console.error(error)
        mongoClient.close()
    }
})

app.delete('/messages/:id', async (req, res) => {

    const { mongoClient, db } = await mongoConnect()

    const id = req.params.id

    const user = req.headers.user

    try {
        const msgIsValid = await db.collection('messages').findOne({ _id: new ObjectId(id) })

        if (!msgIsValid) {
            res.sendStatus(404)
            mongoClient.close()
            return
        }

        if (user !== msgIsValid.from) {
            res.sendStatus(401)
            mongoClient.close()
            return
        }

        await db.collection('messages').deleteOne({ _id: new ObjectId(id) })
        res.sendStatus(200)
        mongoClient.close()

    } catch (error) {
        console.error(error)
        mongoClient.close()
    }
})

app.put('/messages/:id', async (req, res) => {

    const { mongoClient, db } = await mongoConnect()

    const id = req.params.id
    const from = req.headers.user
    const msg = { ...req.body, from }

    msg.to = stripHtml(msg.to).result.trim()
    msg.text = stripHtml(msg.text).result.trim()
    msg.type = stripHtml(msg.type).result.trim()
    msg.from = stripHtml(msg.from).result.trim()
    
    const validation = messageSchema.validate(msg)
    
    msg.lastStatus = dayjs().format('hh:mm:ss')

    if (validation.error) {
        res.sendStatus(422)
        return
    }

    try {

        const msgIsValid = await db.collection('messages').findOne({ _id: new ObjectId(id) })

        if (!msgIsValid) {
            res.sendStatus(404)
            mongoClient.close()
            return
        }

        if (from !== msgIsValid.from) {
            res.sendStatus(401)
            mongoClient.close()
            return
        }

        await db.collection('messages').updateOne({ _id: msgIsValid._id }, { $set: msg })
        res.sendStatus(201)
        mongoClient.close()

    } catch (error) {
        res.sendStatus(error)
        mongoClient.close()
    }
})

app.listen(5000, () => console.log('Rodando na porta 5000'))