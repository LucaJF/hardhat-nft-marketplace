const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("NFT Marketplace Unit Tests", () => {
          let nftMarketplace, basicNFT, deployer, playerSigner
          const PRICE = ethers.utils.parseEther("0.1")
          const TOKEN_ID = 0

          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer
              playerSigner = (await ethers.getSigners())[1]
              await deployments.fixture(["all"])
              nftMarketplace = await ethers.getContract("NFTMarketplace")
              basicNFT = await ethers.getContract("BasicNFT")
              await basicNFT.mintNft()
              await basicNFT.approve(nftMarketplace.address, TOKEN_ID)
          })

          it("lists and can be bought", async () => {
              await nftMarketplace.listItem(basicNFT.address, TOKEN_ID, PRICE)
              const playerNFTMarketplace = nftMarketplace.connect(playerSigner)
              await playerNFTMarketplace.buyItem(basicNFT.address, TOKEN_ID, { value: PRICE })

              const newOwner = await basicNFT.ownerOf(TOKEN_ID)
              const deployerProceeds = await nftMarketplace.getProceeds(deployer)
              assert(newOwner.toString() == playerSigner.address)
              assert(deployerProceeds.toString() == PRICE.toString())
          })

          describe("listItem", () => {
              it("emits an event after listing an item", async () => {
                  expect(await nftMarketplace.listItem(basicNFT.address, TOKEN_ID, PRICE)).to.emit(
                      nftMarketplace,
                      "ItemListed"
                  )
              })

              it("exclusively Items that haven't been listed", async () => {
                  await nftMarketplace.listItem(basicNFT.address, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketplace.listItem(basicNFT.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWithCustomError(nftMarketplace, "NFTMarketplace__AlreadyListed")
              })

              it("exclusively allows owners to list", async () => {
                  nftMarketplace = nftMarketplace.connect(playerSigner)
                  await basicNFT.approve(playerSigner.address, TOKEN_ID)
                  await expect(
                      nftMarketplace.listItem(basicNFT.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWithCustomError(nftMarketplace, "NFTMarketplace__NotOwner")
              })

              it("needs approvals to list them", async () => {
                  await basicNFT.approve(ethers.constants.AddressZero, TOKEN_ID)
                  await expect(
                      nftMarketplace.listItem(basicNFT.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWithCustomError(
                      nftMarketplace,
                      "NFTMarketplace__NotAprovedForMarketplace"
                  )
              })

              it("updates listing with seller and price", async () => {
                  await nftMarketplace.listItem(basicNFT.address, TOKEN_ID, PRICE)
                  const listing = await nftMarketplace.getListing(basicNFT.address, TOKEN_ID)
                  assert(listing.price.toString() == PRICE.toString())
                  assert(listing.seller.toString() == deployer)
              })
          })

          describe("cancelListing", () => {
              it("reverts if there is no listing", async () => {
                  await expect(
                      nftMarketplace.cancelListing(basicNFT.address, TOKEN_ID)
                  ).to.be.revertedWithCustomError(nftMarketplace, "NFTMarketplace__NotListed")
              })

              it("reverts if anyone but the owner tries to call", async () => {
                  await nftMarketplace.listItem(basicNFT.address, TOKEN_ID, PRICE)
                  nftMarketplace = nftMarketplace.connect(playerSigner)
                  await basicNFT.approve(playerSigner.address, TOKEN_ID)
                  await expect(
                      nftMarketplace.cancelListing(basicNFT.address, TOKEN_ID)
                  ).to.be.revertedWithCustomError(nftMarketplace, "NFTMarketplace__NotOwner")
              })

              it("emits event and removes listing", async () => {
                  await nftMarketplace.listItem(basicNFT.address, TOKEN_ID, PRICE)
                  expect(await nftMarketplace.cancelListing(basicNFT.address, TOKEN_ID)).to.emit(
                      nftMarketplace,
                      "ItemCanceled"
                  )

                  const listing = await nftMarketplace.getListing(basicNFT.address, TOKEN_ID)
                  assert(listing.price.toString() == "0")
              })
          })

          describe("buyItem", () => {
              it("reverts if the item isn't listed", async () => {
                  await expect(
                      nftMarketplace.buyItem(basicNFT.address, TOKEN_ID)
                  ).to.be.revertedWithCustomError(nftMarketplace, "NFTMarketplace__NotListed")
              })

              it("reverts if the price isn't met", async () => {
                  await nftMarketplace.listItem(basicNFT.address, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketplace.buyItem(basicNFT.address, TOKEN_ID)
                  ).to.be.revertedWithCustomError(nftMarketplace, "NFTMarketplace__PriceNotMet")
              })

              it("transfers the NFT to the buyer and updates internal proceeds record", async () => {
                  await nftMarketplace.listItem(basicNFT.address, TOKEN_ID, PRICE)
                  nftMarketplace = nftMarketplace.connect(playerSigner)
                  await expect(
                      nftMarketplace.buyItem(basicNFT.address, TOKEN_ID, { value: PRICE })
                  ).to.emit(nftMarketplace, "ItemBought")

                  const newOwner = await basicNFT.ownerOf(TOKEN_ID)
                  const deployerProceeds = await nftMarketplace.getProceeds(deployer)
                  assert(newOwner.toString() === playerSigner.address)
                  assert(deployerProceeds.toString() === PRICE.toString())
              })
          })

          describe("updateListing", () => {
              it("must be owner and listed", async () => {
                  await expect(
                      nftMarketplace.updateListing(basicNFT.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWithCustomError(nftMarketplace, "NFTMarketplace__NotListed")
                  await nftMarketplace.listItem(basicNFT.address, TOKEN_ID, PRICE)
                  nftMarketplace = nftMarketplace.connect(playerSigner)
                  await expect(
                      nftMarketplace.updateListing(basicNFT.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWithCustomError(nftMarketplace, "NFTMarketplace__NotOwner")
              })

              it("updates the price of the item", async () => {
                  const updatedPrice = ethers.utils.parseEther("0.2")
                  await nftMarketplace.listItem(basicNFT.address, TOKEN_ID, PRICE)
                  expect(
                      await nftMarketplace.updateListing(basicNFT.address, TOKEN_ID, updatedPrice)
                  ).to.emit("ItemListed")
                  const listing = await nftMarketplace.getListing(basicNFT.address, TOKEN_ID)
                  assert(listing.price.toString() == updatedPrice.toString())
              })
          })

          describe("withdrawProceeds", () => {
              it("doesn't allow 0 proceed withdraws", async () => {
                  await expect(nftMarketplace.withdrawProceeds()).to.be.revertedWithCustomError(
                      nftMarketplace,
                      "NFTMarketplace__NoProceeds"
                  )
              })

              it("withdraw proceeds", async () => {
                  await nftMarketplace.listItem(basicNFT.address, TOKEN_ID, PRICE)
                  nftMarketplace.connect(playerSigner)
                  await nftMarketplace.buyItem(basicNFT.address, TOKEN_ID, { value: PRICE })
                  const deployerSigner = await ethers.getSigner(deployer)
                  nftMarketplace = nftMarketplace.connect(deployerSigner)

                  const deployerProceedsBefore = await nftMarketplace.getProceeds(deployer)
                  const deployerBalanceBefore = await deployerSigner.getBalance()
                  const res = await nftMarketplace.withdrawProceeds()
                  const { gasUsed, effectiveGasPrice } = await res.wait(1)
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const deployerBalanceAfter = await deployerSigner.getBalance()

                  assert(
                      deployerBalanceAfter.add(gasCost).toString() ===
                          deployerProceedsBefore.add(deployerBalanceBefore).toString()
                  )
              })
          })
      })
