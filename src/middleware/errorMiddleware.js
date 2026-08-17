import { ResponseError } from "../error/responseError.js"

const errorMiddleware = async (err, _, res, next) => {
    if (!err) {
        next()
        return
    }

    if (err instanceof ResponseError) {
        res.status(err.status).json({
            errors: `${err.message}`
        })
    } else {
        res.status(500).json({
            errors: err.message
        })
    }
}

export { errorMiddleware }