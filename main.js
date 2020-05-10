let hltb = require('howlongtobeat');
let hltbService = new hltb.HowLongToBeatService();
const ObjectsToCsv = require('objects-to-csv')

class GameInfo {
    constructor(name, timeToBeat) {
      this.name = name;
      this.timeToBeat = timeToBeat;
    }
}


function extractResults(results) {
    if (results !== undefined && results.length > 0) {
        return results[0].gameplayMain;
    }
    return null;
}

async function writeCSVResults(list) {
    const csv = new ObjectsToCsv(list);
    await csv.toDisk('./list.csv')
}

let listGames = "The Surge 2|Levelhead|Red Dead Redemption 2|Kona|HyperDot|DayZ|Overcooked! 2|Bleeding Edge|Yakuza Kiwami for Windows 10|Moving Out|MechWarrior 5: Mercenaries|The Long Dark|Gears Tactics - Windows 10|Streets of Rage 4|Deliver Us The Moon|Totally Reliable Delivery Service|Football Manager 2020|Journey to the Savage Planet|Deliver Us The Moon.|Wasteland 3 (Xbox One)|Wasteland 3 (PC)|Moving Out|ACE COMBAT™ 7: SKIES UNKNOWN|Yakuza Kiwami|Stranger Things 3: The Game|Gato Roboto|Gato Roboto|The Long Dark|Machinarium|Astrologaster|Alien: Isolation|MISTOVER|Alvastia Chronicles|NieR:Automata™ BECOME AS GODS Edition|Power Rangers: Battle for the Grid|Minecraft|NBA 2K20|Forza Horizon 4 Standard Edition|Rocket League®|Human Fall Flat|Rush: A DisneyPixar Adventure|Descenders|Farming Simulator 17|F1® 2018|MudRunner|Overcooked! 2|The LEGO® NINJAGO® Movie Video Game|Untitled Goose Game|ClusterTruck|LEGO Star Wars III|Ori and the Blind Forest: Definitive Edition|Super Lucky's Tale|Fishing Sim World®: Pro Tour|Train Sim World® 2020|Pikuniku|Hydro Thunder|Tracks - The Train Set Game|Banjo-Kazooie|Ashes Cricket|Death Squared|Fuzion Frenzy®|Ori and the Will of the Wisps|Zoo Tycoon: Ultimate Animal Collection|Supermarket Shriek|de Blob|ASTRONEER|Disneyland Adventures|Pandemic: The Board Game|#IDARB|Banjo-Tooie|Ticket to Ride|Viva Piñata|Giana Sisters: Twisted Dreams - Director's Cut|Riverbond|Viva Piñata: TIP|Creature in the Well|Jetpac Refuelled|Old Man's Journey|The Gardens Between|DOOM|Wolfenstein® II: The New Colossus™|Mega Man Legacy Collection 2|METAL GEAR SURVIVE|Black Desert|The Banner Saga|The Outer Worlds|Moonlighter|A Plague Tale: Innocence - Windows 10|Middle-earth™: Shadow of War™|The Bard's Tale IV: Director's Cut|Vambrace: Cold Soul|The Bard's Tale Trilogy|The Surge 2 - Windows 10|Kingdom Come: Deliverance|For The King|My Time At Portia|Children of Morta|Phoenix Point|FTL: Faster Than Light|Timespinner|Pillars of Eternity: Hero Edition|Death's Gambit|DEMON'S TILT|West of Loathing|Wasteland 2: Director's Cut for Windows 10|CrossCode|Battle Chasers: Nightwar|Oxenfree|Reigns: Game of Thrones|WORLD OF HORROR (Game Preview)|Wasteland Remastered|Torment: Tides of Numenera|The Banner Saga 3|Undertale|Unavowed|Pikuniku Win10|Train Sim World® 2020|Human Fall Flat|Wandersong|Faeria|Snake Pass|GRID 2|Tracks - The Train Set Game|ARK: Survival Evolved|Gears 5|Halo 5: Guardians|PLAYERUNKNOWN'S BATTLEGROUNDS|World War Z|Sniper Elite 4|theHunter: Call of the Wild|PAYDAY 2: CRIMEWAVE EDITION|SUPERHOT|Metro Exodus|Halo Wars 2: Standard Edition|My Friend Pedro|Fallout: New Vegas|Remnant: From the Ashes|RAGE 2|Enter The Gungeon|Gears of War 3|Wolfenstein: Youngblood|Gears of War: Ultimate Edition|Sunset Overdrive|Gears of War 4|Metro 2033 Redux|Gears of War 2|Metro: Last Light Redux|Gears of War|Shadow Warrior 2|Mutant Year Zero: Road to Eden|Mass Effect|Halo: Spartan Assault|Gears of War: Judgment|Void Bastards|Neon Chrome|EVERSPACE™|Perfect Dark Zero|GoNNER - BLüEBERRY EDiTION|Panzer Dragoon Orta|Age of Empires II: Definitive Edition|Age of Empires Definitive Edition|Halo Wars 2|Slay The Spire|Frostpunk|Rise of Nations: Extended Edition|Hearts of Iron IV: Cadet Edition|Stellaris|Worms W.M.D|Halo Wars: Definitive Edition (PC)|Europa Universalis IV - Microsoft Store Edition|Age of Wonders: Planetfall|Imperator: Rome|Wargroove|Bad North: Jotunn Edition|The Banner Saga|The Lord of the Rings: Adventure Card Game - Definitive Edition|Space Hulk: Tactics|Sea Salt|Dead by Daylight: Special Edition|Secret Neighbor|Hello Neighbor|Subnautica|Goat Simulator|Worms W.M.D|The Jackbox Party Pack 3|Dead Cells|Hollow Knight: Voidheart Edition|Totally Accurate Battle Simulator (Game Preview)|Lonely Mountains: Downhill|Oxenfree|Stellaris: Console Edition|For The King|Slay The Spire|Surviving Mars|My Time At Portia|Yooka-Laylee|Outer Wilds|Frostpunk: Console Edition|Wizard of Legend|Absolver|";
listGames += "The Flame in the Flood|The Gardens Between|The Jackbox Party Pack 3|The LEGO® NINJAGO® Movie Video Game|The Lord of the Rings: Adventure Card Game - Definitive Edition|The Outer Worlds|The Talos Principle|The Turing Test|The Walking Dead: A New Frontier - The Complete Season (Episodes 1-5)|The Walking Dead: Michonne - The Complete Season|The Walking Dead: Michonne - Ep. 2, Give No Shelter|The Walking Dead: Michonne - Ep. 3, What We Deserve|The Walking Dead: Season Two|The Walking Dead: The Complete First Season|The Witcher 3: Wild Hunt|theHunter: Call of the Wild|Ticket to Ride|Totally Accurate Battle Simulator (Game Preview)|Tracks - The Train Set Game|Train Sim World® 2020|Two Point Hospital™|Untitled Goose Game|Vambrace: Cold Soul|Viva Piñata|Viva Piñata: TIP|Void Bastards|Wandersong|Wargroove|Wasteland 2: Director's Cut|Wasteland Remastered|We Happy Few|Westerado: Double Barreled|What Remains of Edith Finch|Wizard of Legend|Wolfenstein: Youngblood|Wolfenstein® II: The New Colossus™|World War Z|Worms W.M.D|Yakuza 0|Yoku's Island Express|Yooka-Laylee|Zoo Tycoon: Ultimate Animal Collection";
//let listGames = "The Surge 2|Levelhead|Red Dead Redemption 2";
let inputGames = listGames.split("|");
let sortedListGames = [];

function sortOrder(a,b) {
    if (a.timeToBeat < b.timeToBeat) {
        return 1;
    } else if (a.timeToBeat > b.timeToBeat){
        return -1;
    }
    return (a.name > b.name);
}

function checkIfAllReceived() {
    if (listGamesInfo.length === inputGames.length) {
        //sortedListGames = listGamesInfo.sort((a, b) => (a.timeToBeat < b.timeToBeat) ? 1 : -1);
        sortedListGames = listGamesInfo.sort((a, b) =>  {
            if (a.timeToBeat < b.timeToBeat) { return 1;}
            else if (a.timeToBeat > b.timeToBeat){ return -1; }
            return (a.name > b.name);
        });
        for (let i = 0; i < sortedListGames.length; ++i) {
            let gameInfo = sortedListGames[i];
            console.log("· " + gameInfo.name + " ==>\t\t\t\t " + (gameInfo.timeToBeat !== null ? gameInfo.timeToBeat : "No results found"));
        }
        writeCSVResults(sortedListGames);
    }
}

let listGamesInfo = [];
inputGames.forEach(function(game) {
    let timeToBeat = null;
    hltbService.search(game).then(result => {
        let output = extractResults(result);
        timeToBeat = output;

        let gameInfo = new GameInfo(game, output);
        listGamesInfo.push(gameInfo);

        checkIfAllReceived();
    })
    .catch( error => {
        console.log(error);
        checkIfAllReceived();//Just in case
    });
});

//////// Script for getting data in: https://www.xbox.com/en-US/xbox-game-pass/games#
/*
    let listOutput = []; 
    let listGames = document.getElementsByClassName("c-heading x1GameName");
    for (let i = 0; i < listGames.length; ++i){
            let name = listGames[i].innerText;
            listOutput.push(name);
    };
    let allGamesString = listOutput.join("|");
    console.log(allGamesString);
*/