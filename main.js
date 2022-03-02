let hltb = require('howlongtobeat');
let hltbService = new hltb.HowLongToBeatService();
const ObjectsToCsv = require('objects-to-csv');
const fs = require('fs')

class GameInfo {
    constructor(name, gameplayMain, gameplayMainExtra, gameplayCompletionist, imageUrl, id) {
        this.name = name;
        this.gameplayMain = gameplayMain;
        this.gameplayMainExtra = gameplayMainExtra;
        this.gameplayCompletionist = gameplayCompletionist;
        this.imageUrl = imageUrl;
        this.id = id;
    }
}

function extractResults(results) {
    if (results !== undefined && results.length > 0) {
        const first = results[0]; //Assuming the first option is the one that we'relooking for, more coincidence
        return new GameInfo(first.name, first.gameplayMain, first.gameplayMainExtra,
            first.gameplayCompletionist, first.imageUrl, first.id);;
    }
    return null;
}

async function checkFileToWrite() {
    if (fs.existsSync(OUTPUT_DATA_FILE)) {
        //file exists
        let datetime = new Date();
        datetime = datetime.toISOString().slice(0,10);
        let backupFile = './data/' + datetime + '.csv';
        fs.copyFile(OUTPUT_DATA_FILE, backupFile, (err) => {
            if (err) throw err;
        });
    }
}

async function writeCSVResults(list) {
    console.log("📝 Dumping results to a CSV file: " + list.length);
    console.log(list)
    let csv = new ObjectsToCsv(list);
    checkFileToWrite();
    await csv.toDisk(OUTPUT_DATA_FILE);
    console.log("✅ DONE! File written: ", OUTPUT_DATA_FILE);

}

// Sorting by: 1st gameplay main, 2nd extra, 3rd completionist; and after that, by name.
function sortList(listGamesInfo) {
    return listGamesInfo.sort((a, b) => {
        if (a.gameplayMain < b.gameplayMain) { return 1; }
        else if (a.gameplayMain > b.gameplayMain) { return -1; }
        if (a.gameplayMainExtra < b.gameplayMainExtra) { return 1; }
        else if (a.gameplayMainExtra > b.gameplayMainExtra) { return -1; }
        if (a.gameplayCompletionist < b.gameplayCompletionist) { return 1; }
        else if (a.gameplayCompletionist > b.gameplayCompletionist) { return -1; }
        return (a.name > b.name);
    });
}

function extractGamesWithoutInfo(listGames) {
    console.log("🔧 Extracting games without info");
    let listWithoutInfo = [];
    for (let i = 0; i < listGames.length; ++i) {
        const gameInfo = listGames[i];
        const hasInfo = gameInfo.gameplayMain !== null;
        //console.log("· " + gameInfo.name + " ==>\t\t\t\t " + (hasInfo ? gameInfo.gameplayMain : "No results found"));
        if (!hasInfo) {
            listWithoutInfo.push(gameInfo);
        }
    }
    return listWithoutInfo;
}

function removeSpecialCharacters(gameName) {
    let curatedName = gameName;
    listSpecialCharacters = ["™", "®", "#", "(PC)", "Xbox One", "for Windows 10", "Win10", "(Game Preview)", "Game Preview", "Standard Edition"];
    listSpecialCharacters.forEach((specialCharacter) => {
        curatedName = curatedName.replace(specialCharacter, "");
    });
    return curatedName;
}

function removeSuffixParts(gameName) {
    let curatedName = gameName;
    listSpecialCharacters = [":", "-"];
    listSpecialCharacters.forEach((specialCharacter) => {
        const indexOfSeparator = curatedName.indexOf(specialCharacter);
        if (indexOfSeparator > -1) {
            curatedName = curatedName.substring(0, indexOfSeparator);
        }
    });
    if (curatedName === "") {
        console.log("After removing suffix parts, the name would be empty. Reseting. So you should check this: " + gameName);
        curatedName = gameName;
    }
    return curatedName;
}

function removeDotsInTheEndOfString(gameName) {
    return gameName.replace(/\.+$/, "");
}

function curateRetryName(originalName) {
    let retryNewName = originalName;
    retryNewName = retryNewName.trimEnd();
    retryNewName = removeSpecialCharacters(retryNewName);
    retryNewName = removeSuffixParts(retryNewName);
    retryNewName = removeDotsInTheEndOfString(retryNewName);
    return retryNewName;
}

async function retryGamesWithoutInfo(listGamesWithoutInfo) {
    console.log("➰ Retrying games without info yet: " + listGamesWithoutInfo.length);
    for (let i = 0; i < listGamesWithoutInfo.length; ++i) {
        const originalName = listGamesWithoutInfo[i].name;
        let retryNewName = curateRetryName(originalName);
        if (originalName !== retryNewName) {
            callHLTBService(retryNewName, originalName);
        } /*else {
            console.log("This game name cannot be curated: " + retryNewName);
        }*/
    }
    gHaveRetried = true;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function callHLTBService(gameNameToSearch, originalName) {
    numberOfCalls++;
    //await sleep(500);
    console.log(`Calling HBTP ${gameNameToSearch}`);
    //await sleep(500);
    hltbService.search(gameNameToSearch).then(result => {
            numberOfReceptions++;
            //console.log("Resut" , result);
            addGameInfoFromResults(gameNameToSearch, result, originalName);
    })
    .catch(error => {
        numberOfErrors++;
        console.log(gameNameToSearch, "---> ",error);
    });
}

function getIndexOfGameInList(gameName) {
    for (let i = 0; i < listGamesInfo.length; ++i) {
        if (listGamesInfo[i].name === gameName) {
            return i;
        }
    }
    return -1;
}

function getIndexOfGameInList(gameName) {
    for (let i = 0; i < listGamesInfo.length; ++i) {
        if (listGamesInfo[i] === null) {
            debugger;
        }
        if (listGamesInfo[i].name === gameName) {
            return i;
        }
    }
    return -1;
}

async function addGameInfoFromResults(gameName, result, originalName) {
    let gameInfo = extractResults(result);
    if (gameInfo === null) {
        gameInfo = new GameInfo(gameName, null, null, null, null, null);
    }
    //let gameInfo = new GameInfo(gameName, receivedInfoFromGame);
    if (originalName === "") {
        //listGamesInfo.push(gameInfo);
        if (getIndexOfGameInList(gameName) === -1) {
            listGamesInfo.push(gameInfo);
        } else {
            console.log("DUPLICATED: " + gameName);
        }
    } else {
        let index = getIndexOfGameInList(originalName);
        if (index > 0) {
            listGamesInfo[index].gamePlayMain = gameInfo.gamePlayMain;
        }
    }
}

const listEmojisSecondsTime = ["🕛","🕐","🕑","🕒","🕓","🕔","🕕","🕖","🕗","🕘","🕙","🕚"];
function getEmojiForSecond(numberOfSeconds) {
    return listEmojisSecondsTime[numberOfSeconds % 12];
}

//----------------- Variables ----------------

let listGamesInfo = [];
let listGamesNames = "Skul: The Hero Slayer|FAR: Changing Tides|Telling Lies|Infernax|CrossfireX: Operation Catalyst|Hollow Knight: Voidheart Edition|Dreamscaper|Besiege Console (Game Preview)|Super Mega Baseball 3|Madden NFL 22 Xbox One|Madden NFL 22 Xbox Series X|S|Edge of Eternity|The Last Kids on Earth and the Staff of Doom|Contrast|ARK: Ultimate Survivor Edition|A Plague Tale: Innocence|A Way Out|AI: THE SOMNIUM FILES|Alan Wake's American Nightmare ®|Alice: Madness Returns|Alien: Isolation|Aliens: Fireteam Elite|Among Us|Anthem™|ANVIL : Vault Breaker (Game Preview)|Aragami 2|Archvale|Army of Two™|art of rally|Astria Ascending|ASTRONEER|Atomicrops|Back 4 Blood|Backbone|Banjo Kazooie: N n B|Banjo-Kazooie|Banjo-Tooie|Bassmaster® Fishing 2022|Batman™: Arkham Knight|Battlefield 1943™|Battlefield 3™|Battlefield 4|Battlefield Bad Company 2|Battlefield: Bad Company|Battlefield™ 1 Revolution|Battlefield™ Hardline|Battlefield™ V|Battletoads|Before We Leave|Bejeweled 2|Bejeweled 3|Ben 10: Power Trip|Black Desert|BLACK™|Bleeding Edge|BLiNX: The Time Sweeper|Bloodroots|Boyfriend Dungeon|Breathedge|Bridge Constructor Portal|Broken Age|Brütal Legend|Bug Fables: The Everlasting Sapling|Burnout™ Paradise Remastered|Carrion|Children of Morta|Cities: Skylines - Xbox One Edition|ClusterTruck|Conan Exiles|Costume Quest 2|Crackdown 3|Craftopia|Cricket 19|Crimson Skies®: High Road to Revenge™|Cris Tales|Crown Trick|Crysis|Crysis 2|Crysis® 3|Curse of the Dead Gods|Dandy Ace|Danganronpa: Trigger Happy Havoc Anniversary Edition|Dante's Inferno™|Dark Alliance|Darkest Dungeon®|Day of the Tentacle Remastered|DayZ|Dead by Daylight|Dead Cells|Dead Space™|Dead Space™ 2|Dead Space™ 3|Dead Space™ Ignition|Death's Door [Xbox]|DEEEER Simulator: Your Average Everyday Deer Game|Deep Rock Galactic|Descenders|Destroy All Humans!|Dicey Dungeons|DiRT 4|DIRT 5|Dirt Rally|DiRT Rally 2.0|Dishonored 2|Dishonored® Definitive Edition|Dishonored®: Death of the Outsider™|Disneyland Adventures|Dodgeball Academia|Donut County|DOOM|DOOM (1993)|DOOM 3|DOOM 64|DOOM Eternal Standard Edition|DOOM II (Classic)|Double Dragon Neon|Dragon Age: Origins|Dragon Age™ 2|Dragon Age™: Inquisition|DRAGON BALL FIGHTERZ|DRAGON QUEST BUILDERS 2|DRAGON QUEST® XI S: Echoes of an Elusive Age™ - Definitive Edition|EA SPORTS™ FIFA 20|EA SPORTS™ Rory McIlroy PGA TOUR®|EA SPORTS™ UFC® 3|Echo Generation|Elite Dangerous Standard Edition|Embr|Empire of Sin|Enter The Gungeon|Evil Genius 2: World Domination|Exo One|F1 2020|F1® 2019|Fable Anniversary|Fable II|Fable III|Fae Tactics|Fallout 3|Fallout 4|Fallout 76|Fallout: New Vegas|Farming Simulator 19|Fe|Feeding Frenzy|Feeding Frenzy 2|FIFA 21 Standard Edition Xbox One & Xbox Series X|S|FIFA 21 Xbox One|FIFA 21 Xbox Series X|S|FIGHT NIGHT CHAMPION|FINAL FANTASY X/X-2 HD Remaster|FINAL FANTASY XIII|FINAL FANTASY XIII-2|Firewatch|Flynn: Son of Crimson|Football Manager 2022 Xbox Edition|FOR HONOR™ Standard Edition|Forager|Forza Horizon 4 Standard Edition|Forza Horizon 5 Standard Edition|Frostpunk: Console Edition|Full Throttle Remastered|Fuzion Frenzy®|Gang Beasts|Gears 5 Game of the Year Edition|Gears of War|Gears of War 2|Gears of War 3|Gears of War 4|Gears of War: Judgment|Gears of War: Ultimate Edition|Gears Tactics|Generation Zero®|Genesis Noir|Goat Simulator|Going Under|Golf With Your Friends|Gorogoa|Grand Theft Auto: San Andreas – The Definitive Edition|GreedFall|GRID|Grim Fandango Remastered|Grounded - Game Preview|Hades|Halo 5: Guardians|Halo Infinite|Halo Infinite (Campaign)|Halo Wars 2|Halo Wars 2: Standard Edition|Halo Wars: Definitive Edition|Halo: Spartan Assault|Halo: The Master Chief Collection|Heavy Weapon|Hellblade: Senua's Sacrifice|HITMAN Trilogy|Human Fall Flat|I Am Fish|Immortal Realms: Vampire Wars|Injustice™ 2|Into the Pit|";
listGamesNames += "It Takes Two - Digital Version|Jetpac Refuelled|Joy Ride Turbo|Jurassic World Evolution|Just Cause 4: Reloaded|Kameo|Katamari Damacy REROLL|Kill It With Fire|Killer Instinct: Definitive Edition|Knockout City™|Lake|Last Stop|Lawn Mowing Simulator|Lemnis Gate|Lethal League Blaze|Library Of Ruina|LIMBO|Lonely Mountains: Downhill|Lost Words: Beyond the Page|LUMINES REMASTERED|Madden NFL 20|Madden NFL 21 Xbox One|Madden NFL 21 Xbox Series X|S|Maneater|Marvel's Avengers|Mass Effect|Mass Effect 2|Mass Effect™ 3|Mass Effect™ Legendary Edition|Mass Effect™: Andromeda|Max: The Curse of Brotherhood|MechWarrior 5: Mercenaries|Medal of Honor Airborne|Microsoft Flight Simulator: Standard Game of the Year Edition|Middle-earth™: Shadow of War™|Mighty Goose|Mind Scanners|Minecraft|Minecraft Dungeons|Mirror's Edge™|Mirror's Edge™ Catalyst|MLB® The Show™ 21 Xbox One|MLB® The Show™ 21 Xbox Series X | S|Monster Sanctuary|Monster Train|Moonglow Bay|Moonlighter|Mortal Kombat 11|Mortal Shell: Enhanced Edition|MotoGP™20|My Friend Pedro|My Time At Portia|Myst|Narita Boy|NBA LIVE 19|Need for Speed Rivals|Need for Speed™|Need for Speed™ Heat|Need for Speed™ Hot Pursuit Remastered|Need for Speed™ Payback|Neon Abyss|Neoverse|New Super Lucky's Tale|Next Space Rebels|NHL® 20|NHL® 21|NHL® 94 REWIND|NieR:Automata™ BECOME AS GODS Edition|No Man's Sky|Nobody Saves the World|Nongunz: Doppelganger Edition|Nuclear Throne|Oblivion|OCTOPATH TRAVELER|Olija|Omno|ONE PIECE: PIRATE WARRIORS 4|One Step From Eden|Ori and the Blind Forest: Definitive Edition|Ori and the Will of the Wisps|Outer Wilds|Outlast 2|OUTRIDERS|Overcooked! 2|PAW Patrol Mighty Pups Save Adventure Bay|PAYDAY 2: CRIMEWAVE EDITION|Peggle|Peggle 2|Perfect Dark|Perfect Dark Zero|Phoenix Point|PHOGS!|Pikuniku|Pillars of Eternity II: Deadfire - Ultimate Edition|Pillars of Eternity: Complete Edition|Plants vs. Zombies|Plants vs. Zombies Garden Warfare|Plants vs. Zombies: Battle for Neighborville™|Plants vs. Zombies™ Garden Warfare 2|Power Rangers: Battle for the Grid|Prey|Project Wingman|Psychonauts|Psychonauts 2|Pupperazzi|Quake|Quantum Break|Race with Ryan|RAGE|RAGE 2|Rain on Your Parade|Raji: An Ancient Epiс|Rare Replay|Recompile|Record of Lodoss War-Deedlit in Wonder Labyrinth-|ReCore|Remnant: From the Ashes|RESIDENT EVIL 7 biohazard|Ring of Pain|Rocket Arena|Rubber Bandits|Rush: A DisneyPixar Adventure|Ryse: Legendary Edition|Sable|SCARLET NEXUS|ScreamRide|Sea of Solitude|Sea of Thieves|Second Extinction™ (Game Preview)|Secret Neighbor|Serious Sam 4|Shadow Warrior 2|Signs of the Sojourner|Skate 3|skate.|SkateBIRD|Slay The Spire|Slime Rancher|Sniper Elite 4|SnowRunner|Space Warlord Organ Trading Simulator|Spelunky 2|Spiritfarer®: Farewell Edition|SSX|STAR WARS Jedi: Fallen Order™|STAR WARS™ Battlefront™|STAR WARS™ Battlefront™ II|STAR WARS™: Squadrons|Stardew Valley|State of Decay 2: Juggernaut Edition|State of Decay: Year-One|STEEP|Stellaris: Console Edition|Streets of Rage 4|Subnautica|Subnautica: Below Zero|Sunset Overdrive|Super Lucky's Tale|SUPERHOT: MIND CONTROL DELETE|Superliminal|Supraland|Surgeon Simulator 2|Taiko no Tatsujin: The Drum Master!|Tell Me Why: Chapters 1-3|Terraria|Tetris® Effect: Connected|The Anacrusis (Game Preview)|The Artful Escape|The Ascent|The Bard's Tale ARPG : Remastered and Resnarkled|The Bard's Tale IV: Director's Cut|The Bard's Tale Trilogy|The Catch: Carp & Coarse Fishing|The Elder Scrolls III: Morrowind|The Elder Scrolls V: Skyrim Special Edition|The Elder Scrolls® Online|The Evil Within|The Evil Within® 2|The Forgotten City|The Good Life|The Gunk|The Long Dark|The Outer Worlds|The Pedestrian|The Procession to Calvary|The Riftbreaker|The Sims™ 4|The Surge 2|The Walking Dead: A New Frontier - The Complete Season (Episodes 1-5)|The Walking Dead: Michonne - Ep. 2, Give No Shelter|The Walking Dead: Michonne - Ep. 3, What We Deserve|The Walking Dead: Michonne - The Complete Season|The Walking Dead: Season Two|The Walking Dead: The Complete First Season|The Wild at Heart|The Yakuza Remastered Collection|theHunter: Call of the Wild|Titanfall® 2|Tom Clancy’s Rainbow Six® Extraction|Tom Clancy's Rainbow Six® Siege Deluxe Edition|"
listGamesNames += "Torchlight III|Totally Accurate Battle Simulator|Totally Reliable Delivery Service|Townscaper|Trailmakers|Train Sim World® 2|TRANSFORMERS: BATTLEGROUNDS|Tropico 6|Twelve Minutes|Two Point Hospital™|UFC® 4|Undertale|Undungeon|Unpacking|Unravel|Unravel Two|UNSIGHTED|Visage|Viva Piñata|Viva Piñata: TIP|Warhammer 40,000: Battlesector|Wasteland 2: Director's Cut|Wasteland 3|Wasteland Remastered|We Happy Few|What Remains of Edith Finch|Windjammers 2|Wolfenstein: The New Order|Wolfenstein: The Old Blood|Wolfenstein: Youngblood|Wolfenstein® II: The New Colossus™|World War Z|Worms Rumble|Worms W.M.D|Wreckfest|Yakuza 3 Remastered|Yakuza 4 Remastered|Yakuza 5 Remastered|Yakuza 6: The Song of Life|Yakuza: Like a Dragon|Yes, Your Grace|Zombie Army 4: Dead War|Zoo Tycoon: Ultimate Animal Collection|Zuma|Zuma's Revenge!"

//let listGames = "The Surge 2|Levelhead|Red Dead Redemption 2";
let inputGamesNames = listGamesNames.split("|");
inputGamesNames = Array.from(new Set(inputGamesNames))

let numberOfCalls = 0;
let numberOfReceptions = 0;
let numberOfErrors = 0;
let gHaveRetried = false;

const MAX_TIME_RUNNING = 300;
let secondsTranscurred = 0;
let intervalId = setInterval(mainLoop, 10000);
let done = false;

const OUTPUT_DATA_FILE = './data/list.csv';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

async function foo() {
    for (let i = 0; i < inputGamesNames.length; ++i) {
        let gameName = inputGamesNames[i];
        //console.log("bbb ", gameName);
        gameName = cleanGameName(gameName)
        await delay(250) 
        callHLTBService(gameName, "");
    }
    /*inputGamesNames.forEach(function (gameName) {
        console.log("bbb ", gameName);
        gameName = cleanGameName(gameName)
        await delay(1000) 
        callHLTBService(gameName, "");
    });*/
}
foo();

//----------------- Program ----------------
console.log("👾 Getting games info 🎮");
/*inputGamesNames.forEach(function (gameName) {
    gameName = cleanGameName(gameName)
    //await delay(1000) 
    callHLTBService(gameName, "");
});*/

function cleanGameName(gameName) {
    const charactersToRemove = ['™', '®', "- Game Preview", "Standard Edition", "Game of the Year Edition"];
    charactersToRemove.forEach(c => gameName = gameName.replace(c, ''));
    return gameName;
}

function mainLoop() {
    let message = getEmojiForSecond(secondsTranscurred) + " Seconds: " + secondsTranscurred;
    message += "\t# of calls received/total: (" + numberOfReceptions + "/" + numberOfCalls + ")";
    console.log(message);

    if (numberOfCalls === numberOfReceptions + numberOfErrors) {
        listGamesInfo = sortList(listGamesInfo);
        if (!gHaveRetried) {
            let listGamesWithoutInfo = extractGamesWithoutInfo(listGamesInfo);
            retryGamesWithoutInfo(listGamesWithoutInfo);
        } else {
            writeCSVResults(listGamesInfo);
            done = true;
        }
    }

    ++secondsTranscurred;
    if (secondsTranscurred === MAX_TIME_RUNNING) {
        console.error("[ERROR] Aborting because max time exceeded");
        clearInterval(intervalId);
    }
    if (done) {
        clearInterval(intervalId);
    }
}



//////// Script for getting data in: https://www.xbox.com/en-US/xbox-game-pass/games#
/*
    let listOutput = [];
    let listGames = document.getElementsByClassName("c-subheading-4 x1GameName");
    for (let i = 0; i < listGames.length; ++i){
            let name = listGames[i].innerText;
            listOutput.push(name);
    };
    let allGamesString = listOutput.join("|");
    console.log(allGamesString);
*/
