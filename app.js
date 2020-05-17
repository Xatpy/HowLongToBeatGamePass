function createD3Table() {
    d3.text("./data/list.csv", function(response) {
    var parsedCSV = d3.csv.parseRows(response);

    var container = d3.select("#divTableResults")
        .append("table")
        .selectAll("tr")
            .data(parsedCSV).enter()
            .append("tr")
        .selectAll("td")
            .data(function(d) { return d; }).enter()
            .append("td")
            //.text(function(d) { debugger;return d; });
            .text(function(d, i) {
                if (i != 4 || d === "imageUrl") {
                    return d;
                }
            })
            .each(function(d, i) {
                if (i == 4 && d !== "imageUrl") {
                    var imgData = [];

                    imgData.push(d);
                    d3.select(this).selectAll("img")
                            .data(imgData)
                    .enter()
                    .append("img") // doesn't append an <img> anywhere
                    .attr("src", d)
                    .attr("height", "40px")
                    .attr("width", "30px");
                }
            })
    });
}

window.onload = function() {
    createD3Table();
};