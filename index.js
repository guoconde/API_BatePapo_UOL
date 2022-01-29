import express, { json } from "express";
import cors from 'cors'
import { MongoClient } from "mongodb";
import dotenv from 'dotenv';
import joi from "joi";
import dayjs from "dayjs";

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
    type: joi.alternatives().try(joi.string().valid('message'), joi.string().valid('private_message')).required(),
    from: joi.string()
})

const mongoClient = new MongoClient(process.env.MONGO_URI)
let db
mongoClient.connect(() => {
    db = mongoClient.db('chat_UOL')
})

app.post('/participants', async (req, res) => {

    mongoClient.connect(() => {
        db = mongoClient.db('chat_UOL')
    })

    const nameIsValid = await db.collection('participants').findOne({ name: req.body.name })

    if (nameIsValid) {
        res.sendStatus(409)
        return
    }

    const validation = nameSchema.validate(req.body)

    if (validation.error) {
        res.sendStatus(422)
        return
    }

    try {

        await db.collection('participants').insertOne({ ...req.body, lastStatus: Date.now() })

        await db.collection('messages').insertOne(
            {
                from: req.body.name,
                to: 'Todos',
                text: 'entra na sala...',
                type: 'status',
                time: dayjs(Date.now()).format('hh:mm:ss')
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

    mongoClient.connect(() => {
        db = mongoClient.db('chat_UOL')
    })

    try {

        const participants = await db.collection('participants').find().toArray()
        res.send(participants)
        mongoClient.close()

    } catch (error) {

        console.error(error)
        res.sendStatus(500)
        mongoClient.close()

    }

})

app.post('/messages', async (req, res) => {

    const from = req.headers.user

    mongoClient.connect(() => {
        db = mongoClient.db('chat_UOL')
    })

    const validation = messageSchema.validate(req.body)

    if (validation.error) {
        res.sendStatus(422)
        return
    }

    try {

        await db.collection('messages').insertOne(
            {
                ...req.body,
                from: from,
                time: dayjs(Date.now()).format('hh:mm:ss')
            }
        )
        res.sendStatus(201)
        mongoClient.close()

    } catch (error) {

        console.error(error)
        res.sendStatus(error)
        mongoClient.close()

    }

})

app.get('/messages', async (req, res) => {

    const msg = req.headers.user

    const limit = req.query.limit

    mongoClient.connect(() => {
        db = mongoClient.db('chat_UOL')
    })

    
    try {
        const arrMessages = await db.collection('messages').find().toArray()
    
        const arrFilterFrom = arrMessages.filter(a => a.from === msg)
        const arrFilterTo = arrMessages.filter(a => a.to === 'Todos')
        const newArrMessages = [...arrFilterFrom, ...arrFilterTo]

        if(arrMessages.length >= limit) {
            const arrLimit = newArrMessages.slice(-limit)
            res.send(arrLimit)
            mongoClient.close()
        } 
        else {
            res.send(newArrMessages)
            mongoClient.close()
        }


    } catch (error) {
        console.error(error)
        res.sendStatus(500)
        mongoClient.close()
    }
})

app.post('/status', (req, res) => {

    console.log(req.headers.user)
})

app.listen(5000, () => console.log('Rodando na porta 5000'))