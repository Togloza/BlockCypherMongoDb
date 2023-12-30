const axios = require('axios');
const { MongoClient } = require('mongodb');
const { cron } = require('node-cron');

const { addresses, mongoUri, preMintVals, database, collection } = require('./config.js'); // Path to config variables
let client;

// Function to connect to MongoDB
async function connectToMongo() {
  try {
    client = await MongoClient.connect(mongoUri);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    throw error;
  }
}

// Function to insert data into MongoDB
async function insertData(data) {
  try {
    const db = client.db();
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
      const db = client.db();
      const collection = db.collection('test-collection');
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

// Process each address: Connect to mongo, fetch api data, query mongo data, process data, update mongo if needed.
async function processAddresses() {
  // Connect to mongo  
  try {
    await connectToMongo();
    } catch (e) {
        console.log(e);
    }

    try {
    
    for (let i = 0; i < addresses.length; i++) {
      
      const address = addresses[i];
      const preMint = preMintVals[i];
      console.log("Updating address: ", address);

      
      try {
        const apiData = await fetchData(address);

        const query = { launchpadFundingWallet: address.toString() };
        const mongoData = await queryData(query);

        console.log("Fetching Data Complete:");

        const { minted, launchpadMintedSupply } = processData(apiData, mongoData, preMint);

        // Update MongoDB data
        if (minted !== NaN && minted !== undefined && minted > launchpadMintedSupply) {
          console.log("Old LaunchpadMintedSupply: ", launchpadMintedSupply);
          console.log("New LaunchpadMintedSupply: ", minted);

          const update = { $set: { launchpadMintedSupply: minted } };
          await updateData(query, update);

          console.log("Updating Data Complete"); 
        } else if (minted === NaN || minted === undefined) {
          console.log("Minted Calculation Error");
        }
      } catch (e) {
        console.log(e);
      }
    }
  } finally {
    // Close the MongoDB connection
    if (client) {
      client.close();
    }
  }
}

// Call the function to process addresses
processAddresses();

