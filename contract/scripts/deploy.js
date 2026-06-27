const hre = require("hardhat");
const axios = require("axios");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  let oracleAddress = "0x3688bA24574dE625BB39fB2154f2EF7575E04653"; // Fallback address
  try {
    // Attempt to fetch the active ephemeral Oracle public address from the running relayer
    const response = await axios.get("http://localhost:3000/quantum-random");
    if (response.data && response.data.oracleAddress) {
      oracleAddress = response.data.oracleAddress;
      console.log("Found active Oracle Address from local Relayer:", oracleAddress);
    }
  } catch (error) {
    console.log("Could not fetch from running relayer, using fallback oracle address.");
  }

  const QuantumOracle = await hre.ethers.getContractFactory("QuantumOracle");
  const oracle = await QuantumOracle.deploy(oracleAddress);
  await oracle.waitForDeployment();

  console.log("QuantumOracle deployed to:", await oracle.getAddress());
  console.log(`Oracle Address registered in contract: ${oracleAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
