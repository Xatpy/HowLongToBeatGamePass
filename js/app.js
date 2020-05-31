const INDEX_NAME = 0;
const INDEX_MAIN = 1;
const INDEX_MAIN_EXTRA = 2;
const INDEX_COMPLETIONIST = 3;
const INDEX_URL_IMAGE = 4;
const INDEX_ID = 5;

// Removing the list of games where we don't have time information
function cleanIncompleteData(data) {
    let gamesWithInfo = [];
    for (let i = 0; i < data.length; ++i) {
        if (Number(data[i][INDEX_MAIN]) > 0 || Number(data[i][INDEX_MAIN_EXTRA]) > 0 || Number(data[i][INDEX_COMPLETIONIST]) > 0 ) {
            gamesWithInfo.push(data[i]);
        } else {
            console.log("Game without info: " + data[i]);
        }
    }
    return gamesWithInfo;
}

function searchId(data, name) {
    for (let i = 0; i < data.length; ++i) {
        if (data[i][INDEX_NAME] === name) {
            return data[i][INDEX_ID];
        }
    }
    return -1;
}

function createD3Table() {
    var column_names = ["Name","Main","Main Extra","Completionist","Cover"];
    var clicks = [0,0,0,0];

    // draw the table   
    d3.select("#contentBody").append("div")
    .attr("id", "container")
    .attr("class", "container");

    d3.select("#container").append("div")
    .attr("id", "FilterableTable")
    .attr("class", "u-full-width");

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
            .attr("class", "cell");

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
                .attr("class", "zoom")
                .attr("height", "80px")
                .attr("width", "60px");
            }
        })

    // draw row entries with no anchor 
        row_entries_no_anchor = row_entries.filter(function(d) {
            return (/https?:\/\//.test(d) == false)
        })

        row_entries_no_anchor.each(function(d, i) {
            if (i === 0) {
                let idGame = searchId(data, d);
                d3.select(this)
                .append("a")
                .attr("href", "https://howlongtobeat.com/game?id=" + idGame)
                .attr("target", "_blank")
                .text(function(d) {return d});
            } else {
                d3.select(this).text(function(d) {return d;});
            }
        });

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


        /**  sort functionality **/
        headers
        .on("click", function(d) {
            let sortIndex = -1;
            switch (d) {
                case column_names[INDEX_NAME]:
                    sortIndex = INDEX_NAME;
                break;
                case column_names[INDEX_MAIN]:
                    sortIndex = INDEX_MAIN;
                break;
                case column_names[INDEX_MAIN_EXTRA]:
                    sortIndex = INDEX_MAIN_EXTRA;
                break;
                case column_names[INDEX_COMPLETIONIST]:
                    sortIndex = INDEX_COMPLETIONIST;
                break;
                case column_names[INDEX_URL_IMAGE]:
                    sortIndex = INDEX_URL_IMAGE;
                break;
            }
            if (sortIndex > -1) {
                clicks[sortIndex] += 1;
            }
            
        if (sortIndex === INDEX_NAME) {
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
        } else if (sortIndex > INDEX_NAME && sortIndex < INDEX_URL_IMAGE) {
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

        /**  search functionality **/
        d3.select("#search")
        .on("keyup", function() { // filter according to key pressed 
            var searched_data = data,
                text = this.value.trim();
            
            var searchResults = searched_data.map(function(r) {
                var regex = new RegExp("^" + text + ".*", "i");
                if (regex.test(r[INDEX_NAME])) { // if there are any results
                    return regex.exec(r[INDEX_NAME])[0]; // return them to searchResults
                } 
            })
            
            // filter blank entries from searchResults
            searchResults = searchResults.filter(function(r){ 
            return r != undefined;
            })
            
            // filter dataset with searchResults
            searched_data = searchResults.map(function(r) {
                return data.filter(function(p) {
                    return p[INDEX_NAME].indexOf(r) != -1;
                })
            })

            // flatten array 
            searched_data = [].concat.apply([], searched_data)
            
            // data bind with new data
            rows = table.select("tbody").selectAll("tr")
            .data(searched_data, function(d){ 
                return d;
            })
            
            // enter the rows
            rows.enter()
            .append("tr");
            
            // enter td's in each row
            row_entries = rows.selectAll("td")
                .data(function(d) { 
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
            row_entries_no_anchor.each(function(d, i) {
                if (i === 0) {
                    let idGame = searchId(data, d);
                    d3.select(this)
                    .append("a")
                    .attr("href", "https://howlongtobeat.com/game?id=" + idGame)
                    .attr("target", "_blank")
                    .text(function(d) {return d});
                } else {
                    d3.select(this).text(function(d) {return d;});
                }
            });

            // draw row entries with anchor
            row_entries_with_anchor = row_entries.filter(function(d) {
            return (/https?:\/\//.test(d) == true)  
            })
            row_entries_with_anchor
            .append("a")
            .attr("href", function(d) { return d; })
            .attr("target", "_blank")
            .text(function(d) { 
                return null;
                //return d;
            })
            
            // exit
            rows.exit().remove();
        })

    });
}

window.onload = function() {
    createD3Table();
};