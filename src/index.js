const axios = require('axios');
const { MongoClient } = require('mongodb');
const cron = require('node-cron');

const { addresses, mongoUri, preMintVals, database, collection, cronSchedule } = require('./config.js'); // Path to config variables
let client;

if (addresses.length !== preMintVals.length) {
  throw new Error('Lengths of addresses and preMintVals arrays must be equal.');
}

// Function to connect to MongoDB
async function connectToMongo() {
  try {
    client = await MongoClient.connect(mongoUri);
    console.log('Connected to MongoDB');
    return true;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    throw error;
  }
  
}

// Function to insert data into MongoDB
// Not used in script
async function insertData(data) {
  try {
    const db = client.db(database);
    const collect = db.collection(collection);
    const result = await collect.insertOne(data);
  } catch (error) {
    console.error('Error inserting document:', error.message);
    throw error;
  }
}

// Function to find data from MongoDB
async function queryData(query = {}) {
  try {
    const db = client.db(database);
    const collect = db.collection(collection);
    const documents = await collect.find(query).toArray();
    return documents[0];
  } catch (error) {
    console.error('Error finding documents:', error.message);
    throw error;
  }
}

// Function to fetch data using Axios
async function fetchData(address) {
  try {
    // API endpoint URL
    const apiUrl = `https://api.blockcypher.com/v1/doge/main/addrs/${address}/balance`;
    const response = await axios.get(apiUrl);
    return response.data;
  } catch (error) {
    console.error('Error fetching data:', error.message);
    throw error;
  }
}
// Function to update data in MongoDB
async function updateData(query, update) {
    try {
      const db = client.db(database);
      const collection = db.collection(collection);
      const result = await collection.updateOne(query, update);
    } catch (error) {
      console.error('Error updating document:', error.message);
      throw error;
    }
  }
  

// Function to process api and mongo data and extract variables
function processData(balanceData, launchpadData, preMint) {
  const balance = balanceData.balance;
  const launchpadPriceInDoge = launchpadData.launchpadPriceInDoge;
  const launchpadMintedSupply = launchpadData.launchpadMintedSupply;

  const minted = Math.floor(balance / (1e8 * launchpadPriceInDoge) + preMint);

  return { minted, launchpadMintedSupply };
}



// Function to process a single address
async function processAddress(address, preMint) {
  try {
    const apiData = await fetchData(address);

    const query = { launchpadFundingWallet: address.toString() };
    const mongoData = await queryData(query);

    console.log("Fetching Data For Address: ", address);

    const { minted, launchpadMintedSupply } = processData(apiData, mongoData, preMint);
    console.log("Old LaunchpadMintedSupply: ", launchpadMintedSupply);
    console.log("New LaunchpadMintedSupply: ", minted);

    // Update MongoDB data
    if (!isNaN(minted) && minted !== undefined && minted > launchpadMintedSupply) {

      const update = { $set: { launchpadMintedSupply: minted } };
      await updateData(query, update);

      console.log("Updating Data Complete");
    } else if (isNaN(minted) || minted === undefined) {
      console.log("Minted Calculation Error");
    }
  } catch (e) {
    console.log(e);
  }
}


// Process each address: Connect to mongo, fetch api data, query mongo data, process data, update mongo if needed.
async function execute() {
  let mongoConnected = false;

  // Connect to mongo
  try {
    mongoConnected = await connectToMongo();
  } catch (e) {
    console.log(e);
    return;
  }

  if (!mongoConnected) {
    console.log("MongoDB Connection Failed");
    return;
  } 

  try {
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      const preMint = preMintVals[i];
      await processAddress(address, preMint);
    }
  } finally {
    // Close the MongoDB connection
    if (client) {
      client.close();
    }
  }
}

// Schedule the cron job 
cron.schedule(cronSchedule, async () => {
  console.log('Running the job...');
  await execute();
});

// Call the function to process addresses
execute();

