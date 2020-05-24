const INDEX_NAME = 0;
const INDEX_MAIN = 1;
const INDEX_MAIN_EXTRA = 2;
const INDEX_COMPLETIONIST = 3;
const INDEX_URL_IMAGE = 4;

// Removing the list of games where we don't have time information
function cleanIncompleteData(data) {
    debugger
    let gamesWithInfo = data;
    for (let i = 0; i < data.length; ++i) {
        if (Number(data[INDEX_MAIN]) > 0 || Number(data[INDEX_MAIN_EXTRA]) > 0 || Number(data[INDEX_COMPLETIONIST]) > 0 ) {
            gamesWithInfo.push(data[i]);
        } else {
            console.log("Game without info: " + data[0]);
        }
    }
    return gamesWithInfo;
}

function createD3Table() {
    var column_names = ["name","gameplayMain","gameplayMainExtra","gameplayCompletionist","imageUrl"];
    //var clicks = [title: 0, gameplayMain: 0, creatgameplayMainExtra: 0, gameplayCompletionist: 0};
    var clicks = [0,0,0,0];

    // draw the table   
    d3.select("body").append("div")
    .attr("id", "container")

    d3.select("#container").append("div")
    .attr("id", "FilterableTable");

    d3.select("#FilterableTable").append("div")
        .attr("class", "SearchBar")
        .append("p")
        .attr("class", "SearchBar")
        .text("Search By Title:");

    d3.select(".SearchBar")
        .append("input")
        .attr("class", "SearchBar")
        .attr("id", "search")
        .attr("type", "text")
        .attr("placeholder", "Search...");

    var table = d3.select("#FilterableTable")
                  .append("table")
                  .attr("class", "FilterableTable");

    table.append("thead")
          .append("tr"); 

    var headers = table.select("tr")
                    .selectAll("th")
                    .data(column_names)
                    .enter()
                    .append("th")
                    .attr("class", "tableHeader")
                    .text(function(d) { return d; }
    );

    var rows, row_entries, row_entries_no_anchor, row_entries_with_anchor;
    d3.text("./data/list.csv", function(response) {
        var data = d3.csv.parseRows(response);
        data.shift(); // Remove first row
        data = cleanIncompleteData(data);

        // draw table body with rows
        table.append("tbody")

        // data bind
        rows = table.select("tbody")
            .selectAll("tr")
            .data(data, function(d){ 
                return d; 
            })
        
        // enter the rows
        rows.enter()
            .append("tr")

        // enter td's in each row
    row_entries = rows.selectAll("td")
    .data(function(d, i) { 
        var arr = [];
        for (var k in d) {
            if (d.hasOwnProperty(k)) {
                arr.push(d[k]);
            }
        }
        return [arr[INDEX_NAME],arr[INDEX_MAIN],arr[INDEX_MAIN_EXTRA],arr[INDEX_COMPLETIONIST],arr[INDEX_URL_IMAGE]];
    })
    .enter()
    .append("td") 
    .each(function(d, i) {
        if (i > 0 && i % 4 === 0) {
                var imgData = [];
                imgData.push(d);
                d3.select(this).selectAll("img").data(imgData)
                .enter()
                .append("img") // doesn't append an <img> anywhere
                .attr("src", d)
                .attr("height", "40px")
                .attr("width", "30px");
        }
    })

// draw row entries with no anchor 
    row_entries_no_anchor = row_entries.filter(function(d) {
        return (/https?:\/\//.test(d) == false)
    })
    row_entries_no_anchor.text(function(d) { return d; })

// draw row entries with anchor
    row_entries_with_anchor = row_entries.filter(function(d) {
        return (/https?:\/\//.test(d) == true)  
    })
    row_entries_with_anchor
        .append("a")
        .attr("href", function(d) { return d; })
            .attr("target", "_blank")
            .text(function(d) { 
                //return d; 
                return null;
            })
        });

    /**  sort functionality **/
  headers
  .on("click", function(d) {
    let sortIndex = -1;
    switch (d) {
        case "name":
            sortIndex = 0;
        break;
        case "gameplayMain":
            sortIndex = INDEX_MAIN;
        break;
        case "gameplayMainExtra":
            sortIndex = INDEX_MAIN_EXTRA;
        break;
        case "gameplayCompletionist":
            sortIndex = INDEX_COMPLETIONIST;
        break;
        case "imageUrl":
            sortIndex = 4;
        break;
    }
    if (sortIndex > -1) {
        clicks[sortIndex] += 1;
    }
      
    if (sortIndex === 0) {
      // even number of clicks
      if (clicks[sortIndex] % 2 == 0) {
        // sort ascending: alphabetically
        rows.sort(function(a,b) { 
          if (a[INDEX_NAME].toUpperCase() < b[INDEX_NAME].toUpperCase()) { 
            return -1; 
          } else if (a[INDEX_NAME].toUpperCase() > b[INDEX_NAME].toUpperCase()) { 
            return 1; 
          } else {
            return 0;
          }
        });
      // odd number of clicks  
      } else if (clicks[sortIndex] % 2 != 0) { 
        // sort descending: alphabetically
        rows.sort(function(a,b) { 
          if (a[INDEX_NAME].toUpperCase() < b[INDEX_NAME].toUpperCase()) { 
            return 1; 
          } else if (a[INDEX_NAME].toUpperCase() > b[INDEX_NAME].toUpperCase()) { 
            return -1; 
          } else {
            return 0;
          }
        });
      }
    } else if (sortIndex > 0 && sortIndex < 5) {
        if (clicks[sortIndex] % 2 == 0) {
            // sort ascending: numerically
            rows.sort(function(a,b) { 
              if (Number(a[sortIndex]) < Number(b[sortIndex])) { 
                return -1; 
              } else if (Number(a[sortIndex]) > Number(b[sortIndex])) { 
                return 1; 
              } else {
                return 0;
              }
            });
          // odd number of clicks  
          } else if (clicks[sortIndex] % 2 != 0) { 
            // sort descending: numerically
            rows.sort(function(a,b) { 
              if (Number(a[sortIndex]) < Number(b[sortIndex])) { 
                return 1; 
              } else if (Number(a[sortIndex]) > Number(b[sortIndex])) { 
                return -1; 
              } else {
                return 0;
              }
            });
          }
    }
})
    
}

    /*var parsedCSV = d3.csv.parseRows(response);
    debugger
    d3.json("data.json", function(data) { // loading data from server
  
        // draw table body with rows
        table.append("tbody")
      
        // data bind
        rows = table.select("tbody").selectAll("tr")
          .data(data, function(d){ return d.id; });
        
        // enter the rows
        rows.enter()
          .append("tr")
        
        // enter td's in each row
        row_entries = rows.selectAll("td")
            .data(function(d) { 
              var arr = [];
              for (var k in d) {
                if (d.hasOwnProperty(k)) {
                  arr.push(d[k]);
                }
              }
              return [arr[3],arr[1],arr[2],arr[0]];
            })
          .enter()
            .append("td") 
      
        // draw row entries with no anchor 
        row_entries_no_anchor = row_entries.filter(function(d) {
          return (/https?:\/\//.test(d) == false)
        })
        row_entries_no_anchor.text(function(d) { return d; })
      
        // draw row entries with anchor
        row_entries_with_anchor = row_entries.filter(function(d) {
          return (/https?:\/\//.test(d) == true)  
        })
        row_entries_with_anchor
          .append("a")
          .attr("href", function(d) { return d; })
          .attr("target", "_blank")
        .text(function(d) { return d; })
    }*/


window.onload = function() {
    createD3Table();
};