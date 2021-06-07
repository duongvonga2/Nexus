'use strict';

const debug = require('debug')('icon');
const { customAlphabet } = require('nanoid/async');
const { IconConverter } = require('icon-sdk-js');
const { logger, pgPool } = require('../../common');

const AUCTION_START_PROTOTYPE = 'AuctionStart(int,str,Address,int,int)';
const AUCTION_ENDED_PROTOTYPE = 'AuctionEnded(int,str,Address,int,int,int)';
const BID_INFO_PROTOTYPE = 'BidInfo(int,str,Address,int,Address,int)';
const ICX_NUMBER = 10 ** 18;

const nanoid = customAlphabet('1234567890abcdef', 10);

// Ref: https://stackoverflow.com/questions/42876071/how-to-save-js-date-now-in-postgresql
async function createAuction(auction) {
  const query = 'INSERT INTO auctions (id, tx_hash, token_name, bidder_address, bid_amount, end_time, created_time) VALUES ($1, $2, $3, $4, $5, $6, NOW())';
  const endTime = new Date(auction.endTime);
  const values = [auction.id, auction.txHash, auction.tokenName, auction.bidderAddress, auction.bidAmount, endTime.toISOString()];

  await pgPool.query(query, values);
}

async function updateEndedAuction(auction) {
  const query = 'UPDATE auctions SET tx_hash_ended=$2, winner_address=$3, token_amount=$4, updated_time=NOW() WHERE id=$1';
  const values = [auction.id, auction.txHash, auction.winnerAddress, auction.tokenAmount];

  await pgPool.query(query, values);
}

async function createBid(bid) {
  const query = 'INSERT INTO bids (id, tx_hash, auction_id, token_name, current_bidder_address, current_bid_amount, new_bidder_address, new_bid_amount, created_time) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())';
  const values = [bid.id, bid.txHash, bid.auctionId, bid.tokenName, bid.currentBidderAddress, bid.currentBidAmount, bid.newBidderAddress, bid.newBidAmount];

  await pgPool.query(query, values);
}

/*
@EventLog(indexed = 3)
protected void AuctionStart(BigInteger auctionID, String tokenName, Address firstBidder, BigInteger bidAmount, long deadline) {}
*/
function getAuctionStartEvent(eventLogs) {
  try {
    for (const event of eventLogs) {
      if (AUCTION_START_PROTOTYPE === event.indexed[0]) {
        const auctionStart = {
          id: IconConverter.toNumber(event.indexed[1]),
          tokenName: event.indexed[2],
          bidderAddress: event.indexed[3],
          bidAmount: Math.floor(IconConverter.toNumber(event.data[0]) / ICX_NUMBER),
          endTime: Math.floor(IconConverter.toNumber(event.data[1]) / 1000) // in microsecond
        };

        debug('Get a AuctionStart %O', auctionStart);
        return auctionStart;
      }
    }
  } catch (error) {
    throw Error('Incorrect AuctionStart event data');
  }
}

/*
@EventLog(indexed = 3)
protected void AuctionEnded(BigInteger auctionID, String tokenName, Address winner, BigInteger tokenAmount, BigInteger bidAmount, long deadline) {}
*/
function getAuctionEndedEvent(eventLogs) {
  try {
    for (const event of eventLogs) {
      if (AUCTION_ENDED_PROTOTYPE === event.indexed[0]) {
        const auctionEnded = {
          id: IconConverter.toNumber(event.indexed[1]),
          tokenName: event.indexed[2],
          winnerAddress: event.indexed[3],
          tokenAmount: Math.floor(IconConverter.toNumber(event.data[0]) / ICX_NUMBER),
          bidAmount: Math.floor(IconConverter.toNumber(event.data[1]) / ICX_NUMBER),
          endTime: Math.floor(IconConverter.toNumber(event.data[2]) / 1000) // in microsecond
        };

        debug('Get a AuctionEnded %O', auctionEnded);
        return auctionEnded;
      }
    }
  } catch (error) {
    throw Error('Incorrect AuctionEnded event data');
  }
}

/*
@EventLog(indexed = 3)
protected void BidInfo(BigInteger auctionID, String tokenName, Address currentBidder, BigInteger currentBidAmount, Address newBidder,  BigInteger newBidAmount) {}
*/
function getBidInfoEvent(eventLogs) {
  try {
    for (const event of eventLogs) {
      if (BID_INFO_PROTOTYPE === event.indexed[0]) {
        const bidInfo = {
          auctionId: IconConverter.toNumber(event.indexed[1]),
          tokenName: event.indexed[2],
          currentBidderAddress: event.indexed[3],
          currentBidAmount: Math.floor(IconConverter.toNumber(event.data[0]) / ICX_NUMBER),
          newBidderAddress: event.data[1],
          newBidAmount: Math.floor(IconConverter.toNumber(event.data[2]) / ICX_NUMBER)
        };

        debug('Get a BidInfo %O', bidInfo);
        return bidInfo;
      }
    }
  } catch (error) {
    throw Error('Incorrect BidInfo event data');
  }
}

async function handleAuctionEvents(txResult) {
  if (1 !== txResult.status || process.env.FEE_AGGREGATION_SCORE_ADDRESS !== txResult.to || 0 === txResult.eventLogs.length)
    return false;

  try {
    const auctionStart = getAuctionStartEvent(txResult.eventLogs);

    if (auctionStart) {
      const auction = {
        ...auctionStart,
        txHash: txResult.txHash
      };

      debug('Create auction %d', auction.id);
      await createAuction(auction);
    }
  } catch (error) {
    logger.error(`${error.message} in txHash: ${txResult.txHash}`);
  }

  try {
    const auctionEnded = getAuctionEndedEvent(txResult.eventLogs);

    if (auctionEnded) {
      const auction = {
        ...auctionEnded,
        txHash: txResult.txHash
      };

      debug('Update ended auction %d', auction.id);
      await updateEndedAuction(auction);
    }
  } catch (error) {
    logger.error(`${error.message} in txHash: ${txResult.txHash}`);
  }

  try {
    const bidInfo = getBidInfoEvent(txResult.eventLogs);

    if (bidInfo) {
      const bid = {
        ...bidInfo,
        id: await nanoid(),
        txHash: txResult.txHash
      };

      debug('Create bid %s', bid.id);
      await createBid(bid);
    }
  } catch (error) {
    logger.error(`${error.message} in txHash: ${txResult.txHash}`);
  }

  return true;
}

module.exports = {
  getAuctionStartEvent,
  getAuctionEndedEvent,
  getBidInfoEvent,
  handleAuctionEvents
};
