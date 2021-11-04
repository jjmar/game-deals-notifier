# game-deals-notifier

# About

Regularly queries [/r/gamedeals](www.reddit.com/r/gamedeals) every 6 hours and determines which of those postings are for free games. Sends the free deal info to SNS so that I may recieve an email with the links to those deals.

Stores the most recent deal `name` in an S3 bucket so that future runs do not grab deals which have already been parsed.

Built using [serverless](www.serverless.com)



# Configuration

| Variable      | Description |
| ----------- | ----------- |
| REDDIT_CLIENT_ID     | ID of your reddit app       |
| REDDIT_CLIENT_SECRET   | Secret of your reddit app        |
| USER_AGENT | User agent sent with API calls to reddit
| BUCKET_NAME | Name of bucket |
| LAST_DEAL_FILENAME | Name of file to be stored in bucket |
| TOPIC_NAME | Name of SNS topic to be used to send users emails
| REGION | AWS region for deployed services

# Running / Deploying

Prerequisites:
  - Have created a reddit app and obtained its ID and secret
  - Have installed `serverless`
  - Have an AWS profile `serverless` defined which has the rights to create the lamdba/s3/sns resources
  - Have set the above environment variables locally in a `.env` file

Running:
  - `serverless deploy`

Removing:
  - Ensure the S3 bucket is empty
  - `serverless remove`