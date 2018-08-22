module.exports = {
    quotes: (symbols) => {
        return [...symbols.reduce((a, s) => a.add(s.quoteAsset), new Set())]
    }
}
