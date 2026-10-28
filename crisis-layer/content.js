window.CONTENT = {
  "params": {
    "startCenter": 50,
    "halfWidth": 40,
    "oppositionShift": -5,
    "spacing": 40,
    "extreme": 80,
    "runOrder": [
      "Drought",
      "Blight",
      "Eminent domain",
      "Overproduction",
      "Drought",
      "Price crash",
      "Eminent domain",
      "Overproduction"
    ],
    "farmTiles": 24,
    "handKeys": [
      "LIB-P",
      "LIB-M",
      "PRO-M",
      "SOC",
      "OBJ"
    ]
  },
  "personas": [
    {
      "id": "Objectivist",
      "standard": "the individual",
      "vocabulary": "rights",
      "arguesFor": 80,
      "role": "Fixed pole. Always argues from rights, always for the full market policy."
    },
    {
      "id": "Libertarian",
      "standard": "the greater good",
      "vocabulary": "economics",
      "arguesFor": 40,
      "role": "Swing, market side. Practical card is silent on the standard; common-good card names it."
    },
    {
      "id": "Progressive",
      "standard": "need",
      "vocabulary": "rights, expertise",
      "arguesFor": -40,
      "role": "Swing, control side. Practical card: experts should manage it. Moral card: borrows rights vocabulary for a collective conclusion."
    },
    {
      "id": "Socialist",
      "standard": "the collective",
      "vocabulary": "justice, equality",
      "arguesFor": -80,
      "role": "Fixed pole. Always argues morally, always for control. Also the opposition slot every crisis."
    }
  ],
  "crises": [
    {
      "id": "Drought",
      "title": "Drought",
      "trigger": "There's a drought across the whole valley. Every farm pumps from the same underground water, and there isn't enough to go around. Your crops that need lots of water will grow only half as much this season.",
      "lobby": "Valley Water Users' Association",
      "lobbyAsk": -40,
      "policies": [
        {
          "pos": 80,
          "name": "Water rights you can buy and sell",
          "immediate": "You can buy and sell water. In a drought, buying it costs 12 coins for each thirsty crop, and selling yours earns 6.",
          "drag": "None",
          "modifier": "unlockedActions: [tradeWaterRights]",
          "effects": [
            {
              "type": "unlockAction",
              "action": "tradeWaterRights",
              "buy": 12,
              "sell": 6,
              "duration": "standing"
            }
          ],
          "tilesLost": 0,
          "offer": false,
          "offerTiles": 0
        },
        {
          "pos": 40,
          "name": "Every farm pumps for itself, no price limits",
          "immediate": "You can drill your own well, and in a drought it waters your thirsty crops. Every farm pumping hard drains the valley's water, so the next drought lasts two seasons.",
          "drag": "None",
          "modifier": "unlockedActions: [drillWell]",
          "effects": [
            {
              "type": "unlockAction",
              "action": "drillWell",
              "duration": "standing"
            },
            {
              "type": "aquiferDrain",
              "droughtSeasons": 2,
              "duration": "standing"
            }
          ],
          "tilesLost": 0,
          "offer": false,
          "offerTiles": 0
        },
        {
          "pos": 0,
          "name": "Public water company",
          "immediate": "A public water company now pumps for the whole valley, so any well on your farm is sealed. It sells you water at cost while this drought lasts.",
          "drag": "You pay a water bill from now on. Any well on your farm stays sealed, you can't build a new one, and you can't buy or sell water.",
          "modifier": "waterAtCost: this drought; feePerTick: small; sealedBuildings: [well]; lockedActions: [drillWell, tradeWater]",
          "effects": [
            {
              "type": "waterAtCost",
              "duration": "crisis"
            },
            {
              "type": "fee",
              "per": "tick",
              "amount": "small",
              "duration": "standing"
            },
            {
              "type": "sealBuilding",
              "building": "well",
              "duration": "standing"
            },
            {
              "type": "lockAction",
              "action": "drillWell",
              "duration": "standing"
            },
            {
              "type": "lockAction",
              "action": "tradeWater",
              "duration": "standing"
            }
          ],
          "tilesLost": 0,
          "offer": false,
          "offerTiles": 0
        },
        {
          "pos": -40,
          "name": "Water board with a rising pumping tax",
          "immediate": "The water board now does all the pumping, so any well on your farm is sealed. It taxes every gallon it pumps for you, and the more you use, the higher the rate. You can afford to water about 60% of your thirsty crops. The rest dry up and die.",
          "drag": "The pumping tax stays, so watering more than that never pays. Any well on your farm stays sealed, you can't build a new one, and you can't buy or sell water.",
          "modifier": "waterTax: rises per unit pumped; effective irrigationCap ≈ 0.6 × planted; sealedBuildings: [well]; lockedActions: [tradeWater, drillWell]",
          "effects": [
            {
              "type": "waterTax",
              "schedule": "rising",
              "duration": "standing"
            },
            {
              "type": "irrigationCap",
              "fraction": 0.6,
              "duration": "standing"
            },
            {
              "type": "sealBuilding",
              "building": "well",
              "duration": "standing"
            },
            {
              "type": "lockAction",
              "action": "drillWell",
              "duration": "standing"
            },
            {
              "type": "lockAction",
              "action": "tradeWater",
              "duration": "standing"
            }
          ],
          "tilesLost": 4,
          "offer": false,
          "offerTiles": 0
        },
        {
          "pos": -80,
          "name": "Water handed out by need",
          "immediate": "Big farms get less water than small ones. Whatever you can't water dies. Your well is sealed.",
          "drag": "The limit stays, your well stays sealed, and you're not allowed to buy or sell water.",
          "modifier": "irrigationCap: 0.4 × planted; lockedActions: [tradeWater, drillWell]",
          "effects": [
            {
              "type": "irrigationCap",
              "fraction": 0.4,
              "duration": "standing"
            },
            {
              "type": "lockAction",
              "action": "tradeWater",
              "duration": "standing"
            },
            {
              "type": "lockAction",
              "action": "drillWell",
              "duration": "standing"
            },
            {
              "type": "sealBuilding",
              "building": "well",
              "duration": "standing"
            }
          ],
          "tilesLost": 6,
          "offer": false,
          "offerTiles": 0
        }
      ]
    },
    {
      "id": "Blight",
      "title": "Blight",
      "trigger": "A crop disease is spreading through the valley. It came in on bad seed, and every farm that plants that seed spreads it to the fields next door. It has already killed one of your crops, which will take two seasons to grow back.",
      "lobby": "Seed Trade Association",
      "lobbyAsk": -40,
      "policies": [
        {
          "pos": 80,
          "name": "Buy seed from anyone, at your own risk",
          "immediate": "You can buy premium seed: it costs half again as much and yields 30% more, but about one planting in eight carries disease and dies.",
          "drag": "None",
          "modifier": "unlockedActions: [premiumSeed]",
          "effects": [
            {
              "type": "unlockAction",
              "action": "premiumSeed",
              "seedMult": 1.5,
              "yieldMult": 1.3,
              "failOneIn": 8,
              "duration": "standing"
            }
          ],
          "tilesLost": 0,
          "offer": false,
          "offerTiles": 0
        },
        {
          "pos": 40,
          "name": "Optional 'checked safe' label from seed sellers",
          "immediate": "Seed sellers race to earn the 'checked safe' label. Buyers pay extra for labeled seed, so soon nearly all seed carries the label and costs more.",
          "drag": "Seed costs about a quarter more from now on.",
          "modifier": "seedCostMult: 1.25",
          "effects": [
            {
              "type": "seedCostMult",
              "mult": 1.25,
              "duration": "standing"
            }
          ],
          "tilesLost": 0,
          "offer": false,
          "offerTiles": 0
        },
        {
          "pos": 0,
          "name": "County seed checks, for a fee",
          "immediate": "The county now checks your seed, so it's safe to replant sooner. Your blighted crop misses one planting season instead of two.",
          "drag": "You pay a fee every time you plant, and checked seed costs about a quarter more. It's treated against the disease, so your crops yield 10% less. To keep the disease out of the soil, you can't plant the same crop twice in a row in one plot. Breaking that rule costs a fine.",
          "modifier": "recoverySeasons: 1; feePerPlanting; seedCostMult: 1.25; cropRotation; yieldMult: 0.9",
          "effects": [
            {
              "type": "recoverySeasons",
              "seasons": 1,
              "duration": "once"
            },
            {
              "type": "fee",
              "per": "planting",
              "duration": "standing"
            },
            {
              "type": "seedCostMult",
              "mult": 1.25,
              "duration": "standing"
            },
            {
              "type": "cropRotation",
              "duration": "standing"
            },
            {
              "type": "yieldMult",
              "mult": 0.9,
              "duration": "standing"
            },
            {
              "type": "fine",
              "perPlanting": 3,
              "duration": "standing"
            }
          ],
          "tilesLost": 0,
          "offer": false,
          "offerTiles": 0
        },
        {
          "pos": -40,
          "name": "Required seed checks and planting permits",
          "immediate": "Every farm's seed is checked, so nothing can reinfect your fields. You can replant right away.",
          "drag": "You pay a fee every time you plant. Checked seed costs about a quarter more, and it's treated against the disease, so your crops yield 10% less. Before you plant, you file for a permit at the council office, and it's good from the next season. You can't plant the same crop twice in a row in one plot. Breaking either rule costs a fine.",
          "modifier": "recoverySeasons: 0; feePerPlanting; permitDelayTicks on plant; cropRotation; seedCostMult: 1.25; yieldMult: 0.9",
          "effects": [
            {
              "type": "recoverySeasons",
              "seasons": 0,
              "duration": "once"
            },
            {
              "type": "fee",
              "per": "planting",
              "duration": "standing"
            },
            {
              "type": "permitDelay",
              "on": "plant",
              "duration": "standing"
            },
            {
              "type": "cropRotation",
              "duration": "standing"
            },
            {
              "type": "seedCostMult",
              "mult": 1.25,
              "duration": "standing"
            },
            {
              "type": "yieldMult",
              "mult": 0.9,
              "duration": "standing"
            },
            {
              "type": "fine",
              "perPlanting": 3,
              "duration": "standing"
            }
          ],
          "tilesLost": 0,
          "offer": false,
          "offerTiles": 0
        },
        {
          "pos": -80,
          "name": "A valley seed board controls all seed and picks your crops",
          "immediate": "You get new seed for free. The board now names one approved crop each season, and its seed is free when you plant.",
          "drag": "The state decides what you grow, and its seed yields 20% less. Planting anything else costs a fine.",
          "modifier": "cropChoiceLocked: true; freeSeed: true",
          "effects": [
            {
              "type": "freeSeed",
              "duration": "standing"
            },
            {
              "type": "cropChoiceLocked",
              "duration": "standing"
            },
            {
              "type": "yieldMult",
              "mult": 0.8,
              "duration": "standing"
            },
            {
              "type": "fine",
              "perPlanting": 3,
              "duration": "standing"
            }
          ],
          "tilesLost": 0,
          "offer": false,
          "offerTiles": 0
        }
      ]
    },
    {
      "id": "Price crash",
      "title": "Price crash",
      "trigger": "Times are hard across the country, and people are spending less on everything, food included. The companies that buy the valley's crops have cut what they pay. For the next two seasons, everything you sell brings in 40% less. Some farms in the valley won't survive it.",
      "lobby": "Farm Bureau",
      "lobbyAsk": -40,
      "policies": [
        {
          "pos": 80,
          "name": "Leave prices alone",
          "immediate": "None",
          "drag": "None",
          "modifier": "—",
          "effects": [],
          "tilesLost": 0,
          "offer": false,
          "offerTiles": 0
        },
        {
          "pos": 40,
          "name": "Let farmers lock in next year's price now",
          "immediate": "While prices are down, you can lock in 85% of the normal price for the next four seasons. If prices come back sooner, you're still held to 85%.",
          "drag": "None",
          "modifier": "unlockedActions: [forwardContract]",
          "effects": [
            {
              "type": "unlockAction",
              "action": "forwardContract",
              "mult": 0.85,
              "seasons": 4,
              "duration": "standing"
            }
          ],
          "tilesLost": 0,
          "offer": false,
          "offerTiles": 0
        },
        {
          "pos": 0,
          "name": "Short-term loans",
          "immediate": "You get a loan now.",
          "drag": "You pay it back over the next four seasons.",
          "modifier": "cashNow; repayOverSeasons: 4",
          "effects": [
            {
              "type": "loan",
              "repayOverSeasons": 4,
              "duration": "once"
            }
          ],
          "tilesLost": 0,
          "offer": false,
          "offerTiles": 0
        },
        {
          "pos": -40,
          "name": "Lowest-price guarantee, paid for by a harvest tax",
          "immediate": "Prices drop only 10% instead of 40%. A valley relief fund covers the difference.",
          "drag": "From now on, 10% of every harvest's income goes into the relief fund.",
          "modifier": "priceFloorMult: 0.9 (vs 0.6); harvestTax: 0.10 → reliefFund",
          "effects": [
            {
              "type": "priceFloor",
              "mult": 0.9,
              "duration": "crisis"
            },
            {
              "type": "harvestTax",
              "rate": 0.1,
              "fund": "relief",
              "duration": "standing"
            }
          ],
          "tilesLost": 0,
          "offer": false,
          "offerTiles": 0
        },
        {
          "pos": -80,
          "name": "The state buys all crops at set prices",
          "immediate": "Prices stay where they were before the crash.",
          "drag": "You have to sell to the state, only as much as they allow, at a price that never goes up. The allowance changes every season, sales over it earn nothing and don't count toward upgrades, and seed costs half again as much.",
          "modifier": "priceFixed: preCrash; sellViaBoard: true; quota",
          "effects": [
            {
              "type": "priceFixed",
              "level": "preCrash",
              "duration": "standing"
            },
            {
              "type": "sellViaBoard",
              "duration": "standing"
            },
            {
              "type": "quota",
              "varies": true,
              "progress": false,
              "duration": "standing"
            },
            {
              "type": "seedCostMult",
              "mult": 1.5,
              "duration": "standing"
            }
          ],
          "tilesLost": 0,
          "offer": false,
          "offerTiles": 0
        }
      ]
    },
    {
      "id": "Eminent domain",
      "title": "Eminent domain",
      "trigger": "The county is damming the river to build a reservoir, so the towns downstream have water all year. The plan runs right through your east fields.",
      "lobby": "County Board",
      "lobbyAsk": -40,
      "policies": [
        {
          "pos": 80,
          "name": "No taking land. The county builds on its own land.",
          "immediate": "None",
          "drag": "None",
          "modifier": "—",
          "effects": [],
          "tilesLost": 0,
          "offer": false,
          "offerTiles": 0
        },
        {
          "pos": 40,
          "name": "Only buy from people who want to sell",
          "immediate": "The county offers to buy 4 tiles at the edge of your farm for 20% more than they're worth. You can say no.",
          "drag": "None",
          "modifier": "offerTiles: {count: 4, cashPerTile: 1.2×}",
          "effects": [
            {
              "type": "sellTiles",
              "count": 4,
              "selection": "edge",
              "cashPerTile": 1.2,
              "onAccept": true,
              "duration": "once"
            }
          ],
          "tilesLost": 0,
          "offer": true,
          "offerTiles": 4
        },
        {
          "pos": 0,
          "name": "Take the land, pay full price",
          "immediate": "The county takes 4 tiles at the edge of your farm and pays full price. You can't say no.",
          "drag": "None",
          "modifier": "removeTiles: {count: 4, selection: edge, cashPerTile: 1.0×}",
          "effects": [
            {
              "type": "removeTiles",
              "count": 4,
              "selection": "edge",
              "cashPerTile": 1,
              "duration": "once"
            }
          ],
          "tilesLost": 4,
          "offer": false,
          "offerTiles": 0
        },
        {
          "pos": -40,
          "name": "Take the land, pay a set price",
          "immediate": "The county takes 6 tiles across your farm and pays you half what they're worth. Your fields drain into the new reservoir, so to keep its water clean, the county now plans what you build and plant. From now on the county's chosen seed is free when you plant.",
          "drag": "New buildings and upgrades need county approval, so they take a season longer. Before you plant, you file for a permit at the council office, and it's good from the next season. Each season the county names the one crop you may plant and gives you its seed free. Planting anything else, or without a permit, costs a fine.",
          "modifier": "removeTiles: {count: 6, selection: random, cashPerTile: 0.5×}; permitDelayTicks on plant; cropChoiceLocked: true; freeSeed: true",
          "effects": [
            {
              "type": "removeTiles",
              "count": 6,
              "selection": "random",
              "cashPerTile": 0.5,
              "duration": "once"
            },
            {
              "type": "buildDelay",
              "seasons": 1,
              "duration": "standing"
            },
            {
              "type": "permitDelay",
              "on": "plant",
              "duration": "standing"
            },
            {
              "type": "freeSeed",
              "duration": "standing"
            },
            {
              "type": "cropChoiceLocked",
              "duration": "standing"
            },
            {
              "type": "fine",
              "perPlanting": 3,
              "duration": "standing"
            }
          ],
          "tilesLost": 6,
          "offer": false,
          "offerTiles": 0
        },
        {
          "pos": -80,
          "name": "Take the best land for the common good, pay nothing",
          "immediate": "The county takes whatever route it likes best: your 8 best tiles, and pays nothing. The rest of your land drains into the reservoir, so the county now plans what you plant on it. From now on the county's chosen seed is free when you plant.",
          "drag": "The county zones your farm: you can't put up more buildings than you have now. Before you plant, you file for a permit at the council office, and it's good from the next season. Each season the county names the one crop you may plant and gives you its seed free. Planting anything else, or without a permit, costs a fine.",
          "modifier": "removeTiles: {count: 8, selection: mostProductive, cashPerTile: 0}; permitDelayTicks on plant; cropChoiceLocked: true; freeSeed: true",
          "effects": [
            {
              "type": "removeTiles",
              "count": 8,
              "selection": "mostProductive",
              "cashPerTile": 0,
              "duration": "once"
            },
            {
              "type": "buildingCap",
              "duration": "standing"
            },
            {
              "type": "permitDelay",
              "on": "plant",
              "duration": "standing"
            },
            {
              "type": "freeSeed",
              "duration": "standing"
            },
            {
              "type": "cropChoiceLocked",
              "duration": "standing"
            },
            {
              "type": "fine",
              "perPlanting": 3,
              "duration": "standing"
            }
          ],
          "tilesLost": 8,
          "offer": false,
          "offerTiles": 0
        }
      ],
      "note": "Survey stakes appear; no farm effect until a policy passes."
    },
    {
      "id": "Overproduction",
      "title": "Overproduction",
      "trigger": "Your farm has had its best year ever. Other farmers complain to the council that you grow so much, they can't sell their own crops. There's so much on the market that the price of your top crop has already dropped 25%. They want the council to step in.",
      "lobby": "Growers' Association",
      "lobbyAsk": -40,
      "policies": [
        {
          "pos": 80,
          "name": "Leave it alone",
          "immediate": "None",
          "drag": "None",
          "modifier": "—",
          "effects": [],
          "tilesLost": 0,
          "offer": false,
          "offerTiles": 0
        },
        {
          "pos": 40,
          "name": "Farmers' group you can choose to join",
          "immediate": "A farmers' group offers you a deal. If every member grows less of the top crop, prices go back up, and you'd get 15% more for yours. Your side: grow it on 5 tiles or fewer. You can say no.",
          "drag": "Your top crop is limited to 5 tiles. That's your side of the deal.",
          "modifier": "offerCoop: {priceMult: 1.15, maxTilesPerCrop: {top: 5}}",
          "effects": [
            {
              "type": "priceMult",
              "crop": "top",
              "mult": 1.15,
              "onAccept": true,
              "duration": "standing"
            },
            {
              "type": "maxTilesPerCrop",
              "crop": "top",
              "tiles": 5,
              "onAccept": true,
              "duration": "standing"
            }
          ],
          "tilesLost": 0,
          "offer": true,
          "offerTiles": 0
        },
        {
          "pos": 0,
          "name": "Fee on extra crops",
          "immediate": "You pay a fee for every tile of your top crop past 5, and you have to wait to sell the extra.",
          "drag": "The fee stays.",
          "modifier": "feePerTileAbove: 5; sellDelayTicks on excess",
          "effects": [
            {
              "type": "fee",
              "per": "tileAboveCap",
              "crop": "top",
              "cap": 5,
              "duration": "standing"
            },
            {
              "type": "sellDelay",
              "on": "excess",
              "duration": "standing"
            }
          ],
          "tilesLost": 0,
          "offer": false,
          "offerTiles": 0
        },
        {
          "pos": -40,
          "name": "Limits on how much you can plant",
          "immediate": "Your top crop gets plowed under past 5 tiles. The county farm office now limits how much each farm sells, so every farm gets its turn. Once the glut passes, it holds every crop at today's normal price.",
          "drag": "You can't grow more than 5 tiles of your top crop, and one plot in five must rest empty each season. Breaking either rule costs a fine. Each season you can make about one sale for every two plots you have. Sales over that earn nothing and don't count toward upgrades. Crop prices never go up, even when you improve your farm.",
          "modifier": "destroyCrop: {crop: top, aboveTiles: 5}; maxTilesPerCrop: {top: 5}; fallow: 0.2; quota (steady); priceFixed: current",
          "effects": [
            {
              "type": "destroyCrop",
              "crop": "top",
              "aboveTiles": 5,
              "duration": "once"
            },
            {
              "type": "maxTilesPerCrop",
              "crop": "top",
              "tiles": 5,
              "duration": "standing"
            },
            {
              "type": "fallow",
              "share": 0.2,
              "duration": "standing"
            },
            {
              "type": "fine",
              "perPlanting": 3,
              "duration": "standing"
            },
            {
              "type": "quota",
              "varies": false,
              "progress": false,
              "duration": "standing"
            },
            {
              "type": "priceFixed",
              "level": "current",
              "duration": "standing"
            }
          ],
          "tilesLost": 5,
          "offer": false,
          "offerTiles": 0
        },
        {
          "pos": -80,
          "name": "Ban the crop and even things out",
          "immediate": "Your top crop is banned, and every tile of it is destroyed.",
          "drag": "Anything you grow above the valley average gets taken at every harvest, crop prices never go up, and your buildings can't be upgraded. Each season the council lets you make only a set number of sales, and the number changes. Sales over it earn nothing and don't count toward upgrades. Planting the banned crop costs a fine.",
          "modifier": "destroyCrop: {crop: top, aboveTiles: 0}; banCrops: [top]; confiscateAboveAvg: 1.0; quota; priceFixed: current",
          "effects": [
            {
              "type": "destroyCrop",
              "crop": "top",
              "aboveTiles": 0,
              "duration": "once"
            },
            {
              "type": "banCrop",
              "crop": "top",
              "duration": "standing"
            },
            {
              "type": "confiscateAboveAverage",
              "fraction": 1,
              "duration": "standing"
            },
            {
              "type": "freezeUpgrades",
              "duration": "standing"
            },
            {
              "type": "fine",
              "perPlanting": 3,
              "duration": "standing"
            },
            {
              "type": "quota",
              "varies": true,
              "progress": false,
              "duration": "standing"
            },
            {
              "type": "priceFixed",
              "level": "current",
              "duration": "standing"
            }
          ],
          "tilesLost": 10,
          "offer": false,
          "offerTiles": 0
        }
      ],
      "note": "In the real game, trigger off farm value above a threshold."
    }
  ],
  "cards": [
    {
      "id": "D-OBJ",
      "crisis": "Drought",
      "persona": "Objectivist",
      "key": "OBJ",
      "cardType": "Moral — rights",
      "premiseType": "moral_rights",
      "argument": "Water underground does nobody any good until someone drills a well and pumps it up. Whoever does that work has made it useful, and that's what makes it theirs. So let every farm own the water it pumps, as property it can buy and sell. Then the water you bring up is yours to use, save, or trade, and a neighbor who needs more can make you an offer.",
      "explicitShift": 10,
      "conclusionPos": 80
    },
    {
      "id": "D-LIB-P",
      "crisis": "Drought",
      "persona": "Libertarian",
      "key": "LIB-P",
      "cardType": "Practical — efficiency (silent on standard)",
      "premiseType": "practical",
      "argument": "A price tells every farmer how scarce water is. When water costs more, farmers switch to crops that need less and make every drop count. Farms with water to spare sell it to farms that need it, so the water ends up wherever it grows the most food. It happens on its own, and it happens fast. So let every farm pump for itself and sell water at whatever price it can get.",
      "explicitShift": 0,
      "conclusionPos": 40,
      "personaLabel": "Practical libertarian"
    },
    {
      "id": "D-LIB-M",
      "crisis": "Drought",
      "persona": "Libertarian",
      "key": "LIB-M",
      "cardType": "Moral — common good (explicit)",
      "premiseType": "moral_common_good",
      "argument": "This drought will hit the poorest families hardest. With no price limits, any farm, big or small, can buy extra water when it's short and sell what it doesn't use. A small farm about to lose a field can buy enough to save it, fewer farms go under, and more food reaches the table. That's what's best for everyone, and for the poorest most of all.",
      "explicitShift": -6,
      "conclusionPos": 40,
      "personaLabel": "Bleeding-heart libertarian"
    },
    {
      "id": "D-PRO-P",
      "crisis": "Drought",
      "persona": "Progressive",
      "key": "PRO-P",
      "cardType": "Practical — expertise",
      "premiseType": "practical",
      "argument": "Every well pulls from the same underground water. The scientists know how much the valley can safely pump. A water board with a rising pumping tax can hold us to that, so the water lasts through the drought.",
      "explicitShift": 0,
      "conclusionPos": -40
    },
    {
      "id": "D-PRO-M",
      "crisis": "Drought",
      "persona": "Progressive",
      "key": "PRO-M",
      "cardType": "Moral — positive right",
      "premiseType": "moral_positive_right",
      "argument": "Every family in this valley has a right to enough water to keep its farm alive, rich or poor. So let the water board put a tax on pumping that climbs the more you pump. The first gallons every farm needs stay cheap, small farms barely feel it, and the farms that pump the most pay the most, so the water stretches to reach everyone.",
      "explicitShift": -7,
      "conclusionPos": -40
    },
    {
      "id": "D-SOC",
      "crisis": "Drought",
      "persona": "Socialist",
      "key": "SOC",
      "cardType": "Moral — collective justice",
      "premiseType": "moral_collective",
      "argument": "The water under this valley belongs to all of us, so in a drought we share it. A valley water board should work out what each farm needs and hand that out, with no buying or selling. Every family has an equal claim, no farm goes without, and we all get through this dry season together.",
      "explicitShift": -10,
      "conclusionPos": -80
    },
    {
      "id": "B-OBJ",
      "crisis": "Blight",
      "persona": "Objectivist",
      "key": "OBJ",
      "cardType": "Moral — rights",
      "premiseType": "moral_rights",
      "argument": "Your farm, your choice of seed. Pick from any seller you trust, and the risk is yours to weigh. If your seed harms your neighbor's field, you owe them for it, and that's between the two of you. Making your own choices and standing behind them is what owning a farm means.",
      "explicitShift": 10,
      "conclusionPos": 80
    },
    {
      "id": "B-LIB-P",
      "crisis": "Blight",
      "persona": "Libertarian",
      "key": "LIB-P",
      "cardType": "Practical — efficiency (silent on standard)",
      "premiseType": "practical",
      "argument": "Farmers have every reason to want clean seed, so put that to work. Let seed sellers earn a 'checked safe' label, and buyers will pay extra for labeled seed. Sellers race to get it, clean seed outsells bad seed, and the disease runs out of fields to spread to.",
      "explicitShift": 0,
      "conclusionPos": 40,
      "personaLabel": "Practical libertarian"
    },
    {
      "id": "B-LIB-M",
      "crisis": "Blight",
      "persona": "Libertarian",
      "key": "LIB-M",
      "cardType": "Moral — common good (explicit)",
      "premiseType": "moral_common_good",
      "argument": "Think about the small farms. One more lost harvest and they're gone. A 'checked safe' label works for everyone: any farm, big or small, can see at a glance which seed is safe, buy what it can afford, and plant it the same day. That's what's best for everyone, and for the small farms most of all.",
      "explicitShift": -6,
      "conclusionPos": 40,
      "personaLabel": "Bleeding-heart libertarian"
    },
    {
      "id": "B-PRO-P",
      "crisis": "Blight",
      "persona": "Progressive",
      "key": "PRO-P",
      "cardType": "Practical — expertise",
      "premiseType": "practical",
      "argument": "Crop disease doesn't stop at the fence. One batch of bad seed can infect the whole valley. The plant experts know how to spot it. Required checks and planting permits let them test every farm's seed before it's planted.",
      "explicitShift": 0,
      "conclusionPos": -40
    },
    {
      "id": "B-PRO-M",
      "crisis": "Blight",
      "persona": "Progressive",
      "key": "PRO-M",
      "cardType": "Moral — positive right",
      "premiseType": "moral_positive_right",
      "argument": "Everyone has a right to a harvest that bad seed can't take away. Buy seed from whoever you like, and the county checks every batch before it goes in the ground, with a permit to show yours passed. Every family in the valley gets to plant knowing its harvest is safe.",
      "explicitShift": -7,
      "conclusionPos": -40
    },
    {
      "id": "B-SOC",
      "crisis": "Blight",
      "persona": "Socialist",
      "key": "SOC",
      "cardType": "Moral — collective justice",
      "premiseType": "moral_collective",
      "argument": "The valley's harvest belongs to everyone who needs it to eat, so we should protect it together. A valley seed board should be the only source of seed. It hands out clean seed to every farm for free and plans who plants what, so every farm starts equal and one disease can never sweep through the whole valley again.",
      "explicitShift": -10,
      "conclusionPos": -80
    },
    {
      "id": "P-OBJ",
      "crisis": "Price crash",
      "persona": "Objectivist",
      "key": "OBJ",
      "cardType": "Moral — rights",
      "premiseType": "moral_rights",
      "argument": "Your crop is yours to sell, at whatever price a buyer freely offers and you accept. Leave prices alone and every choice stays yours: sell now, store it and wait, or switch crops. Every deal is one both sides wanted.",
      "explicitShift": 10,
      "conclusionPos": 80
    },
    {
      "id": "P-LIB-P",
      "crisis": "Price crash",
      "persona": "Libertarian",
      "key": "LIB-P",
      "cardType": "Practical — efficiency (silent on standard)",
      "premiseType": "practical",
      "argument": "Low prices fix themselves. Some farms switch crops, there's less to sell, and prices climb back up. Let farmers lock in a price for next year's crop now, and each farm knows exactly what it will earn while the market recovers. It can plan, borrow against that price, and get through the dip.",
      "explicitShift": 0,
      "conclusionPos": 40,
      "personaLabel": "Practical libertarian"
    },
    {
      "id": "P-LIB-M",
      "crisis": "Price crash",
      "persona": "Libertarian",
      "key": "LIB-M",
      "cardType": "Moral — common good (explicit)",
      "premiseType": "moral_common_good",
      "argument": "In hard times, cheaper food is one of the best things that can happen to the families in the valley with the least. Let prices settle on their own, and farmers who want a sure thing can agree on next year's price with a buyer now. That's what's best for everyone, and for the poorest most of all.",
      "explicitShift": -6,
      "conclusionPos": 40,
      "personaLabel": "Bleeding-heart libertarian"
    },
    {
      "id": "P-PRO-P",
      "crisis": "Price crash",
      "persona": "Progressive",
      "key": "PRO-P",
      "cardType": "Practical — expertise",
      "premiseType": "practical",
      "argument": "Economists have studied crop prices for a hundred years, and they know how to even out price swings. A guaranteed lowest price, paid for with a harvest tax, keeps good farms going through a slump.",
      "explicitShift": 0,
      "conclusionPos": -40
    },
    {
      "id": "P-PRO-M",
      "crisis": "Price crash",
      "persona": "Progressive",
      "key": "PRO-M",
      "cardType": "Moral — positive right",
      "premiseType": "moral_positive_right",
      "argument": "Everyone who grows our food has a right to make a living from it. A family shouldn't lose its farm over a bad year it didn't cause. So take a small share of every harvest into a valley relief fund, and use it to guarantee a lowest price. Above that floor, prices are free to rise and fall.",
      "explicitShift": -7,
      "conclusionPos": -40
    },
    {
      "id": "P-SOC",
      "crisis": "Price crash",
      "persona": "Socialist",
      "key": "SOC",
      "cardType": "Moral — collective justice",
      "premiseType": "moral_collective",
      "argument": "Food shouldn't be a gamble, and a farmer's living shouldn't depend on luck. A valley buying board should buy every crop at one fair price and sell it on. Every farm gets the same deal: no windfalls, no ruin. We all eat, so we all share the risk.",
      "explicitShift": -10,
      "conclusionPos": -80
    },
    {
      "id": "E-OBJ",
      "crisis": "Eminent domain",
      "persona": "Objectivist",
      "key": "OBJ",
      "cardType": "Moral — rights",
      "premiseType": "moral_rights",
      "argument": "A reservoir is a fine thing for the county to build on land it already owns. Your east fields are yours to farm, keep, or pass on, and a good cause doesn't change that. What happens to them is your call alone.",
      "explicitShift": 10,
      "conclusionPos": 80
    },
    {
      "id": "E-LIB-P",
      "crisis": "Eminent domain",
      "persona": "Libertarian",
      "key": "LIB-P",
      "cardType": "Practical — efficiency (silent on standard)",
      "premiseType": "practical",
      "argument": "Buying only from people who want to sell gets a project built fast. Willing sellers sign quickly, the price is settled up front, and work starts right away. Draw the route across the land that's on offer, and the towns downstream get their water sooner.",
      "explicitShift": 0,
      "conclusionPos": 40,
      "personaLabel": "Practical libertarian"
    },
    {
      "id": "E-LIB-M",
      "crisis": "Eminent domain",
      "persona": "Libertarian",
      "key": "LIB-M",
      "cardType": "Moral — common good (explicit)",
      "premiseType": "moral_common_good",
      "argument": "A few fields can be a small family's whole living. If the county buys only from owners who choose to sell, at a price they agree to, families who sell come out ahead, families who stay keep farming, and the reservoir still gets built. That's what's best for everyone, and for the small farms most of all.",
      "explicitShift": -6,
      "conclusionPos": 40,
      "personaLabel": "Bleeding-heart libertarian"
    },
    {
      "id": "E-PRO-P",
      "crisis": "Eminent domain",
      "persona": "Progressive",
      "key": "PRO-P",
      "cardType": "Practical — expertise",
      "premiseType": "practical",
      "argument": "The engineers have surveyed the whole river and found the best place for the dam. Follow their plan. Take the strip it needs, pay each owner a set price based on the survey, and the work stays on schedule.",
      "explicitShift": 0,
      "conclusionPos": -40
    },
    {
      "id": "E-PRO-M",
      "crisis": "Eminent domain",
      "persona": "Progressive",
      "key": "PRO-M",
      "cardType": "Moral — positive right",
      "premiseType": "moral_positive_right",
      "argument": "Thousands of families downstream have a right to water all year. So build the reservoir, and pay the farm family a fair price for the land it takes. That way everyone gets what they need.",
      "explicitShift": -7,
      "conclusionPos": -40
    },
    {
      "id": "E-SOC",
      "crisis": "Eminent domain",
      "persona": "Socialist",
      "key": "SOC",
      "cardType": "Moral — collective justice",
      "premiseType": "moral_collective",
      "argument": "This land was here before any of us, and the river that runs through it belongs to every family in the valley. So the county should take the land the reservoir needs, even the best land, and pay nothing for it, because it has always been ours to share. Then every family downstream has water all year, and what the valley was given, the valley shares.",
      "explicitShift": -10,
      "conclusionPos": -80
    },
    {
      "id": "O-OBJ",
      "crisis": "Overproduction",
      "persona": "Objectivist",
      "key": "OBJ",
      "cardType": "Moral — rights",
      "premiseType": "moral_rights",
      "argument": "You grew a great crop, and buyers picked it. Every buyer is free to choose what they buy, and every farmer is free to grow all they can and sell it. That freedom is the whole point of farming.",
      "explicitShift": 10,
      "conclusionPos": 80
    },
    {
      "id": "O-LIB-P",
      "crisis": "Overproduction",
      "persona": "Libertarian",
      "key": "LIB-P",
      "cardType": "Practical — efficiency (silent on standard)",
      "premiseType": "practical",
      "argument": "Too much of a crop sorts itself out. Prices drop, some farms switch to crops that are scarcer, and within two seasons the market balances. Farmers who'd rather not wait can join a group by choice, agree to grow less of the crowded crop, and get a better price for what they sell.",
      "explicitShift": 0,
      "conclusionPos": 40,
      "personaLabel": "Practical libertarian"
    },
    {
      "id": "O-LIB-M",
      "crisis": "Overproduction",
      "persona": "Libertarian",
      "key": "LIB-M",
      "cardType": "Moral — common good (explicit)",
      "premiseType": "moral_common_good",
      "argument": "A big harvest means cheap food, and cheap food helps the families in the valley with the least. So keep any deal voluntary. Farmers can team up if they want to, the rest keep growing, and food stays plentiful. That's what's best for everyone, and for the poorest most of all.",
      "explicitShift": -6,
      "conclusionPos": 40,
      "personaLabel": "Bleeding-heart libertarian"
    },
    {
      "id": "O-PRO-P",
      "crisis": "Overproduction",
      "persona": "Progressive",
      "key": "PRO-P",
      "cardType": "Practical — expertise",
      "premiseType": "practical",
      "argument": "The county farm office tracks how much of each crop the valley can sell. Planting limits based on its numbers keep supply steady, so prices stay at a level every farm can live on, year after year.",
      "explicitShift": 0,
      "conclusionPos": -40
    },
    {
      "id": "O-PRO-M",
      "crisis": "Overproduction",
      "persona": "Progressive",
      "key": "PRO-M",
      "cardType": "Moral — positive right",
      "premiseType": "moral_positive_right",
      "argument": "Every farm family has a right to a fair chance at selling its crops. Planting limits, set by the county farm office, keep room in the market for every farm. You can still farm as well as you like up to the limit, and your neighbors get their turn to sell too.",
      "explicitShift": -7,
      "conclusionPos": -40
    },
    {
      "id": "O-SOC",
      "crisis": "Overproduction",
      "persona": "Socialist",
      "key": "SOC",
      "cardType": "Moral — collective justice",
      "premiseType": "moral_collective",
      "argument": "The valley is strongest when every farm does well. What any farm grows beyond the valley average belongs to everyone. The council should ban the crop that's flooding the market and share out the extra, so all farms stand on equal footing and we all get ahead together.",
      "explicitShift": -10,
      "conclusionPos": -80
    }
  ],
  "strings": {
    "crisisHeading": "Crisis {n} of {total}: {title}",
    "facedBefore": "This has happened before. Last time the council chose: {policy}.",
    "farmHeading": "Your farm",
    "tilesRemaining": "Tiles left",
    "tilesTaken": "Taken by the council",
    "tilesSold": "Sold",
    "farmGone": "Your farm is gone. Every tile has been taken or sold. The council still meets, though, and its mood keeps shifting.",
    "standingHeading": "Rules you still have to follow",
    "standingNone": "None yet.",
    "noImmediate": "Nothing changes for you right now.",
    "handHeading": "What do you say to the council?",
    "handHint": "Pick the argument you agree with most.",
    "revealOpposition": "Someone else spoke up for more control:",
    "argumentType": "{persona} · {type}",
    "axisControl": "← more control",
    "axisFreedom": "more freedom →",
    "legendNow": "The shaded part shows the ideas the council is willing to think about right now. Anything outside it sounds too extreme to them. The dot shows where the council's mood is.",
    "legendBefore": "Shaded: what the council would think about before this debate. Dashed: where that is now.",
    "decidedBefore": "The council voted before its mood shifted.",
    "decidedAfter": "The council voted after its mood shifted.",
    "markerAsked": "▼ asked for",
    "markerPassed": "▲ passed",
    "legendAsked": "▼ Asked for: {policy}.",
    "legendPassed": "▲ Passed: {policy}.",
    "amountFreedom": "{n} {points} toward freedom",
    "amountControl": "{n} {points} toward control",
    "point": "point",
    "points": "points",
    "positionLean": "leans {amount}",
    "positionCenter": "is right in the middle",
    "premiseLabel": {
      "moral_rights": "Your rights",
      "practical": "What works",
      "moral_common_good": "What's best for everyone",
      "moral_positive_right": "People are owed a share",
      "moral_collective": "The group comes first"
    },
    "answer": {
      "moral_rights": "You stood up for your rights. You said it's yours to decide. The council heard both sides, and you won the point.",
      "practical": "You showed your plan would work. But you never said why it was right. So the only moral argument the council heard was the one for more control.",
      "moral_common_good": "You argued about what's best for everyone. That's the ground the case for more control stands on, and on that ground, it won.",
      "moral_positive_right": "You argued for more control yourself.",
      "moral_collective": "You argued for more control yourself."
    },
    "answerPast": {
      "moral_rights": "You stood up for your rights.",
      "practical": "You said your plan would work, but never said why it was right.",
      "moral_common_good": "You argued about what's best for everyone, and lost on that ground.",
      "moral_positive_right": "You argued for more control yourself.",
      "moral_collective": "You argued for more control yourself."
    },
    "oppositionAnswered": "The other side",
    "oppositionUnanswered": "The other side, with no one answering it,",
    "shiftMine": "Your argument moved the council {amount}.",
    "shiftMineNone": "Your argument didn't move the council either way.",
    "shiftOpp": "{oppLabel} moved it {amount}.",
    "shiftNet": "In the end, the council's mood moved {amount}. It now {position}.",
    "shiftNetNone": "In the end, the council's mood didn't move. It still {position}.",
    "proposalIn": "You asked for: {policy}. The council was open to it, so it passed.",
    "proposalOut": "You asked for: {policy}. The council thought that went too far. So it passed the closest thing it was willing to accept: {enacted}.",
    "lobbyIn": "The {lobby} asked for: {policy}. The council was open to it, so they got it.",
    "lobbyOut": "The {lobby} asked for: {policy}. The council thought that went too far. So it gave them the closest thing it would accept: {enacted}.",
    "centerLine": "The council's mood is closest to {policy}, so that's what passed.",
    "attribution": "The council stopped being open to {asked} back in crisis {k} ({title}). That's when you said: “{argument}” {tail}",
    "attributionStart": "The council hasn't been open to {asked} at any point this game.",
    "centerMoved": "The council's mood shifted over to {policy} in crisis {k} ({title}). That's when you said: “{argument}” {tail}",
    "centerHeld": "The council's mood has been closest to {policy} since crisis {k} ({title}). That's when you said: “{argument}” {tail}",
    "centerStart": "The council's mood has been closest to {policy} since the game started.",
    "immediateHeading": "What happens to you",
    "offerAccepted": "You took the deal.",
    "offerDeclined": "You said no to the deal.",
    "reportHeading": "How your game went",
    "reportTrajectory": "How the council's mood changed",
    "reportTrajectoryKey": "Each grey line is a policy. When the mood crosses a dashed line, the council starts leaning toward the next policy.",
    "reportYourRun": "Your game",
    "reportCounterfactual": "Same crises, standing up for your rights every time",
    "reportSideBySide": "Your game next to the rights-every-time game",
    "reportPassed": "Times the request passed as asked",
    "reportTaken": "Tiles taken by the council",
    "reportSold": "Tiles sold",
    "reportFinal": "Where the council's mood ended up",
    "rightsNeeded": "Rights arguments it would take to get the freer choices back",
    "rightsNeverEnough": "Never. A rights argument isn't strong enough to beat the other side.",
    "reportOffersNote": "In the rights-every-time game, every deal is accepted."
  }
};
