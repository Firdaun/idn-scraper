import express from 'express'
import cors from 'cors'
import { errorMiddleware } from '../middleware/errorMiddleware.js'
import { router } from '../routes/api.js'

export const web = express()

web.use(cors())
web.use(express.json())

web.get('/', (_, res) => {
    res.send({ message: 'Backend terkoneksi dengan baik' })
})

web.use(router)

web.use(errorMiddleware)