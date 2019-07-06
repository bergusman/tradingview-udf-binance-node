/**
 * Validate and sanitize query parameters.
 */

class QueryError extends Error {
    constructor(status, message) {
        super(message)
        this.status = status
    }

    static missing(param) {
        return new QueryError(400, `Missing mandatory parameter '${param}'`)
    }

    static empty(param) {
        return new QueryError(400, `Empty parameter '${param}'`)
    }

    static mailformed(param) {
        return new QueryError(400, `Malformed parameter '${param}'`)
    }
}

function mandatory(req, param, regexp) {
    if (req.query[param] === undefined || req.query[param] === null) {
        throw QueryError.missing(param)
    }
    if (req.query[param] === '') {
        throw QueryError.empty(param)
    }
    if (regexp) {
        if (!regexp.test(req.query[param])) {
            throw QueryError.mailformed(param)
        }
    }
}

function optional(req, param, regexp) {
    if (req.query[param] === undefined || req.query[param] === null) {
        return
    }
    if (req.query[param] === '') {
        req.query[param] = null
        return
    }
    if (regexp) {
        if (!regexp.test(req.query[param])) {
            throw QueryError.mailformed(param)
        }
    }
}

function optionalInt(req, param) {
    optional(req, param, /^\d+$/)
    if (req.query[param]) {
        const number = parseInt(req.query[param])
        if (isNaN(number)) {
            throw QueryError.mailformed(param)
        }
        req.query[param] = number
    }
}

module.exports = {
    Error: QueryError,

    symbol(req, res, next) {
        mandatory(req, 'symbol', /^\S+$/)
        next()
    },

    query(req, res, next) {
        mandatory(req, 'query', /^.+$/)
        next()
    },

    limit(req, res, next) {
        optionalInt(req, 'limit')
        next()
    },

    from(req, res, next) {
        optionalInt(req, 'from')
        next()
    },

    to(req, res, next) {
        optionalInt(req, 'to')
        next()
    },

    resolution(req, res, next) {
        mandatory(req, 'resolution', /^[A-Z0-9]+$/)
        next()
    }
}
