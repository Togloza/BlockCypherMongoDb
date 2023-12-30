// config.js
module.exports = {
  mongoUri: 'mongodb+srv://<username>:<password>@<cluster-url>/<database>?retryWrites=true&w=majority',
  addresses: ['address1', 'address2', 'address3'],
  preMintVals: [premint1, premint2, premint3],
  database: '<database>',
  collection: '<collection>',
  cronSchedule: '0 * * * *', // Use chatGPT to write cron schedules if needed. 
};