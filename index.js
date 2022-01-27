import express, { json } from "express";
import cors from 'cors'

const app = express()

app.use(json())
app.use(cors())

let nome
let mensagens

app.post('/participants', (req, res) => {

    nome = req.body
    res.send('ok')
})

app.get('/participants', (req, res) => {

    res.send(nome)
})

app.post('/messages', (req, res) => {

    mensagens = req.body
    res.send('ok')
})

app.get('/messages', (req, res) => {

    res.send(mensagens)
})

app.post('/status', (req, res) => {

    console.log(req.headers.user)
})

app.listen(5000, () => console.log('Rodando na porta 5000'))