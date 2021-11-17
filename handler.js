'use strict';

const axios = require('axios');
const FormData = require('form-data');
const aws = require('aws-sdk');

aws.config.update({region: process.env.REGION});

const s3 = new aws.S3();
const sns = new aws.SNS();

axios.defaults.headers.common['User-Agent'] = process.env.USER_AGENT;

module.exports.run = async (event, context) => {
  const accessToken = await getRedditAccessToken();
  const lastCrawledDealTime = await getLastCrawledDealTime();

  const allDeals = await queryGameDeals(lastCrawledDealTime, accessToken);

  const freeDeals = getFreeDeals(allDeals);

  await sendDealNotifications(freeDeals);

  if (allDeals.length >= 1) {
    await saveLastDealCrawledTime(allDeals[0].data.created_utc);
  }
};


async function getRedditAccessToken() {
  const data = new FormData();
  data.append('grant_type', 'client_credentials');

  const options = {
    headers: data.getHeaders(),
    auth: {
      username: process.env.REDDIT_CLIENT_ID,
      password: process.env.REDDIT_CLIENT_SECRET
    }
  }

  const response = await axios.post('https://www.reddit.com/api/v1/access_token', data, options);

  return response.data.access_token;
}

async function queryGameDeals(lastCrawledDealTime, bearerToken) {
  const options = {
    headers: {
      'Authorization': `Bearer ${bearerToken}`
    },
    params: {
      limit: 100
    }
  }

  const response = await axios.get('https://oauth.reddit.com/r/gamedeals/new', options);

  let recentDeals = [];

  for (const deal of response.data.data.children) {
    if (deal.data.created_utc <= lastCrawledDealTime) break;
    recentDeals.push(deal);
  }

  return recentDeals;
}

function getFreeDeals(gamedeals) {
  return gamedeals.filter(deal => isDealAFreeGame(deal));
}

function isDealAFreeGame(deal) {
  const dealTitle = deal.data.title.toLowerCase();

  const dealContainsFree = new RegExp('free[^a-zA-Z]').test(dealTitle);
  const dealContainsHundredPercent =  (dealTitle.includes('100%') || dealTitle.includes('100 %') || dealTitle.includes('100 percent'));
  const dealContainsWeekend = dealTitle.includes('weekend');
  const dealIsGamesPass = dealTitle.includes('game pass') || dealTitle.includes('gamepass');
  const dealIsTwitchPrime = dealTitle.includes('twitch prime') || dealTitle.includes('prime gaming');

  return (dealContainsFree || dealContainsHundredPercent) && !(dealContainsWeekend || dealIsGamesPass || dealIsTwitchPrime);
}

async function sendDealNotifications(freeDeals) {
  if (freeDeals.length == 0) return;

  const formattedDeals = freeDeals.map(deal => {
    return `${deal.data.title}: ${deal.data.url_overridden_by_dest || deal.data.url}`
  });

  const params = {
    Message: formattedDeals.join('\r\n'),
    Subject: 'New Free Games',
    TopicArn: process.env.TOPIC_ARN
  };

  await sns.publish(params).promise();
}

async function getLastCrawledDealTime() {
  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: process.env.LAST_DEAL_FILENAME
  };

  let response;

  try {
    response = await s3.getObject(params).promise();
  } catch (error) {

    if (error && error.code == 'NoSuchKey') {
      return null;
    }

    throw error; 
  }

  return parseFloat(response.Body.toString());
}

async function saveLastDealCrawledTime(dealTime) {
  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: process.env.LAST_DEAL_FILENAME,
    Body: dealTime.toString(),
    ContentType: 'text/plain'
  };

  await s3.putObject(params).promise();
}
