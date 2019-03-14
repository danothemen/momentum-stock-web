const Alpaca = require("@alpacahq/alpaca-trade-api");
const key = "PKEEM7SJ5LQ1429CGPAK";
const secret = "7prDOquO7qIwnu/40CKIfDSRoYniMjQTYgSb9eZC";
const alpaca = new Alpaca({keyId: key, secretKey: secret, paper: true});
const macd = require("macd");
const blessed = require("blessed");
const contrib = require("blessed-contrib");
var screen = blessed.screen();
var grid = new contrib.grid({rows: 12, cols: 12, screen: screen});
var errorLog = "";
const fs = require("fs");
var table = grid.set(2, 0, 10, 6, contrib.table, {
    keys: true,
    fg: "white",
    interactive: false,
    label: "Positions",
    width: "30%",
    height: "30%",
    border: {
        type: "line",
        fg: "cyan"
    },
    columnSpacing: 6, //in chars
    columnWidth: [
        10,
        10,
        10,
        10,
        5,
        5,
        10,
        5
    ]/*in chars*/
});
var log = grid.set(2, 6, 10, 6, contrib.log, {
    fg: "green",
    selectedFg: "green",
    width: "30%",
    height: "30%",
    label: "Server Log"
});
var numWatching = grid.set(0, 0, 2, 2, blessed.box, {
    content: "Watching 0 Symbols",
    tags: false,
    border: {
        type: "none"
    }
});
var marketOpenBox = grid.set(0, 2, 2, 2, blessed.box, {
    content: "Market Opens In Nan Seconds",
    tags: false,
    border: {
        type: "none"
    }
});

screen.key([
    "escape", "q", "C-c"
], function (ch, key) {
    fs.writeFileSync("error.log",errorLog);
    return process.exit(0);
});
screen.render();

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
            if (error) {
                rej(error);
            } else {
                res(JSON.parse(body));
            }
        });
    });
    return toReturn;
}

// We only consider stocks with per-share prices inside this range
const min_share_price = 2.0;
const max_share_price = 13.0;
const after_open_trade_min = 120;
// Minimum previous-day dollar volume for a stock we might consider
min_last_dv = 500000;

// Stop limit to default to
default_stop = 0.95;

// How much of our portfolio to allocate to any one position
risk = 0.05;

var pctForBuy = 0.04;

function find_stop(current_value, minute_historyinf, now) {
    //TODO: Need more sophisticated stop loss algorithm
    return current_value * default_stop;
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
        //log.log(toReturn[symbol].ticks[0]);
    }
    numWatching.setContent("Watching " + Object.keys(toReturn).length + " Symbols");
    screen.render();
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
    existingSymbolsToGetHistoryFor = existing_positions.map(c=>c.symbol);
    return allTickers
        .tickers
        .filter(tick => {
            var toReturn = (tick.lastTrade["p"] >= min_share_price && tick.lastTrade["p"] <= max_share_price && tick.prevDay["v"] * tick.lastTrade["p"] > min_last_dv && tick.todaysChangePerc > 3.5) || existingSymbolsToGetHistoryFor.includes(tick.ticker);
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
var marketClose;
var marketOpen;
var symbols = [];
var portfolio_value;
var existing_positions = {};

var stop_prices = {};
var latest_cost_basis = {};

function tradeUpdate(data) {
    //log.log(data);
    log.log("Trade Update");
    var symbol = data.order["symbol"];
    var last_order = open_orders[symbol];
    if (last_order) {
        var event = data.event;
        if (event == "partial_fill") {
            var qty = data.order["filled_qty"];
            if (data.order["side"] == "sell") {
                qty = qty * -1;
            }
            positions[symbol] = (positions[symbol] || 0) - (partial_fills[symbol] || 0);
            partial_fills[symbol] = qty;
            positions[symbol] += qty;
            open_orders[symbol] = data.order;
        } else if (event == "filled") {
            qty = data.order["filled_qty"];
            if (data.order["side"] == "sell") {
                qty = qty * -1;
            }
            positions[symbol] = (positions[symbol] || 0) - (partial_fills[symbol] || 0);
            partial_fills[symbol] = 0;
            positions[symbol] += qty;
            open_orders[symbol] = null;
        } else if (event == "canceled" || event == "rejected") {
            partial_fills[symbol] = 0;
            open_orders[symbol] = null;
        }
    }
}
function getIndexForTimeStamp(symbol, ts) {
    if (minute_history[symbol]) {
        //log.log(minute_history[symbol].ticks);
        for (var i = 0; i < minute_history[symbol].ticks.length; i++) {
            if (minute_history[symbol].ticks.t == ts) {
                return i;
            }
        }
    }
    return -1;
}
function getHighBetween(lbound, ubound, symbol) {
    var toSearch = minute_history[symbol]
        .ticks
        .filter(t => {
            return t.t >= lbound && t.t <= ubound;
        });
    var high = 0;
    for (var i = 0; i < toSearch.length; i++) {
        if (toSearch.h > high) {
            high = toSearch.h;
        }
    }
    return high;
}
var secondUpdatesReceived = 0;
async function secondBar(subject, data) {
    //log.log(stop_prices);
    secondUpdatesReceived++;
    // example second bar
    var symbol = data.sym;
    var ts = new Date(data.s);
    var minute = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate(), ts.getHours(), ts.getMinutes(), 0, 0);
    ts = minute.getTime();
    errorLog += JSON.stringify(open_orders);
    var indexForTs = getIndexForTimeStamp(symbol, ts);
    if (indexForTs > -1) {
        minute_history[symbol].ticks[indexForTs] = {
            o: data.o,
            h: data.h > minute_history[symbol].ticks[indexForTs].h
                ? data.h
                : minute_history[symbol].ticks[indexForTs].h,
            l: data.l < minute_history[symbol].ticks[indexForTs].l
                ? data.l
                : minute_history[symbol].ticks[indexForTs].l,
            c: data.c,
            v: data.v + minute_history[symbol].ticks[indexForTs].v,
            t: ts,
            d: ts
        };
    } else {
        minute_history[symbol]
            .ticks
            .push({
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
    if (existing_order) {
        log.log("Returning because of existing order");
        //TODO: double check that this object definition is accurate
        var submitted_at = new Date(existing_order.updated_at).getTime();
        var order_lifetime = ts - submitted_at;
        //log.log(existing_order);
        if (order_lifetime / 1000 / 60 > 1) {
            log.log("Cancelling Order for " + symbol);
            await alpaca.cancelOrder(existing_order.id);
        }
        return;
    }
    var since_market_open = ts - marketOpen.getTime();
    var until_market_close = marketClose.getTime() - ts;
    //log.log(ts);
    if (since_market_open / 1000 / 60 > 15 && since_market_open / 1000 / 60 < after_open_trade_min/*remove || true after debugging || true*/) {
        // Check for buy signals
        //log.log("It's the right time for buying");
        // See if we've already bought in first
        var position = positions[symbol];
        if (position > 0) {
            //log.log("Returning because of existing position");
            return;
        }

        // See how high the price went during the first 15 minutes
        var lbound = marketOpen.getTime();
        var ubound = lbound + 1000 * 60 * 15;
        var high_15m = 0;
        if (minute_history[symbol]) {
            high_15m = getHighBetween(lbound, ubound, symbol);
        } else {
            log.log("Returning because of invalid minute history");
            // Because we're aggregating on the fly, sometimes the datetime index can get
            // messy until it's healed by the minute bars
            return;
        }

        // Get the change since yesterday's market close
        daily_pct_change = (data.c - prev_closes[symbol]) / prev_closes[symbol];
        //log.log(high_15m);
        if (daily_pct_change > pctForBuy && data.c > high_15m && volume_today[symbol] > 30000) {
            // check for a positive, increasing MACD
            var closingPrices = minute_history[symbol]
                .ticks
                .map(o => o.c);
            var hist = macd(closingPrices, 26, 12, 9);
            if (hist.MACD[hist.MACD.length - 1] < 0 || !(hist.MACD[hist.MACD.length - 3] < hist.MACD[hist.MACD.length - 2] < hist.MACD[hist.MACD.length - 1])) {
                return;
            }
            hist = macd(closingPrices, 60, 40, 9); //TODO: Ask about on slack

            if (hist.MACD[hist.MACD.length - 1] < 0 || hist.MACD[hist.MACD.length - 1] - hist.MACD[hist.MACD.length - 2] < 0) {
                return;
            }
            // Stock has passed all checks; figure out how much to buy
            var stop_price = find_stop(data.c, minute_history[symbol], ts);
            stop_prices[symbol] = stop_price;
            target_prices[symbol] = data.c + (data.c - stop_price) * 3;
            var shares_to_buy = Math.floor((portfolio_value * risk) / data.c //(data.c - stop_price)
            );
            if (shares_to_buy == 0) {
                shares_to_buy = 1;
            }
            if (positions[symbol]) {
                shares_to_buy -= positions[symbol];
            }
            if (shares_to_buy <= 0) {
                return;
            }

            //log.log(`Submitting buy for ${shares_to_buy} shares of ${symbol} at ${data.c}`);

            try {
                var o = await alpaca.createOrder({
                    symbol: symbol,
                    qty: shares_to_buy,
                    side: "buy",
                    type: "limit",
                    time_in_force: "day",
                    limit_price: data.c
                });
                open_orders[symbol] = o;
                latest_cost_basis[symbol] = data.c;
            } catch (e) {
                //log.log(e);
                errorLog += JSON.stringify(e)+"\n";
            }
        }
    }
    //Begin Sell Logic
    if (since_market_open / 1000 / 60 >= 24 || until_market_close / 1000 / 60 > 15) {
        // Check for liquidation signals log.log("Checking for sell signals"); We can't
        // liquidate if there's no position
        position = positions[symbol];
        if (position == 0 || position == null || position == undefined) {
            //log.log("Returning because there's no position");
            return;
        }

        // Sell for a loss if it's fallen below our stop price Sell for a loss if it's
        // below our cost basis and MACD < 0 Sell for a profit if it's above our target
        // price
        var closingPrices = minute_history[symbol]
            .ticks
            .map(o => o.c);
        //log.log(`Latest cost basis for ${symbol} is ${JSON.stringify(latest_cost_basis)}`);
        //log.log(JSON.parse(positions));
        var hist = macd(closingPrices, 26, 12, 9);
        if (data.c <= stop_prices[symbol] || (data.c >= target_prices[symbol] && hist.MACD[hist.MACD.length - 1] <= 0) || (data.c <= latest_cost_basis[symbol] && hist.MACD[hist.MACD.length - 1] <= 0)) {
            
            try {
              //log.log(`Submitting sell for ${position} shares of ${symbol} at ${data.c}`);
                var o = await alpaca.createOrder({
                    symbol: symbol,
                    qty: position,
                    side: "sell",
                    type: "limit",
                    time_in_force: "day",
                    limit_price: data.c
                });
                open_orders[symbol] = o;
                latest_cost_basis[symbol] = data.c;
            } catch (e) {
                //log.log(e);
                errorLog += JSON.stringify(e)+"\n";
            }
        }
        return;
    } else if (until_market_close / 1000 / 60 <= 15) {
        var symbol = data.sym;
        var position;
        //S Liquidate remaining positions on watched symbols at market
        try {
            position = await alpaca.getPosition(symbol);
        } catch (e) {
            // Exception here indicates that we have no position
            errorLog += JSON.stringify(e)+"\n";
            return;
        }
        //log.log(`Trading over, liquidating remaining position in ${symbol}`);
        var o = await alpaca.createOrder({
            symbol: symbol,
            qty: position.qty,
            side: "sell",
            type: "market",
            time_in_force: "day",
            limit_price: data.c
        });
        //TODO: find definition of symbols!
        symbols.remove(symbol);
        if (symbols.length <= 0) {
            conn.close();
        }
        websocket.unsubscribe([`A.${symbol}`, `AM.${symbol}`]);
    }

    // loc function in python is just finding the minute timestamp look at
    // https://www.npmjs.com/package/macd for MACD calculations
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
    var ts = new Date(data.s);
    //log.log(symbol); log.log(subject);
    var minute = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate(), ts.getHours(), ts.getMinutes, 0, 0);
    ts = minute.getTime();

    var indexForTs = getIndexForTimeStamp(data.sym, ts);

    var minHistoryTick = {
        o: data.o,
        h: data.h,
        l: data.l,
        c: data.c,
        v: data.v,
        t: ts,
        d: ts
    };
    if (indexForTs > -1) {
        minute_history[data.sym].ticks[indexForTs] = minHistoryTick;
    } else {
        minute_history[data.sym]
            .ticks
            .push(minHistoryTick);
    }
    volume_today[data.sym] = data.v;
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
async function run(tickers) {
    let websocket = alpaca.websocket;

    websocket.onStockAggSec(secondBar);
    websocket.onStockAggMin(minuteBar);
    websocket.onOrderUpdate(tradeUpdate);
    var toSubscribe = ["trade_updates"];

    for (var i = 0; i < tickers.length; i++) {
        var toAddA = "A." + tickers[i].ticker;
        var toAddAM = "AM." + tickers[i].ticker;
        toSubscribe.push(toAddA, toAddAM);

        volume_today[tickers[i].ticker] = tickers[i].day.v;
        prev_closes[tickers[i].ticker] = tickers[i].prevDay.c;
        symbols.push(tickers[i].ticker);
    }
    websocket.onStateChange(newState => {
        log.log(`State changed to ${newState}`);
    });
    websocket.onConnect(() => {
        log.log("Connected WebSocket");
        websocket.subscribe(toSubscribe);
        log.log(JSON.stringify(websocket.subscriptionState));
    });
    websocket.onDisconnect(() => {
        log.log("Web Socket Disconnected");
    });
    websocket.onError(() => {
        log.log("Error");
    });

    minute_history = await get1000mHistoryData(symbols);
    portfolio_value = (await alpaca.getAccount()).portfolio_value;

    var existing_orders = await alpaca.getOrders({limit: 500});
    for (var i = 0; i < existing_orders.length; i++) {
        await alpaca.cancelOrder(existing_orders[i].id);
    }

    existing_positions = await alpaca.getPositions();
    log.log(JSON.stringify(Object.keys(existing_positions[0])));
    for (var i = 0; i < existing_positions.length; i++) {
        if (symbols.includes(existing_positions[i].symbol)) {
            positions[existing_positions[i].symbol] = existing_positions[i].qty;
            //recalculate cost basis
            latest_cost_basis[existing_positions[i].symbol] = existing_positions[i].avg_entry_price;
            stop_prices[existing_positions[i].symbol] = parseFloat(existing_positions[i].avg_entry_price * default_stop);
        }
    }
    log.log(JSON.stringify(positions));
    websocket.connect();
}(async function () {
    var calendarArr = await alpaca.getCalendar({start: new Date(), end: new Date()});
    marketClose = getMarketClose(calendarArr);
    marketOpen = getMarketOpen(calendarArr);
    var currentDateTime = new Date();
    existing_positions = await alpaca.getPositions();
    setInterval(async() => {
        try {
            existing_positions = await alpaca.getPositions();
            var headers = [
                "Symbol",
                "Shares",
                "Cost Basis",
                "Value",
                "Purchase",
                "Price",
                "Stop",
                "MACD"
            ];
            var toDisplay = [];
            for (var i = 0; i < existing_positions.length; i++) {
                if (!stop_prices[existing_positions[i].symbol]) {
                    stop_prices[existing_positions[i].symbol] = existing_positions[i].avg_entry_price * default_stop;
                }

                var hist;
                if (minute_history[existing_positions[i].symbol]) {
                    var closingPrices = minute_history[existing_positions[i].symbol]
                        .ticks
                        .map(o => o.c);
                    var histl = macd(closingPrices, 26, 12, 9);
                    hist = histl
                        .MACD[histl.MACD.length - 1]
                        .toFixed(5);

                } else {
                    hist = "";
                }

                var toPush = [
                    existing_positions[i].symbol,
                    existing_positions[i].qty,
                    existing_positions[i].cost_basis,
                    existing_positions[i].market_value,
                    existing_positions[i].avg_entry_price,
                    existing_positions[i].current_price,
                    stop_prices[existing_positions[i].symbol].toFixed(2) || "",
                    hist
                ];
                toDisplay.push(toPush);
              }
              table.setData({headers: headers, data: toDisplay});
              screen.render();
        } catch (err) {errorLog += JSON.stringify(err)+"\n";}
    },
2000);
while (currentDateTime.getTime() < marketOpen.getTime() + 60 * 1000 * 15) {
    await snooze(1000);
    marketOpenBox.setContent("Will start trading in " + Math.floor((marketOpen.getTime() - currentDateTime.getTime()) / 1000) + " Seconds");
    screen.render();
    currentDateTime = new Date();
}
screen.render();
var tickers = await getTickers();
screen.render();
// log.log(tickers); setInterval(()=>{log.log(`Received ${secondUpdatesReceived}
// second updates so far`)},1000);
marketOpenBox.destroy();
await run(tickers, marketOpen, marketClose);
})();
