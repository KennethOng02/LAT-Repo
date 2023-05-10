'use strict';

const line = require('@line/bot-sdk');
const express = require('express');
const configGet = require('config');
const {TextAnalyticsClient, AzureKeyCredential} = require('@azure/ai-text-analytics')

// Line config
const configLine = {
    channelAccessToken:configGet.get('CHANNEL_ACCESS_TOKEN'),
    channelSecret:configGet.get('CHANNEL_SECRET')
};

// Azure Text Sentiment
const endpoint = configGet.get('ENDPOINT');
const apiKey = configGet.get('TEXT_ANALYTICS_API_KEY');

// create a new Line client with given channel access token and channel secret
const client = new line.Client(configLine);

const app = express();

const port = process.env.PORT || process.env.port || 3001;

app.listen(port, ()=>{
    console.log(`listening on ${port}`);
});

async function MS_TextSentimentAnalysis(thisEvent) {
    console.log("[MS_TextSentimentAnalysis] in");

    const analyticsClient = new TextAnalyticsClient(endpoint, new AzureKeyCredential(apiKey));

    let documents = [];
    documents.push(thisEvent.message.text);
    const results = await analyticsClient.analyzeSentiment(documents, "zh-hant", {includeOpinionMining: true});
    console.log(`[results] ${JSON.stringify(results)}`);
    
    // convert the returned onject
    // into a chinese response with the corresponding score
    let echo = new String();
    if(results[0]['sentiment'] == "positive")
        echo += `正向。分數:${results[0]['confidenceScores']['positive']}`;
    else if(results[0]['sentiment'] == "negative")
        echo += `負向。分數:${results[0]['confidenceScores']['negative']}`;
    else
        echo += `中性。分數:${results[0]['confidenceScores']['neutral']}`;

    if(results[0]['sentences'][0]['opinions'].length)
        echo += (`\n主詞:${results[0]['sentences'][0]['opinions'][0]['target']['text']}`)
    
    return echo;
}

app.post('/callback', line.middleware(configLine), (req, res)=>{
    Promise
        .all(req.body.events.map(handleEvent))
        .then((result)=>res.json(result))
        .catch((err)=>{
            console.error(err);
            res.status(500).end();
        });
});

function handleEvent(event) {
    if(event.type !== 'message' || event.message.type !== 'text')
        return Promise.resolve(null); // 不除理

    MS_TextSentimentAnalysis(event)
        .then((msg)=>{
            const resultMessage = {
                type: 'text',
                text: msg
            };
            
            return client.replyMessage(event.replyToken, resultMessage);
        })
        .catch((err)=>{
            console.error(`Error: ${err}`);
        });
}