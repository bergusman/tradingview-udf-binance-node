const express = require('express')
const app = express()

const morgan = require('morgan')
app.use(morgan('tiny'))

const cors = require('cors')
app.use(cors())

const BinanceUtils = require('./binance/utils')
const BinanceAPI = require('./binance/api')
const binance = new BinanceAPI()

var symbols = []

const Searcher = require('./searcher')
var searcher = new Searcher([])

const SEPARATE_BY_QUOTE = true

const RESOLUTIONS_INTERVALS_MAP = {
    '1': '1m',
    '3': '3m',
    '5': '5m',
    '15': '15m',
    '30': '30m',
    '60': '1h',
    '120': '2h',
    '240': '4h',
    '360': '6h',
    '480': '8h',
    '720': '12h',
    'D': '1d',
    '1D': '1d',
    '3D': '3d',
    'W': '1w',
    '1W': '1w',
    'M': '1M',
    '1M': '1M',
}

function convertSymbolToSearch(symbol) {
    return {
        symbol: symbol.symbol,
        full_name: symbol.symbol,
        description: symbol.baseAsset + ' / ' + symbol.quoteAsset,
        ticker: symbol.symbol,
        exchange: 'BINANCE',
        type: SEPARATE_BY_QUOTE ? symbol.quoteAsset.toLowerCase() : 'crypto'
    }
}

function convertSymbolToResolve(symbol) {
    function pricescale(symbol) {
        for (let filter of symbol.filters) {
            if (filter.filterType == 'PRICE_FILTER') {
                return Math.round(1 / parseFloat(filter.tickSize))
            }
        }
        return 1
    }

    return {
        name: symbol.symbol,
        ticker: symbol.symbol,
        description: `${symbol.baseAsset}/${symbol.quoteAsset}`,
        type: SEPARATE_BY_QUOTE ? symbol.quoteAsset.toLowerCase() : 'crypto',
        session: '24x7',
        exchange: 'BINANCE',
        listed_exchange: 'BINANCE',
        timezone: 'Etc/UTC',
        has_intraday: true,
        has_daily: true,
        has_weekly_and_monthly: true,
        pricescale: pricescale(symbol),
        minmovement: 1,
        minmov: 1,
        minmovement2: 0,
        minmov2: 0,
    }
}

function convertKlinesToBars(klines) {
    return {
        s: 'ok',
        t: klines.map(b => Math.floor(b[0] / 1000)),
        c: klines.map(b => parseFloat(b[4])),
        o: klines.map(b => parseFloat(b[1])),
        h: klines.map(b => parseFloat(b[2])),
        l: klines.map(b => parseFloat(b[3])),
        v: klines.map(b => parseFloat(b[5]))
    }
}

function resolve(ticker) {
    const comps = ticker.split(':')
    const exchange = (comps.length > 1 ? comps[0] : '').toUpperCase()
    const symbol = (comps.length > 1 ? comps[1] : ticker).toUpperCase()

    for (let item of symbols) {
        if (item.symbol == symbol && (exchange.length == 0 || exchange == 'BINANCE')) {
            return item
        }
    }
    return null
}

app.get('/config', (req, res) => {
    let symbolsTypes = []
    if (SEPARATE_BY_QUOTE) {
        const quotes = BinanceUtils.quotes(symbols)
            .sort(String.localeCompare)
            .map((s) => { return { name: s, value: s.toLowerCase() } })

        symbolsTypes = [{ name: 'All', value: '' }].concat(quotes)
    } else {
        symbolsTypes = [{
            name: 'Cryptocurrency',
            value: 'crypto'
        }]
    }

    res.send({
        supports_search: true,
        supports_group_request: false,
        supports_marks: false,
        supports_timescale_marks: false,
        supports_time: true,
        exchanges: [
            {
                value: 'BINANCE',
                name: 'Binance',
                desc: ''
            }
        ],
        symbols_types: symbolsTypes,
        supported_resolutions: [
            '1', '3', '5', '15', '30',                  // Minutes
            '60', '120', '240', '360', '480', '720',    // Hours
            '1D', '3D',                                 // Days
            '1W',                                       // Weeks
            '1M'                                        // Months
        ]
    })
})

app.get('/symbols', (req, res) => {
    if (!req.query.symbol) {
        return res.status(400).send({ s: 'error', errmsg: 'Need symbol in query' })
    }

    const symbol = resolve(req.query.symbol)
    if (!symbol) {
        return res.status(404).send({ s: 'no_data' })
    }

    res.send(convertSymbolToResolve(symbol))
})

app.get('/search', (req, res) => {
    res.send(searcher.search(
        req.query.query,
        req.query.type,
        req.query.exchange,
        req.query.limit
    ))
})

app.get('/history', (req, res) => {
    let from = req.query.from
    if (!from) {
        return res.status(400).send({s: 'error', errmsg: 'Need from in query'})
    }

    let to = req.query.to
    if (!to) {
        return res.status(400).send({s: 'error', errmsg: 'Need to in query'})
    }

    from *= 1000
    to *= 1000

    if (!req.query.symbol) {
        return res.status(400).send({s: 'error', errmsg: 'Need symbol in query'})
    }

    if (!req.query.resolution) {
        return res.status(400).send({s: 'error', errmsg: 'Need resolution in query'})
    }

    const interval = RESOLUTIONS_INTERVALS_MAP[req.query.resolution]
    if (!interval) {
        return res.status(400).send({s: 'error', errmsg: 'Unsupported resolution'})
    }

    //console.log('------------------------------')
    //console.log('From:', new Date(from).toUTCString())
    //console.log('To:  ', new Date(to).toUTCString())

    let totalKlines = []

    function finishKlines() {
        //console.log('Total:', totalKlines.length)
        if (totalKlines.length == 0) {
            res.send({
                s: 'no_data'
            })
        } else {
            res.send(convertKlinesToBars(totalKlines))
        }
    }

    function getKlines(from, to) {
        binance.klines(req.query.symbol, interval, from, to, 500).then(klines => {
            totalKlines = totalKlines.concat(klines)
            //console.log(klines.length)
    
            if (klines.length == 500) {
                from = klines[klines.length - 1][0] + 1
                getKlines(from, to)
            } else {
                finishKlines()
            }        
        }).catch(err => {
            console.error(err)
            res.status(500).send({s: 'error', errmsg: 'Internal error'})
        })
    }

    getKlines(from, to)
})

app.get('/time', (req, res) => {
    binance.time().then(json => {
        res.send(Math.floor(json.serverTime / 1000) + '')
    }).catch(err => {
        console.error(err)
        res.status(500).send()
    })
})

function listen() {
    const port = process.env.PORT || 8888
    app.listen(port, () => {
        console.log(`Listening on port ${port}\n`)
    })
}

binance.exchangeInfo().then(info => {
    console.log(`Load ${info.symbols.length} symbols`)
    symbols = info.symbols
    searcher = new Searcher(info.symbols.map(convertSymbolToSearch))
    listen()
}).catch(err => {
    console.error(err)
    process.exit(1)
})
