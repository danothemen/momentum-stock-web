const Alpaca = require("@alpacahq/alpaca-trade-api");
const key = "PK0P4FZK0S4LMVD36VN7";
const secret = "I0NtyoxIRrGeVFptPWQByDAWfLOrClfpeQ3GX/HV";
const alpaca = new Alpaca({keyId: key, secretKey: secret, paper: true});
const MACD = require('technicalindicators').MACD;

async function getAllTickers() {
    let snapshotUrl = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${key}`;

    var toReturn = new Promise((res, rej) => {
        var request = require("request");

        var options = {
            method: "GET",
            url: "https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers",
            qs: {
                apiKey: key
            }
        };

        request(options, function (error, response, body) {
            if (error){
                rej(error);
            }         
            else{res(JSON.parse(body));}
        });
    });
    return toReturn;
}

// We only consider stocks with per-share prices inside this range
const min_share_price = 2.0;
const max_share_price = 13.0;

// Minimum previous-day dollar volume for a stock we might consider
min_last_dv = 500000;

// Stop limit to default to
default_stop = 0.95;

// How much of our portfolio to allocate to any one position
risk = 0.25;



function print(obj) {
    console.log(obj);
}

const snooze = ms => new Promise(resolve => setTimeout(resolve, ms));

function getMarketOpen(calendarArr) {
    var year = parseInt(calendarArr[0].date.split("-")[0]);
    var month = parseInt(calendarArr[0].date.split("-")[1]) - 1;
    var day = parseInt(calendarArr[0].date.split("-")[2]);
    var hourOpen = parseInt(calendarArr[0].open.split(":")[0]);
    var minuteOpen = parseInt(calendarArr[0].open.split(":")[1]);
    var marketOpen = new Date(year, month, day, hourOpen, minuteOpen, 0, 0);
    return marketOpen;
}

function getMarketClose(calendarArr) {
    var year = parseInt(calendarArr[0].date.split("-")[0]);
    var month = parseInt(calendarArr[0].date.split("-")[1]) - 1;
    var day = parseInt(calendarArr[0].date.split("-")[2]);
    var hourClose = parseInt(calendarArr[0].close.split(":")[0]);
    var minuteClose = parseInt(calendarArr[0].close.split(":")[1]);
    var marketClose = new Date(year, month, day, hourClose, minuteClose, 0, 0);
    return marketClose;
}

async function get1000mHistoryData(symbols) {
    var toReturn = {};
    for (var i = 0; i < symbols.length; i++) {
        var symbol = symbols[i];
        toReturn[symbol] = await alpaca.getHistoricAggregates("minute", symbol, {limit: 1000});
        console.log(toReturn[symbol].ticks[0]);
    }
    return toReturn;
}

async function getTickers() {
    var assets = await alpaca.getAssets({tradable: true, status: "active"});
    var symbols = [];
    assets.forEach(e => {
        symbols.push(e.symbol);
    });
    //TODO: filter out the symbols based on min and max price
    var allTickers = await getAllTickers();
    return allTickers
        .tickers
        .filter(tick => {
            var toReturn = tick.lastTrade["p"] >= min_share_price && tick.lastTrade["p"] <= max_share_price && tick.prevDay["v"] * tick.lastTrade["p"] > min_last_dv && tick.todaysChangePerc > 3.5;
            return toReturn;
        });
}
var open_orders = {};
var positions = {};
var volume_today = {};
var prev_closes = {};
var target_prices = {};
var partial_fills = {};
var minute_history = {};
function tradeUpdate(subject, data) {
    var symbol = data.order['symbol'];
    var last_order = open_orders[symbol];
    if (last_order) {
        var event = data.event
        if (event == 'partial_fill') {
            var qty = data.order['filled_qty'];
            if (data.order['side'] == 'sell') {
                qty = qty * -1;
            }
            positions[symbol] = (positions[symbol] || 0) - (partial_fills[symbol] || 0);
            partial_fills[symbol] = qty;
            positions[symbol] += qty;
            open_orders[symbol] = data.order;
        } else if (event == 'filled') {
            qty = data.order['filled_qty']
            if (data.order['side'] == 'sell') {
                qty = qty * -1
            }
            positions[symbol] = (positions[symbol] || 0) - (partial_fills[symbol] || 0);
            partial_fills[symbol] = 0;
            positions[symbol] += qty;
            open_orders[symbol] = null;
        } else if (event == 'canceled' || event == 'rejected') {
            partial_fills[symbol] = 0;
            open_orders[symbol] = null;
        }
    }
}
function getIndexForTimeStamp(symbol,ts){
    if(minute_history[symbol]){
        //console.log(minute_history[symbol].ticks);
        for(var i = 0; i < minute_history[symbol].ticks.length; i++){
            if(minute_history[symbol].ticks.t == ts){
                return i;
            }
        }
    }
    return -1;
}
function secondBar(subject, data) {
    // example second bar
    var symbol = data.sym;
    var ts = new Date(data.s);
    //console.log(symbol);
    //console.log(subject);
    console.log(data);
    var minute = new Date(ts.getFullYear(),ts.getMonth(),ts.getDate(),ts.getHours(),ts.getMinutes,0,0);
    ts = minute.getTime();
    var indexForTs = getIndexForTimeStamp(symbol,ts);
    if(indexForTs > -1){
        minute_history[symbol].ticks[indexForTs] = {
            o: data.o,
            h: data.h > minute_history[symbol].ticks[indexForTs].h ? data.h : minute_history[symbol].ticks[indexForTs].h,
            l: data.l < minute_history[symbol].ticks[indexForTs].l ? data.l : minute_history[symbol].ticks[indexForTs].l,
            c: data.c,
            v: data.v + minute_history[symbol].ticks[indexForTs].v,
            t: ts,
            d: ts
        };
    }
    else{
        minute_history[symbol].ticks.push({
            o: data.o,
            h: data.h,
            l: data.l,
            c: data.c,
            v: data.v,
            t: ts,
            d: ts
        });
    }
    var existing_order = open_orders[symbol];
    if(existing_order){
        //TODO: double check that this object definition is accurate
        var submitted_at = existing_order.submitted_at;
        var order_lifetime = ts-submitted_at;
        if(order_lifetime/1000/60 > 1){
            alpaca.cancelOrder(existing_order.id);
        }
        return;
    }
    //loc function in python is just finding the minute timestamp
    //look at https://www.npmjs.com/package/technicalindicators for MACD calculations
    /*{ sym: 'SOLO',
  v: 100,
  av: 11237696,
  op: 3.88,
  vw: 4.4749,
  o: 4.13,
  c: 4.13,
  h: 4.13,
  l: 4.13,
  a: 4.13,
  s: 1551215795000,
  e: 1551215796000 } */
}
function minuteBar(subject, data) {
    //console.log(data);
    /**
  //example minute bar
  { sym: 'SOLO',
  v: 100,
  av: 11271836,
  op: 3.99,
  vw: 4.13,
  o: 4.13,
  c: 4.13,
  h: 4.13,
  l: 4.13,
  a: 4.4743,
  z: 100,
  s: 1551215880000,
  e: 1551215940000 }
   */
}
async function run(tickers, marketOpen, marketClose) {
    let websocket = alpaca.websocket;

    websocket.onStockAggSec(secondBar);
    websocket.onStockAggMin(minuteBar);
    websocket.onOrderUpdate(tradeUpdate);
    var toSubscribe = ["trade_updates","T.AAPL","A.AAPL","Q.AAPL","AM.AAPL"];

    var symbols = [];

    for (var i = 0; i < tickers.length; i++) {
        var toAddA = "A." + tickers[i].ticker;
        var toAddAM = "AM." + tickers[i].ticker;
        toSubscribe.push(toAddA, toAddAM);

        volume_today[tickers[i].ticker] = tickers[i].day.v;
        prev_closes[tickers[i].ticker] = tickers[i].prevDay.c;
        symbols.push(tickers[i].ticker);
    }
    websocket.onStateChange(newState => {
        console.log(`State changed to ${newState}`);
      });
    websocket.onConnect(() => {
        console.log("Connected WebSocket");
        websocket.subscribe(toSubscribe);
        //console.log(websocket.subscriptionState);
    });
    websocket.onDisconnect(()=>{console.log("Web Socket Disconnected");});
    websocket.onError(()=>{console.log("Error");});
    

    minute_history = await get1000mHistoryData(symbols);
    console.log(minute_history['SRCI']);
    var portfolio_value = (await alpaca.getAccount()).portfolio_value;

    var existing_orders = await alpaca.getOrders({limit: 500});
    for (var i = 0; i < existing_orders.length; i++) {
        await alpaca.cancelOrder(existing_orders[i].id);
    }
    var stop_prices = {};
    var latest_cost_basis = {};

    var existing_positions = await alpaca.getPositions();
    for (var i = 0; i < existing_positions.length; i++) {
        if (symbols.includes(existing_positions[i].symbol)) {
            positions[existing_positions[i].symbol] = existing_positions[i].symbol.qty;
            //recalculate cost basis
            latest_cost_basis[existing_positions[i].symbol] = existing_positions[i].cost_basis;
            stop_prices[existing_positions[i].symbol] = parseFloat(existing_positions[i].cost_basis * default_stop);
        }
    }
    websocket.connect();
}
(async function () {
    var calendarArr = await alpaca.getCalendar({start: new Date(), end: new Date()});
    var marketClose = getMarketClose(calendarArr);
    var marketOpen = getMarketOpen(calendarArr);
    var currentDateTime = new Date();
    // while (currentDateTime.getTime() < marketOpen.getTime() + 60 * 1000 * 15) {
    //     await snooze(1000);
    //     console.log("Waiting for Market Open At " + marketOpen + " in " + ((currentDateTime.getTime() - marketOpen.getTime()) / 1000) + " seconds");
    //     currentDateTime = new Date();
    // }
    var tickers = await getTickers();
    await run(tickers, marketOpen, marketClose);
})();
