'use strict';

const axios = require('axios');
const FormData = require('form-data');

axios.defaults.headers.common['User-Agent'] = process.env.USER_AGENT;

module.exports.run = async (event, context) => {
  const accessToken = await getRedditAccessToken();
  const lastCrawledDealName = await getLastCrawledDealName();

  const allDeals = await queryGameDeals(lastCrawledDealName, accessToken);

  const freeDeals = getFreeDeals(allDeals);

  console.log(freeDeals);

  saveLastDealCrawledName(allDeals.slice(-1)[0].data.name);
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
  return null; //'t3_ql900j';
}

function saveLastDealCrawledName(dealName) {
  console.log('Saving', dealName);
}