'use strict';

const axios = require('axios');
const FormData = require('form-data');
const aws = require('aws-sdk');
const s3 = new aws.S3();

axios.defaults.headers.common['User-Agent'] = process.env.USER_AGENT;

module.exports.run = async (event, context) => {
  const accessToken = await getRedditAccessToken();
  const lastCrawledDealName = await getLastCrawledDealName();

  const allDeals = await queryGameDeals(lastCrawledDealName, accessToken);

  const freeDeals = getFreeDeals(allDeals);

  console.log('Free Deals', freeDeals);

  if (allDeals.length >= 1) {
    await saveLastDealCrawledName(allDeals[0].data.name);
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

async function queryGameDeals(lastCrawledDealName, bearerToken) {
  const options = {
    headers: {
      'Authorization': `Bearer ${bearerToken}`
    },
    params: {
      before: lastCrawledDealName,
      limit: 100
    }
  }

  const response = await axios.get('https://oauth.reddit.com/r/gamedeals/new', options);

  return response.data.data.children;
}

function getFreeDeals(gamedeals) {
  return gamedeals.filter(deal => {
    return isDealAFreeGame(deal);
  });
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

async function getLastCrawledDealName() {
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

  return response.Body.toString();
}

async function saveLastDealCrawledName(dealName) {
  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: process.env.LAST_DEAL_FILENAME,
    Body: dealName,
    ContentType: 'text/plain'
  };

  await s3.putObject(params).promise();
}
