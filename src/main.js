import 'dotenv/config'
import { web } from './application/web.js'

const PORT = process.env.PORT || 3000

web.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`)
})