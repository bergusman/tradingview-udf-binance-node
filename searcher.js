module.exports = class Searcher {
    constructor(symbols) {
        this.symbols = symbols.sort((a, b) => a.symbol.localeCompare(b.symbol) )
    }

    search(query, type, exchange, limit) {
        query = (query || '').toUpperCase()
        type = type || ''
        exchange = exchange || ''
        limit = parseInt(limit) || this.symbols.length

        let result = []

        for (let symbol of this.symbols) {
            if (type.length > 0 && type != symbol.type) {
                continue
            }
            if (exchange.length > 0 && exchange != symbol.exchange) {
                continue
            }
            
            if (symbol.symbol.toUpperCase().indexOf(query) >= 0) {
                result.push(symbol)
            }
        }

        return result.slice(0, limit)
    }
}
