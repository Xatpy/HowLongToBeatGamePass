function createD3Table() {

var column_names = ["name","gameplayMain","gameplayMainExtra","gameplayCompletionist","imageUrl"];
//var clicks = [title: 0, gameplayMain: 0, creatgameplayMainExtra: 0, gameplayCompletionist: 0};
var clicks = [0,0,0,0];

// draw the table   
d3.select("body").append("div")
  .attr("id", "container")

d3.select("#container").append("div")
  .attr("id", "FilterableTable");

d3.select("#FilterableTable").append("h1")
  .attr("id", "title")
  .text("My Youtube Channels")

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

var table = d3.select("#FilterableTable").append("table");
table.append("thead").append("tr"); 

var headers = table.select("tr")
                    .selectAll("th")
                    .data(column_names)
                    .enter()
                    .append("th")
                    .text(function(d) { return d; }
    );

var rows, row_entries, row_entries_no_anchor, row_entries_with_anchor;

    d3.text("./data/list.csv", function(response) {
        var data = d3.csv.parseRows(response);
        data.shift(); // Remove first row

        // draw table body with rows
        table.append("tbody")

        // data bind
        rows = table.select("tbody").selectAll("tr")
            .data(data, function(d){ 
                return d; 
            })
            
        
        // enter the rows
        rows.enter()
            .append("tr")
            /*.each(function(d, i) {
                debugger
            })*/

        // enter td's in each row
  row_entries = rows.selectAll("td")

  .data(function(d, i) { 
        var arr = [];
        for (var k in d) {
            if (d.hasOwnProperty(k)) {
                arr.push(d[k]);
            }
        }
        return [arr[0],arr[1],arr[2],arr[3]];
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
            sortIndex = 1;
        break;
        case "gameplayMainExtra":
            sortIndex = 2;
        break;
        case "gameplayCompletionist":
            sortIndex = 3;
        break;
        case "imageUrl":
            sortIndex = 4;
        break;
    }
    if (sortIndex > -1) {
        clicks[sortIndex] += 1;
    }
      
    debugger
    if (sortIndex === 0) {
      // even number of clicks
      if (clicks[sortIndex] % 2 == 0) {
        // sort ascending: alphabetically
        rows.sort(function(a,b) { 
            debugger
          if (a[0].toUpperCase() < b[0].toUpperCase()) { 
            return -1; 
          } else if (a[0].toUpperCase() > b[0].toUpperCase()) { 
            return 1; 
          } else {
            return 0;
          }
        });
      // odd number of clicks  
      } else if (clicks[sortIndex] % 2 != 0) { 
        // sort descending: alphabetically
        rows.sort(function(a,b) { 
          if (a[0].toUpperCase() < b[0].toUpperCase()) { 
            return 1; 
          } else if (a[0].toUpperCase() > b[0].toUpperCase()) { 
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
                debugger
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