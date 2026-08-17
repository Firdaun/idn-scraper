import { web } from './application/web.js'

web.listen(3000, '0.0.0.0', () => {
    console.log(`Server is running on port ${3000}`)
})