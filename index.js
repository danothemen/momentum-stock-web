const Alpaca = require("@alpacahq/alpaca-trade-api");
const key = "PK0P4FZK0S4LMVD36VN7";
const secret = "I0NtyoxIRrGeVFptPWQByDAWfLOrClfpeQ3GX/HV";
const alpaca = new Alpaca({ keyId: key, secretKey: secret, paper: true });

async function getAllTickers() {
  let snapshotUrl = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${key}`;
  console.log(snapshotUrl);
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
      if (error) rej(error);

      //console.log(body);
      res(JSON.parse(body));
    });
    console.log("Got All Tickers");
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
  console.log("Getting historical data");
  var toReturn = {};
  for (var i = 0; i < symbols.length; i++) {
    var symbol = symbols[i];
    toReturn[symbol] = await alpaca.getHistoricAggregates("minute", symbol, {
      limit: 1000
    });
    console.log(`${i}/${symbols.length}`);
  }
  console.log("Got historical data");
  return toReturn;
}

async function getTickers() {
  print("Getting current ticker data...");
  print("Success.");
  var assets = await alpaca.getAssets({ tradable: true, status: "active" });
  var symbols = [];
  assets.forEach(e => {
    symbols.push(e.symbol);
  });
  print(symbols);
  //TODO: filter out the symbols based on min and max price
  var allTickers = await getAllTickers();
  return allTickers.tickers.filter(tick => {
    var toReturn =
      tick.lastTrade["p"] >= min_share_price &&
      tick.lastTrade["p"] <= max_share_price &&
      tick.prevDay["v"] * tick.lastTrade["p"] > min_last_dv &&
      tick.todaysChangePerc > 3.5;
    return toReturn;
  });
}
function tradeUpdate(subject, data) {
  console.log("Trade Update");
  console.log(data);
}
function secondBar(subject, data) {
  //console.log("Second Bar");
  //console.log(data);
  //example second bar
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
  console.log("Minute Log");
  console.log(data);
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
//getTickers().then(res => console.log(res));
async function run(tickers, marketOpen, marketClose) {
  let websocket = alpaca.websocket;

  websocket.onStockAggSec(secondBar);
  websocket.onStockAggMin(minuteBar);
  websocket.onOrderUpdate(tradeUpdate);
  var toSubscribe = ["trade_updates"];

  var volume_today = {};
  var prev_closes = {};
  //console.log(tickers);

  var symbols = [];

  for (var i = 0; i < tickers.length; i++) {
    var toAddA = "A." + tickers[i].ticker;
    var toAddAM = "AM." + tickers[i].ticker;
    toSubscribe.push(toAddA, toAddAM);

    volume_today[tickers[i].ticker] = tickers[i].day.v;
    prev_closes[tickers[i].ticker] = tickers[i].prevDay.c;
    symbols.push(tickers[i].ticker);
  }

  websocket.onConnect(() => {
    console.log("Connected WebSocket");
    websocket.subscribe(toSubscribe);
  });
  websocket.connect();
  console.log(toSubscribe);

  console.log(`Tracking ${symbols.length} symbols`);
  var minute_history = await get1000mHistoryData(symbols);
  //console.log(minute_history);
  var portfolio_value = (await alpaca.getAccount()).portfolio_value;
  console.log(portfolio_value);
}

(async function() {
  var calendarArr = await alpaca.getCalendar({
    start: new Date(),
    end: new Date()
  });
  var marketClose = getMarketClose(calendarArr);
  var marketOpen = getMarketOpen(calendarArr);
  var currentDateTime = new Date();
  while (currentDateTime.getTime() < marketOpen.getTime() + 60 * 1000 * 15 && false) {
    await snooze(1000);
    console.log("Waiting for Market Open At " + currentDateTime);
    currentDateTime = new Date();
  }
  var tickers = await getTickers();
  await run(tickers, marketOpen, marketClose);
})();
