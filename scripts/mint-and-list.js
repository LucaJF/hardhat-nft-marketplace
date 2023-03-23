const { ethers } = require("hardhat")

async function mintAndList() {
    const nftMarketplace = await ethers.getContract("NFTMarketplace")
    const basicNFT = await ethers.getContract("BasicNFT")

    console.log("Minting...")
    const mintTx = await basicNFT.mintNft()
    const mintReceipt = await mintTx.wait(1)
    const tokenId = mintReceipt.events[0].args.tokenId

    console.log("Approving NFT...")
    const approveTx = await basicNFT.approve(nftMarketplace.address, tokenId)
    await approveTx.wait(1)

    console.log("Listing NFT...")
    const price = ethers.utils.parseEther("0.1")
    const listTx = await nftMarketplace.listItem(basicNFT.address, tokenId, price)
    await listTx.wait(1)
    console.log("Listed!")
}

mintAndList()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
