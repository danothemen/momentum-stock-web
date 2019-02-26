const Alpaca = require("@alpacahq/alpaca-trade-api");
const axios = require("axios");
const key = "PKVEH6QH9AXZLJFYA5ND";
const secret = "r3xYidniil78fAdZrHKA8uBvrQZHeXd6unVPuELw";
const alpaca = new Alpaca({
  keyId: key,
  secretKey: secret,
  paper: true
});

async function getAllTickers(){
    let snapshotUrl = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${key}`;
    var allTickers = await axios.get(snapshotUrl);
    return allTickers;
}

// We only consider stocks with per-share prices inside this range
const min_share_price = 2.0;
const max_share_price = 13.0;

// Minimum previous-day dollar volume for a stock we might consider
min_last_dv = 500000;

// Stop limit to default to
default_stop = .95;

// How much of our portfolio to allocate to any one position
risk = 0.25;

function print(obj){
    console.log(obj);
}

async function get1000mHistoryData(symbols){
    console.log("Getting historical data");
    var toReturn = {};
    for(var i = 0; i < symbols.length; i++){
        var symbol = symbols[i];
        toReturn[symbol] = await alpaca.getHistoricAggregates("minute",symbol,{limit:1000});
        console.log(`${i}/${symbols.length}`);
    }
    console.log("Got historical data");
    return toReturn;
}

async function getTickers(){
    print('Getting current ticker data...');
    print('Success.');
    var assets = await alpaca.getAssets({tradable:true,status:'active'});
    var symbols = [];
    assets.forEach((e)=>{symbols.push(e.symbol);});
    alpaca.getLastTrade()
    print(symbols);
    //TODO: filter out the symbols based on min and max price
    var allTickers = await getAllTickers();
    
    return [ticker for ticker in tickers if (
        ticker.ticker in symbols and
        ticker.lastTrade['p'] >= min_share_price and
        ticker.lastTrade['p'] <= max_share_price and
        ticker.prevDay['v'] * ticker.lastTrade['p'] > min_last_dv and
        ticker.todaysChangePerc >= 3.5
    )]
}
getTickers();