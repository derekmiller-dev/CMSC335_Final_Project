const http = require('http');
const fs = require("fs");
const bodyParser = require("body-parser"); /* To handle post parameters */
const portNumber = 5000;
const httpSuccessStatus = 200;
const path = require("path");
const express = require("express"); /* Accessing express module */
const app = express(); /* app is a request handler function */

require("dotenv").config({ path: path.resolve(__dirname, 'credentialsDontPost/.env') })
const uri = process.env.MONGO_CONNECTION_STRING;
const databaseAndCollection = {db: "Stocks", collection:"stocks"};
const { MongoClient, ServerApiVersion } = require('mongodb');
const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });

process.stdin.setEncoding("utf8");

/* directory where templates will reside */
app.set("views", path.resolve(__dirname, "templates"));

/* view/templating engine */
app.set("view engine", "ejs");

/* Initializes request.body with post information */ 
app.use(bodyParser.urlencoded({extended:false}));

async function getStock(stockName, daysInput) {
    let dateRange = daysInput
    let todaysDate = new Date();
    let todaysDateString = todaysDate.toISOString().split('T')[0]
    let date = new Date();
    date.setDate(date.getDate() - dateRange);
    let dateString = date.toISOString().split('T')[0];

    var data = await fetch(`https://api.polygon.io/v2/aggs/ticker/${stockName}/range/1/day/${dateString}/${todaysDateString}?apiKey=cw39tQ9OblahpwwAeM6XuVzyBk5RkB6w`)
    .then((response) => response.json())
    var stockDays = data.results
    labels = []
    stockPrices = []
    stockDays.forEach(element => {
        stockPrices.push(element.c)
        let formattedDate = new Date(element.t);
        labels.push(formattedDate.toISOString().split('T')[0])
    });

    return [stockPrices, labels]
}

app.get("/", (request, response) => { 
    response.render("stocks");
});

app.post("/stockDisplay", async (request, response) => { 
    let stockInput = request.body.stockInput;
    let daysInput = request.body.daysInput;
    let result = await getStock(stockInput, daysInput)
    let stockPrices = result[0]
    let labels = result[1]

    client.connect();
    for (let i = 0; i < stockPrices.length; i++) {
        const stock = {
            stock: stockPrices[i],
            day: labels[i]
        };
        insertStock(client, databaseAndCollection, stock);
    }
    
    let message = await listStocks(client, databaseAndCollection)

    const stocks = {
        table: message
    }

    response.render("stockDisplay", stocks);
});

app.post("/clear", async (request, response) => { 
    client.connect();
    const result = await client.db(databaseAndCollection.db)
    .collection(databaseAndCollection.collection)
    .deleteMany({});
});

async function insertStock(client, databaseAndCollection, stock) {
    const result = await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).insertOne(stock);
}

async function listStocks(client, databaseAndCollection) {
    let filter = {};
    const cursor = client.db(databaseAndCollection.db)
    .collection(databaseAndCollection.collection)
    .find(filter);
    
    const result = await cursor.toArray();  

    message = "<table border='1'><tr><th>Stock Price</th><th>Label</th></tr>"
    result.forEach(element => {
        message += `<tr><td>${element.stock}</td><td>${element.day}</td></tr>`
    });
    message += "</table>"

    return message  
}

app.listen(portNumber);

console.log(`Web server started and is running at http://localhost:${portNumber}`);


