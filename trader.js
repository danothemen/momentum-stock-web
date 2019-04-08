/*
    Trade Logic Below
*/
const Alpaca = require("@alpacahq/alpaca-trade-api");
const key = "PKRGCXM3C3FLXR21RIOY";
const secret = "P4XCTPDBnqDqUSwzG6IQyRjCrxcgt9pYUFVYoNUG";
const alpaca = new Alpaca({ keyId: key, secretKey: secret, paper: true });
const macd = require("macd");
const fs = require("fs");

/*
    Callbacks
*/
var secondCallback;
var minuteCallback;
var positionsChanged;
var targetPricesChanged;
var priceUpdate;
var orderUpdate;
var macdUpdated;
var accountUpdate;

async function getAllTickers() {
  let snapshotUrl = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${key}`;

  var toReturn = new Promise((res, rej) => {
    var request = require("request");

    var options = {
      method: "GET",
      url:
        "https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers",
      qs: {
        apiKey: key
      }
    };

    request(options, function(error, response, body) {
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
var open_orders = {};

var stop_prices = {};
var latest_cost_basis = {};

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
    toReturn[symbol] = await alpaca.getHistoricAggregates("minute", symbol, {
      limit: 1000
    });
  }
  return toReturn;
}

async function getTickers() {
  var assets = await alpaca.getAssets({ tradable: true, status: "active" });
  var symbols = [];
  assets.forEach(e => {
    symbols.push(e.symbol);
  });
  //TODO: filter out the symbols based on min and max price
  var allTickers = await getAllTickers();
  existingSymbolsToGetHistoryFor = existing_positions.map(c => c.symbol);
  return allTickers.tickers.filter(tick => {
    var toReturn =
      (tick.lastTrade["p"] >= min_share_price &&
        tick.lastTrade["p"] <= max_share_price &&
        tick.prevDay["v"] * tick.lastTrade["p"] > min_last_dv &&
        tick.todaysChangePerc > 3.5) ||
      existingSymbolsToGetHistoryFor.includes(tick.ticker);
    return toReturn;
  });
}

/*Example Open Orders Obj
{"LPCN":
{"id":"126413ba-1c12-4c0d-b035-07749a42249a",
"client_order_id":"40364bec-6955-4775-8aba-8f02d2884847",
"created_at":"2019-03-13T16:48:47.251895556Z",
"updated_at":"2019-03-13T16:48:47.257155238Z",
"submitted_at":"2019-03-13T16:48:47.225307042Z",
"filled_at":null,
"expired_at":null,
"canceled_at":null,
"failed_at":null,
"asset_id":"ec8545ca-7f56-414a-977f-877d8d7193e0",
"symbol":"LPCN",
"asset_class":"us_equity",
"qty":"2225",
"filled_qty":"0",
"filled_avg_price":null,
"order_type":"limit",
"type":"limit",
"side":"sell",
"time_in_force":"day",
"limit_price":"2.02",
"stop_price":null,
"status":"new"}}
*/
function sendOpenOrders() {
  if (typeof orderUpdate == "function") {
    orderUpdate(open_orders);
  }
}

function tradeUpdate(data) {
  var symbol = data.order["symbol"];
  var last_order = open_orders[symbol];
  console.log(data);
  if (last_order) {
    var event = data.event;
    if (event == "partial_fill") {
      var qty = data.order["filled_qty"];
      if (data.order["side"] == "sell") {
        qty = qty * -1;
      }
      positions[symbol] =
        (positions[symbol] || 0) - (partial_fills[symbol] || 0);
      partial_fills[symbol] = qty;
      positions[symbol] += qty;
      open_orders[symbol] = data.order;
    } else if (event == "fill") {
      qty = data.order["filled_qty"];
      if (data.order["side"] == "sell") {
        qty = qty * -1;
      }
      positions[symbol] =
        (positions[symbol] || 0) - (partial_fills[symbol] || 0);
      partial_fills[symbol] = 0;
      positions[symbol] += qty;
      console.log("Filled Order");
      delete open_orders[symbol];
    } else if (event == "canceled" || event == "rejected") {
      partial_fills[symbol] = 0;
      delete open_orders[symbol];
    }
    else{
      console.log("Unrecognized trade event");
      console.log(event);
    }
  }
  else{
    console.log("No Last Order");
  }
  sendOpenOrders();
}
function getIndexForTimeStamp(symbol, ts) {
  if (minute_history[symbol]) {
    for (var i = 0; i < minute_history[symbol].ticks.length; i++) {
      if (minute_history[symbol].ticks.t == ts) {
        return i;
      }
    }
  }
  return -1;
}
function getHighBetween(lbound, ubound, symbol) {
  var toSearch = minute_history[symbol].ticks.filter(t => {
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

async function secondBar(subject, data) {
  //console.log(subject);
  // example second bar
  var symbol = data.sym;
  var ts = new Date(data.s);
  var minute = new Date(
    ts.getFullYear(),
    ts.getMonth(),
    ts.getDate(),
    ts.getHours(),
    ts.getMinutes(),
    0,
    0
  );
  ts = minute.getTime();
  var indexForTs = getIndexForTimeStamp(symbol, ts);
  if (indexForTs > -1) {
    minute_history[symbol].ticks[indexForTs] = {
      o: data.o,
      h:
        data.h > minute_history[symbol].ticks[indexForTs].h
          ? data.h
          : minute_history[symbol].ticks[indexForTs].h,
      l:
        data.l < minute_history[symbol].ticks[indexForTs].l
          ? data.l
          : minute_history[symbol].ticks[indexForTs].l,
      c: data.c,
      v: data.v + minute_history[symbol].ticks[indexForTs].v,
      t: ts,
      d: ts
    };
  } else {
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
  if (existing_order) {
    //TODO: double check that this object definition is accurate
    var submitted_at = new Date(existing_order.updated_at).getTime();
    var order_lifetime = ts - submitted_at;
    if (order_lifetime / 1000 / 60 > 1) {
      await alpaca.cancelOrder(existing_order.id);
    }
    return;
  }
  var since_market_open = ts - marketOpen.getTime();
  var until_market_close = marketClose.getTime() - ts;
  if (
    since_market_open / 1000 / 60 > 15 &&
    since_market_open / 1000 / 60 <
      after_open_trade_min /*remove || true after debugging || true*/
  ) {
    let shouldbuy = true;
    // Check for buy signals
    // See if we've already bought in first
    var position = positions[symbol];
    if (position > 0) {
      shouldbuy = false;
    }

    // See how high the price went during the first 15 minutes
    var lbound = marketOpen.getTime();
    var ubound = lbound + 1000 * 60 * 15;
    var high_15m = 0;
    if (minute_history[symbol]) {
      high_15m = getHighBetween(lbound, ubound, symbol);
    } else {
      // Because we're aggregating on the fly, sometimes the datetime index can get
      // messy until it's healed by the minute bars
      shouldbuy = false;
    }

    // Get the change since yesterday's market close
    daily_pct_change = (data.c - prev_closes[symbol]) / prev_closes[symbol];
    if (
      daily_pct_change > pctForBuy &&
      data.c > high_15m &&
      volume_today[symbol] > 30000
    ) {
      // check for a positive, increasing MACD
      var closingPrices = minute_history[symbol].ticks.map(o => o.c);
      var hist = macd(closingPrices, 26, 12, 9);
      if (
        hist.histogram[hist.histogram.length - 1] < 0 ||
        !(
          hist.histogram[hist.histogram.length - 3] <
          hist.histogram[hist.histogram.length - 2] <
          hist.histogram[hist.histogram.length - 1]
        )
      ) {
        shouldbuy = false;
      }
      hist = macd(closingPrices, 60, 40, 9); //TODO: Ask about on slack

      if (
        hist.histogram[hist.histogram.length - 1] < 0 ||
        hist.histogram[hist.histogram.length - 1] -
          hist.histogram[hist.histogram.length - 2] <
          0
      ) {
        shouldbuy = false;
      }
      // Stock has passed all checks; figure out how much to buy
      var stop_price = find_stop(data.c, minute_history[symbol], ts);
      stop_prices[symbol] = stop_price;
      target_prices[symbol] = data.c + (data.c - stop_price) * 3;
      var shares_to_buy = Math.floor(
        (portfolio_value * risk) / data.c //(data.c - stop_price)
      );
      if (shares_to_buy == 0) {
        shares_to_buy = 1;
      }
      if (positions[symbol]) {
        shares_to_buy -= positions[symbol];
      }
      if (shares_to_buy <= 0) {
        shouldbuy = false;
      }

      try {
        if (shouldbuy) {
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
          sendOpenOrders();
        }
      } catch (e) {
        console.log(e);
      }
    }
  }
  //Begin Sell Logic
  if (
    since_market_open / 1000 / 60 >= 24 &&
    until_market_close / 1000 / 60 > 15
  ) {
    // Check for liquidation signals log.log("Checking for sell signals"); We can't
    // liquidate if there's no position
    position = positions[symbol];
    if (position == 0 || position == null || position == undefined) {
      return;
    }

    // Sell for a loss if it's fallen below our stop price Sell for a loss if it's
    // below our cost basis and MACD < 0 Sell for a profit if it's above our target
    // price
    var closingPrices = minute_history[symbol].ticks.map(o => o.c);
    var hist = macd(closingPrices, 13, 21, 9);
    if (typeof macdUpdated == "function") {
      macdUpdated(hist, symbol);
    }
    if (
      data.c <= stop_prices[symbol] ||
      (data.c >= target_prices[symbol] &&
        hist.histogram[hist.histogram.length - 1] <= 0) ||
      (data.c <= latest_cost_basis[symbol] &&
        hist.histogram[hist.histogram.length - 1] <= 0)
    ) {
      try {
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
        sendOpenOrders();
      } catch (e) {
        console.log(e);
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
      console.log(e);
      return;
    }
    var o = await alpaca.createOrder({
      symbol: symbol,
      qty: position.qty,
      side: "sell",
      type: "market",
      time_in_force: "day",
      limit_price: data.c
    });
    open_orders[symbol] = o;
    sendOpenOrders();
    //TODO: find definition of symbols!
    console.log("Ready to Sell");
    symbols.remove(symbol);
    if (symbols.length <= 0) {
      conn.close();
    }
    websocket.unsubscribe([`A.${symbol}`, `AM.${symbol}`]);
  }
  console.log(until_market_close / 1000 / 60);
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
  var minute = new Date(
    ts.getFullYear(),
    ts.getMonth(),
    ts.getDate(),
    ts.getHours(),
    ts.getMinutes,
    0,
    0
  );
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
    minute_history[data.sym].ticks.push(minHistoryTick);
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
  console.log(`${tickers.length} Tickers Watching`);
  for (var i = 0; i < tickers.length; i++) {
    var toAddA = "A." + tickers[i].ticker;
    var toAddAM = "AM." + tickers[i].ticker;
    toSubscribe.push(toAddA, toAddAM);

    volume_today[tickers[i].ticker] = tickers[i].day.v;
    prev_closes[tickers[i].ticker] = tickers[i].prevDay.c;
    symbols.push(tickers[i].ticker);
  }
  websocket.onStateChange(newState => {});
  websocket.onConnect(() => {
    websocket.subscribe(toSubscribe);
    console.log(toSubscribe);
    console.log("Api Socket Connected");
  });
  websocket.onDisconnect(() => {});
  websocket.onError(() => {});

  minute_history = await get1000mHistoryData(symbols);
  portfolio_value = (await alpaca.getAccount()).portfolio_value;

  var existing_orders = await alpaca.getOrders({ limit: 500 });
  for (var i = 0; i < existing_orders.length; i++) {
    await alpaca.cancelOrder(existing_orders[i].id);
  }

  existing_positions = await alpaca.getPositions();
  for (var i = 0; i < existing_positions.length; i++) {
    if (symbols.includes(existing_positions[i].symbol)) {
      positions[existing_positions[i].symbol] = existing_positions[i].qty;
      //recalculate cost basis
      latest_cost_basis[existing_positions[i].symbol] =
        existing_positions[i].avg_entry_price;
      stop_prices[existing_positions[i].symbol] = parseFloat(
        existing_positions[i].avg_entry_price * default_stop
      );
    }
  }
  websocket.connect();
  console.log(websocket.subscriptionState);
}
async function startTrader() {
  var calendarArr = await alpaca.getCalendar({
    start: new Date(),
    end: new Date()
  });
  marketClose = getMarketClose(calendarArr);
  marketOpen = getMarketOpen(calendarArr);
  var currentDateTime = new Date();
  existing_positions = await alpaca.getPositions();

  while (currentDateTime.getTime() < marketOpen.getTime() + 60 * 1000 * 15) {
    await snooze(1000);
    currentDateTime = new Date();
    console.log("Waiting Until 9:45am");
  }
  var tickers = await getTickers();
  // second updates so far`)},1000);
  await run(tickers, marketOpen, marketClose);
}
function subscribeToPositions() {
  setInterval(async () => {
    try {
      existing_positions = await alpaca.getPositions();
      var accountInfo = await alpaca.getAccount();
      if (typeof accountUpdate == "function") {
        accountUpdate(accountInfo);
      }
      //console.log(minute_history);

      if (
        Object.keys(minute_history).length == 0 &&
        existing_positions.length > 0
      ) {
        var mySymbols = existing_positions.map(o => o.symbol);
        console.log("Getting Minute History");
        minute_history = await get1000mHistoryData(mySymbols);
        console.log("Got Minute History");
      }
      var toDisplay = [];
      for (var i = 0; i < existing_positions.length; i++) {
        if (!stop_prices[existing_positions[i].symbol]) {
          stop_prices[existing_positions[i].symbol] =
            existing_positions[i].avg_entry_price * default_stop;
        }

        var hist;
        if (minute_history[existing_positions[i].symbol]) {
          var closingPrices = minute_history[
            existing_positions[i].symbol
          ].ticks.map(o => o.c);
          var histl = macd(closingPrices, 13, 21, 9);
          if (typeof macdUpdated == "function") {
            macdUpdated(histl, existing_positions[i].symbol);
          }
          hist = histl.histogram[histl.histogram.length - 1].toFixed(5);
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
        existing_positions[i].stop_price =
          stop_prices[existing_positions[i].symbol].toFixed(2) || "";
        existing_positions[i].macd = hist;
      }
      if (typeof positionsChanged == "function") {
        positionsChanged(existing_positions);
      }
      sendOpenOrders();
    } catch (err) {
      console.log(err);
    }
  }, 10000);
}
module.exports.StartTrader = startTrader;
module.exports.PositionsChanged = func => {
  positionsChanged = func;
};
module.exports.getPositions = () => {
  return existing_positions;
};
module.exports.MACDUpdate = func => {
  macdUpdated = func;
};
module.exports.OrderUpdate = func => {
  orderUpdate = func;
};
module.exports.AccountUpdate = func => {
  accountUpdate = func;
};
module.exports.SubscribeToPositions = subscribeToPositions;
