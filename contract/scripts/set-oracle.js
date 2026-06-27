const hre = require("hardhat");

async function main() {
  const contractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const newOracleAddress = "0x011394599d3dd2d52c72Ebc285CE5df60c9b130A"; // Vercel's active oracle address
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Using deployer wallet:", deployer.address);

  const QuantumOracle = await hre.ethers.getContractFactory("QuantumOracle");
  const contract = QuantumOracle.attach(contractAddress);
  
  console.log("Sending transaction to update oracleNode...");
  const tx = await contract.updateOracleAddress(newOracleAddress);
  await tx.wait();
  
  console.log("Successfully registered Vercel Oracle on-chain!");
  console.log("New Contract Oracle Node address:", await contract.oracleNode());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
