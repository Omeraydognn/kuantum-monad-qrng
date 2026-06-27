const hre = require("hardhat");

async function main() {
  const contractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const QuantumOracle = await hre.ethers.getContractFactory("QuantumOracle");
  const contract = QuantumOracle.attach(contractAddress);
  
  const oracleNode = await contract.oracleNode();
  console.log("Contract Oracle Node address:", oracleNode);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
