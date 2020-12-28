var mapboxAccessToken = 'pk.eyJ1IjoiYnJveWhpbGwiLCJhIjoiY2sybDFsZWJqMDJlejNjcG1uMG1wMGp4eSJ9.j3oTx82k3zcOP7tjb72_7w';

var map = L.map('mapdiv-assets').setView([39.82, -96.35], 5);

L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=' + mapboxAccessToken, {
    attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a></strong>',
    tileSize: 512,
    maxZoom: 18,
    zoomOffset: -1,
    id: 'mapbox/light-v10'
}).addTo(map);

var markerOptions = {
    radius: 8,
    fillColor: "#5FBB46",
    color: "#5FBB46",
    weight: 2,
    opacity: 0.5,
    fillOpacity: 0.7
};

var stateStyle = {
    color: 'blank',
    weight: 2,
    opacity: 0.1,
    fill: true,
    fillOpacity: 0.7
};


var stateData = null, activeState = null;
var clusters = L.markerClusterGroup();
map.addLayer(clusters);
var mapBounds = null;

var activeTabId = "impact-areas";

var resolveId = function (prefix) {
    return "#" + prefix + "-" + activeTabId;
};

if ($(window).height() < $(window).width()) {
    $(resolveId("picholder")).height($("body").height());
}

var width = $(resolveId("mapholder")).width();
var height = width * .58;

var zoom = d3.zoom()
    .scaleExtent([1, 9])
    .on("zoom", zoomed);

var tooltip = d3.selectAll(".mapholder")
    .append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("z-index", "10")
    .style("opacity", "0");

var sources = d3.select(resolveId("vizholder")).append("div")
    .attr("class", "sources");

var dottip = d3.selectAll("#map-info")
    .append("div")
    .attr("class", "dottip")
    .style("z-index", "10");

d3.select(".dottip")
    .style("height", height + "px")
    .style("opacity", "0");

var color = d3.scaleQuantile().range(d3.schemeGreys[5]);

var projection = d3.geoAlbersUsa()
    .scale(width)
    .translate([width / 2, (height / 2) + 30]);

var path = d3.geoPath().projection(projection);

var svg = d3.selectAll(".mapdiv")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

svg.append('defs')
    .append('pattern')
    .attr('id', 'texture0')
    .attr('patternUnits', 'userSpaceOnUse')
    .attr("patternTransform", "rotate(45)")
    .attr('width', 2.5)
    .attr('height', 3)
    .append('path')
    .attr('class', 'stripeline')
    .attr('d', 'M 0 0 L 0 10');

svg.append('defs')
    .append('pattern')
    .attr('id', 'texture1')
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 6)
    .attr('height', 6)
    .append('path')
    .attr('class', 'stripeline')
    .attr('d', 'M 5 0 L 5 0');

var background = svg.append("rect")
    .attr("class", "background")
    .attr("width", width)
    .attr("height", height)
    .on("click", reset);

var wholemap = svg.append("g")
    .attr("class", "wholemap")
    .attr("transform", "translate(0, 0)");

var linearScale = d3.scaleLinear()
    .domain([0, 10])
    .rangeRound([0, width * .25]);

var timeScale = d3.scaleTime();

var key = svg.append("g")
    .attr("class", "key")
    .attr("transform", "translate(" + (width - 40 - linearScale.range()[1]) + ",30 )");

var keybg = key.append("rect")
    .attr("class", "keybg")
    .attr("width", linearScale.range()[1] + 20)
    .attr("height", 60)
    .attr("x", 0)
    .attr("transform", "translate(-10,-30)");

var keyrects = key.selectAll(".keyrect");

var keytext = key.append("text")
    .attr("class", "caption")
    .attr("x", linearScale.range()[1])
    .attr("y", -6)
    .attr("text-anchor", "end");

key.call(d3.axisBottom(linearScale)
    .tickSize(13)
    .tickFormat(function (x, i) {
        return i ? x : x;
    })
    .tickValues(color.domain()))
    .select(".domain")
    .remove();

var sliderholder = d3.select("#mapdiv-impact-areas").append("svg")
    .attr("width", width)
    .attr("height", height / 4 + 25)
    .attr("class", "sliderholder");

var formatDateIntoMonthYear = d3.timeFormat("%b %Y");
var formatDate = d3.timeFormat("%b %Y");
var parseDate = d3.timeParse("%b-%d-%Y");

var weekOfYear = d3.timeFormat("%U");

var active = d3.select(null);
var insert;
var rateById = d3.map();
var counties = null, districts = null, statefills = null;

let num_active_products = 0;
let num_inactive_products = 0;

queue()
    .defer(d3.json, "data/us-states.json")
    .defer(d3.json, "data/us-counties.json")
    .defer(d3.json, "data/us-115th-congress-members_mapshaped.json")
    .defer(d3.csv, "data/sepsis_deaths_county_1999-2016.csv")
    .defer(d3.csv, "data/ILI_StateDatabySeason57_culled.csv")
    .defer(d3.csv, "data/product-types.csv")
    .defer(d3.csv, "data/product-active.csv")   // added at Feb 11th 2020
    .defer(d3.csv, "data/impact-areas.csv")
    .defer(d3.csv, "data/technology-levels.csv")
    .defer(d3.csv, "data/countries.csv")
    .defer(d3.csv, "data/AcceleratorList_20180518.csv")
    .defer(d3.csv, "data/ProductList_20180913.csv")
    .await(render);


var numberWithCommas = function(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

var getScreenCoords = function(x, y, ctm) {
    return {x: ctm.e + x * ctm.a, y: ctm.f + y * ctm.d};
};

function makeCounters(data) {
    var totalFunding = 0.0;
    var totalCostShare = 0.0;

    data.forEach(function(d) {
        totalFunding += parseFloat(d.Funding);
        totalCostShare += parseFloat(d.CostShare);
    });

    var output = "<b><p>$" + numberWithCommas(totalFunding) + "</p>" + "<p>$" + numberWithCommas(totalCostShare) + "</p></b>";
    $('#fundingCounters').html(output);
}

var changeTab = function(e) {
    activeTabId = $(e.target).attr("href").substring(1);

    var selectedTab = $(e.target).text().trim();
    switch (selectedTab) {
        case "Impact Areas":
            d3.select("#sepsisselector").dispatch("click");
            break;
        case "Investments":
            d3.select("#accelselector").dispatch("click");
            break;
    }
};

function initializeSelectionList(listItems, dropDownId, defaultValue) {
    var menuList = listItems.map(function(item) {
        return {"id": item.id, "type": item.type, "name": item.name};
    });
    menuList.unshift({"id": 0, "type": defaultValue, "name": defaultValue});

    d3.select(dropDownId)
        .append("select")
        .attr("id", function() {
            return dropDownId.substring(1) + "-select"
        })
        .attr("class", "dropdown_portfolio")
        .selectAll("option")
        .data(menuList)
        .enter()
        .append("option")
        .attr("value", function(item) {
            return item.type
        })
        .attr("class", "dropdown_portfolio")
        .text(function(item) {
            return item.name;
        });

    d3.select(dropDownId).on('change', function() {
        var id = d3.select(this).select("select").attr("id");
        var value = d3.select(this).select("select").property("value");

        d3.selectAll(".gallery-drop-down")
            .each(function () {
                var selectionId = d3.select(this).select("select").attr("id");
                if (selectionId !== id) {
                    d3.select("#" + selectionId).property("selectedIndex", 0);
                } else {
                    updateGalleryUpgraded(value);
                }
            });
    });
}

/*
 * function name: calcActiveProduct
 * parameter: productList. it is list of products from productList.csv
 * return: productList updated value of "Active" field.
 * date: Feb 12th 2020
*/
function calcActiveProduct(productList) {
    const today = new Date();
    const todayNumber = (today.getFullYear() * 100 + today.getMonth() + 1) * 100 + today.getDate();   // 02/12/2020 => 20200212
    if (productList.length != 0) {
        productList.forEach(product => {
            const awardEndDate = getDateNumber(product.AwardEndDate);  //02/12/20 => 20200212
            if (todayNumber <= awardEndDate) {
                product.Active = "Y";
            } else {
                product.Active = "N";
            }
        });
    }
    return productList;
}

/*
 * function name: calcActiveInActiveProduct
 * parameter: productList. it is list of products from productList.csv
 * return: productList updated value of "Active" field.
 * date: Feb 13th 2020
 * update date: Oct 28th 2020
*/
function calcActiveInActiveProduct(productList) {
    let products = [];
    const today = new Date();
    const todayNumber = (today.getFullYear() * 100 + today.getMonth() + 1) * 100 + today.getDate();   // 02/12/2020 => 20200212
    if (productList.length != 0) {
        let activeProducts = [];
        let inactiveProducts = [];
        productList.forEach(product => {
            const awardEndDate = getDateNumber(product.AwardEndDate);  //02/12/20 => 20200212
            if (todayNumber <= awardEndDate) {
                product.Active = "Y";
                activeProducts.push(product);
            } else {
                inactiveProducts.push(product);
                product.Active = "N";
            }
        });
        num_active_products = activeProducts.length;
        num_inactive_products = inactiveProducts.length;
        products.push(activeProducts);
        products.push(inactiveProducts);
    }
    return products;
}

/*
 * function name: getDateNumber
 * parameter: date
 * return: number converted from date. exp: 02/12/20 => 20200212
 * date: Feb 13th 2020
*/
function getDateNumber(date) {
    let temp = date.split("/");
    if (temp[2].length == 2)
        return (Number("20" + temp[2]) * 100 + Number(temp[0])) * 100 + Number(temp[1]);
    return (Number(temp[2]) * 100 + Number(temp[0])) * 100 + Number(temp[1]);
}

// updated at Feb 11th 2020
function render(error, us, countyData, districtData, sepsis, flu, productTypes, productActive, impactAreas, technologyLevels, countries, acceleratorList, productList) {

    if (error) throw error;
    const acceleratorJson = csvToJson(acceleratorList)
    const productJson = csvToJson(productList)

    window.addEventListener("resize", redraw);
    $("a[data-toggle='tab']").on("shown.bs.tab", changeTab);

    makeCounters(productList);
    

    renderGalleryFilters(impactAreas, productTypes, productActive, technologyLevels, countries);   // updated at Feb 11th 2020

    var stateDefs = us.features;
    var districtDefs = districtData.features;
    var countyDefs = countyData.features;

    stateData = L.geoJSON(us, {
        style: stateStyle,
        onEachFeature: onEachFeature
    }).addTo(map);

    counties = wholemap.append("g")
        .attr("class", "counties")
        .selectAll("path")
        .data(countyDefs)
        .enter()
        .append("path")
        .attr("id", function(d) { return d.properties.County })
        .attr("d", path)

    districts = wholemap.append("g")
        .attr("class", "districts")
        .selectAll("path")
        .data(districtDefs)
        .enter()
        .append("path")
        .attr("d", path);

    statefills = wholemap.append("g")
        .attr("class", "states")
        .selectAll("path")
        .data(stateDefs)
        .enter().append("path")
        .attr("id", function(d) { return d.properties.name })
        .attr("d", path)
        .on("click", clicked)


    var stateList = stateDefs.map(function(d) {
        return d.properties.name;
    });
    stateList.unshift("Select a State");

    var dropDownClass = ".us-state-drop-down";
    d3.selectAll(dropDownClass)
        .append("select")
        .selectAll("option")
        .data(stateList)
        .enter()
        .append("option")
        .attr("value", function(d) { return d;} )
        .text(function(d) { return d;} );

    d3.selectAll(dropDownClass).on('change', function () {
        var selectedState = d3.select(this)
            .select("select")
            .property("value");

        statefills.filter(function(d) {
            return d.properties.name == selectedState;
        }).dispatch("click");

        if (activeState) {
            stateData.resetStyle(activeState);
        }

        activeState = stateData.getLayer(selectedState);
        if (activeState) {
            activeState.setStyle({
                opacity: 1
            });
            activeState.fire('click');
        }
    });

    flu.forEach(function(d) {
        d.WEEKEND = parseDate(d.WEEKEND);
    });

    function clickZoom(e, dotType) {
        map.setView(e.target.getLatLng(), 14);
        updateDotInformation(e.target.feature.properties, dotType);
    }

    function zoomToFeature(e) {
        map.fitBounds(e.target.getBounds());
    }

    function onEachFeature(feature, layer) {
        layer.on({
            click: zoomToFeature
        });
        layer._leaflet_id = layer.feature.properties.name;
    }

    var acceleratorData = L.geoJSON(acceleratorJson, {
        onEachFeature: function (feature, layer) {
            layer.bindTooltip(feature.properties.Name)
        },
        pointToLayer: function (feature, latlng) {
            var marker = L.circleMarker(latlng, markerOptions);
            marker.bindPopup(feature.properties.Name).on('click', function(e) {clickZoom(e, 'accelerators')} );
            return marker;
        }
    });

    var productData = L.geoJSON(productJson, {
        onEachFeature: function (feature, layer) {
            layer.bindTooltip(feature.properties.Name)
        },
        pointToLayer: function (feature, latlng) {
            var marker = L.circleMarker(latlng, markerOptions);
            marker.bindPopup(feature.properties.Name).on('click', function(e) {clickZoom(e, 'products')});
            return marker;
        }
    });

    d3.selectAll(".selector").on("click", function () {

        $(".spotLocations.rfis").hide(800);
        $(".districts").hide(800);

        d3.selectAll(".selector").classed("selected", false);
        d3.select(this).classed("selected", true);
        d3.selectAll(".us-state-drop-down > select")
            .each(function () {
                d3.select(this).property("selectedIndex", 0);
            });

        var category = d3.select(this).attr("id");
        if (category == "sepsisselector") {
            d3.select(resolveId("mapholder")).classed("flumap", false);
            d3.select(resolveId("mapholder")).classed("accelmap", false);
            $(".key, .sources").show(800);
            redraw();

            d3.select("#fluselector").classed("selected", false);
            $(".spotLocations").hide(800).remove(800);
            $(".dottip").hide();
            $(".sliderholder").hide();

            shademap(sepsis, "sepsis", "AgeAdjustedRate", "County");

        } else if (category == "fluselector") {
            d3.select(resolveId("mapholder")).classed("flumap", true);
            d3.select(resolveId("mapholder")).classed("accelmap", false);
            $(".key, .sources").show(800);
            redraw();

            d3.select("#sepsisselector").classed("selected", false);
            $(".spotLocations").hide(800).remove(800);
            $(".dottip").hide();
            $(".sliderholder").show();

            shademap(flu, "flu", "AcLevNum", "State");

        } else if (category == "accelselector" || category == "productselector") {
            redraw();
            svg.style("opacity", 0);
            dottip.html("");
            map.invalidateSize(true);

            clusters.clearLayers();
            switch (category) {
                case 'accelselector':
                    clusters.addLayer(acceleratorData);
                    mapBounds = [
                        [48.10, -125.18],
                        [26.04, -65.39]
                    ];
                    break;
                case 'productselector':
                    clusters.addLayer(productData);
                    mapBounds = [
                        [72.10, -164.46],
                        [6.04, 31.00]
                    ];
                    break;
            }

            map.fitBounds(mapBounds);
            $("#instructions").css("opacity", 0);
            $(".key, .sources").hide();
            d3.select(resolveId("mapholder")).classed("accelmap", true);

            $(".dottip").show();
            $(".sliderholder").hide();
            $(".slider").hide(800);
            // dottip.style("opacity", 0);
            //
            // d3.select(resolveId("picholder"))
            //     .style("height", $(resolveId("map-col")).height());
            //
            // d3.select(resolveId("picholder"))
            //     .transition()
            //     .duration(800)
            //     .style("opacity", 0)
            //     .on("end", function () {
            //         d3.select(resolveId("picholder")).style("background", "");
            //         d3.select(resolveId("map-col")).style("background", "");
            //     })
            //
            // statefills.transition()
            //     .duration(900)
            //     .ease(d3.easePolyOut)
            //     .style("fill-opacity", 0)
            //     .on("end", function () {
            //         statefills.style("fill", "none")
            //             .style("pointer-events", "none")
            //             .classed("poordata", false);
            //     });
            //
            wholemap.select(".counties")
                .transition()
                .duration(900)
                .ease(d3.easePolyOut)
                .style("opacity", 0)
                .on("end", function () {
                    counties.style("fill", "none")
                        .style("stroke-width", 0)
                        .style("pointer-events", "none")
                        .classed("poordata", false);
                });

            // if (category == "accelselector") {
            //     updatedots(acceleratorList, "accelerators");
            // } else {
            //     updatedots(productList, "products");
            // }
        } else if (category == "galleryselector") {
            alert('do something');
        } else {
            d3.select(resolveId("mapholder")).classed("flumap", false);
            d3.select(resolveId("mapholder")).classed("accelmap", false);
            $(".key, .sources").show(0);
            redraw();
        }
    });

    d3.selectAll(".reset_map").on("click", reset);
    wholemap.call(zoom);

    productList.sort(function(a, b) {
        return (d3.ascending(a.Name + a.ProductName, b.Name + b.ProductName));
    });

    productList.sort(function(a, b) {
        return (d3.descending(getDateNumber(a.AwardEndDate), getDateNumber(b.AwardEndDate)));
    });

    let products = calcActiveInActiveProduct(productList);  // added at Feb 12th 2020

    makeGalleryUpgrade(products);
}
//upgrade Date: Feb. 11
function renderGalleryFilters(impactAreas, productTypes, productActive, techLevels, countries) {   // updated at Feb 11th 2020
    initializeSelectionList(impactAreas, "#zoomdrop-impact-area-drop-down", "Select impact area");
    initializeSelectionList(productTypes, "#zoomdrop-product-type-drop-down", "Select product type");
    initializeSelectionList(techLevels, "#zoomdrop-technology-level-drop-down", "Select technology level");
    initializeSelectionList(countries, "#zoomdrop-country-level-drop-down", "Select country");
    initializeSelectionList(productActive, "#zoomdrop-product-drop-down", "Select Product Active/Inactive");   // added at Feb 11th 2020
    $('#zoomdrop-impact-area-drop-down').addClass('new-button');
    $('#zoomdrop-product-type-drop-down').addClass('new-button');
    $('#zoomdrop-technology-level-drop-down').addClass('new-button');
    $('#zoomdrop-country-level-drop-down').addClass('new-button');
    $('#zoomdrop-product-drop-down').addClass('new-button');
}

function updatedots(data, dottype) {

    data.forEach(function (d) {
        d.lat = +d.lat;
        d.lon = +d.lon;
        d.coords = [d.lon, d.lat];
    });

    var plotdata = data.filter(function(d) {
        if (d.Country != undefined) {
            return d.Country == "United States";
        } else {
            return d;
        }
    });

    var asides = data.filter(function(d) {
        if (d.Country != undefined) {
            return d.Country != "United States";
        } else {
            return '';
        }
    });

    var existingdots = wholemap.selectAll(".spotLocations");

    if (!existingdots.empty()) {
        existingdots.selectAll("circle")
            .transition()
            .duration(800)
            .ease(d3.easePolyOut)
            .attr("r", 0)
            .on("end", function () {
                d3.select(this.parentNode).remove();
            });
    }

    freshdots(plotdata, dottype, false);
    freshdots(asides, dottype, true);
}

function updateDotInformation(dotData, dotType) {
    var site = dotData.Website ? getProductDescription("Web",
        "<a href='" + dotData.Website + "' target='_blank' onclick='return confirmExit()'>" + dotData.Website + "</a>") : '';
    var contact = dotData.Contact ? getProductDescription("Contact",
        "<a href='mailto: " + dotData.Contact + "'>" + dotData.Contact + "</a>") : '';
    var tipImg = '', capes = '', address = '', powers = '';

    if (dotType === 'accelerators') {
        if (dotData.Capabilities) {
            String.prototype.replaceAll = function (find, replace) {
                return this.replace(new RegExp(find.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), replace);
            };

            capes = dotData.Capabilities.replaceAll("_", "<br/>•");
            $('#result').html(capes);

            capes = getProductDescription("Capabilities Summary",
                "<span class='capes'>" + capes.replace("<br/>", "") + "</span>");
        }

        address = dotData.Address ? dotData.Address : '';
        tipImg = dotData.logofile ? "<img src='assets/images/AccelLogos/" + dotData.logofile + "' alt='" + dotData.Name + "' />" : "";

        dottip.html("<div id='tipLogo'>" + tipImg + "</div>" +
                        "<div class='tipContainer'>" +
                        "<div class='tipFirst' id='tipLocation'><b>" + dotData.Name + "</b></div>" +
                        "<div class='tipBody'>" +
                        "<div class='tipfield'>" + address + "</div>" +
                        contact + site + capes + powers + "</div></div>");
    } else {
        var funding = dotData.Funding ? getProductDescription("Funding", "$" + numberWithCommas(dotData.Funding)) : '';
        var stage = dotData.Stage ? getProductDescription("Development", dotData.Stage) : '';
        var awardDate = dotData.AwardDate ? getProductDescription("Award Date", dotData.AwardDate) : '';
        var productName = dotData.ProductName ? getProductDescription("Product", dotData.ProductName) : '';
        var description = dotData.Description ? getProductDescription("Product Description",
            "<span class='capes'>" + dotData.Description + "</span>") : '';
        var disruption = dotData.Disruption ? getProductDescription("Disruptive Innovation",
            "<span class='capes'>" + dotData.Disruption + "</span>") : '';

        if (dotType === "products") {
            tipImg = dotData.logofile ? "<img src='assets/images/ProductLogos/" + dotData.logofile + "' alt='" + dotData.Name + "' />" : "";
        } else {
            tipImg = dotData.logofile ? "<img src='assets/images/TechLogos/" + dotData.logofile + "' alt='" + dotData.Name + "' />" : "";
        }

        dottip.html("<div id='tipLogo'>" + tipImg + "</div>" +
                        "<div class='tipContainer'>" +
                        "<div class='tipFirst' id='tipLocation'><b>" + dotData.Name + "</b></div>" +
                        "<div class='tipBody'>" +
                        "<div class='tipfield'></div>" +
                        contact + site + productName + funding + stage + awardDate + description + disruption +
                        "</div></div>");
    }

    if (dotData.logofile != undefined && dotData.logofile != "" && dotData.logobg == "y") {
        d3.select("#tipLogo").classed("shaded", true);
    } else {
        d3.select("#tipLogo").classed("shaded", false);
    }
    dottip.style("opacity", 1);
    dottip.style("z-index", 1000);    ///03-03
}

function freshdots(dotdata, dottype, isAsides) {
    var spotLocations = wholemap.append("g")
        .attr("class", function(d) {
            return "spotLocations " + dottype;
        }).raise();

    if (isAsides && dotdata.length > 0) {
        var internat_label = spotLocations.append("text")
            .attr("id", "internat_label")
            .text("International Products")
            .style("opacity", 0);

        internat_label.transition()
            .duration(800)
            .ease(d3.easePolyOut)
            .style("opacity", 1)
            .attr("x", width - 30)
            .attr("y", height * .9 - (dotdata.length * 20));
    }

    var circle = spotLocations.selectAll("circle")
        .data(dotdata)
        .enter()
        .append("circle")
        .attr("class", function(d) {
            var onmap = '';
            if (d.Country != undefined && d.Country == "United States") {
                onmap = "usa"
            } else if (d.Country != undefined && d.Country != "United States") {
                onmap = "international"
            }
            return "circle " + onmap + " " + dottype;
        })
        .attr("id", function(d) { return d.Name })
        .attr("cx", function(d) {
            if (d.Country == undefined || d.Country == "United States") {
                return projection(d.coords)[0];
            } else {
                return width - 30;
            }
        })
        .attr("cy", function (d, i) {
            if (d.Country == undefined || d.Country == "United States") {
                return projection(d.coords)[1];
            } else {
                return height * .9 - (i * 20);
            }
        })
        .attr("r", 0)
        .style("opacity", 1)
        .classed("stratum2", function(d) {
            return d.Stratum == 2;
        });

    circle.transition()
        .duration(1000)
        .delay(function(d, i) {return i * 50})
        .ease(d3.easePolyOut)
        .attr("r", 6);

    circle.each(function (d) {
        if (d.Country == "United States") {
            d.x = projection([d.lon, d.lat])[0];
            d.y = projection([d.lon, d.lat])[1];
        } else {
            d.x = d3.select(this).attr("cx");
            d.y = d3.select(this).attr("cy");
        }
    });

    circle.on("mouseenter", function (d) {
        // d3.event.stopPropagation();
        d3.select(this).raise();

        d3.select(this).transition()
            .ease(d3.easeBackOut)
            .duration(500)
            .attr("r", 8);

        var site = d.Website ? getProductDescription("Web",
            "<a href='" + d.Website + "' target='_blank' onclick='return confirmExit()'>" + d.Website + "</a>") : '';
        var contact = d.Contact ? getProductDescription("Contact",
            "<a href='mailto: " + d.Contact + "'>" + d.Contact + "</a>") : '';
        var tipImg = '', capes = '', address = '', powers = '';

        // get data for dotttip display
        if (dottype == "accelerators") {
            if (d.Capabilities) {
                String.prototype.replaceAll = function (find, replace) {
                    return this.replace(new RegExp(find.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), replace);
                };

                capes = d.Capabilities.replaceAll("_", "<br/>•");
                $('#result').html(capes);

                capes = getProductDescription("Capabilities Summary",
                    "<span class='capes'>" + capes.replace("<br/>", "") + "</span>");
            } else {
                capes = ''
            }

            address = d.Address ? d.Address : '';
            tipImg = d.logofile ? "<img src='assets/images/AccelLogos/" + d.logofile + "' alt='" + d.Name + "' />" : "";

        } else if (dottype == "products" || dottype == "technologies") {

            var funding = d.Funding ? getProductDescription("Funding", "$" + numberWithCommas(d.Funding)) : '';
            var stage = d.Stage ? getProductDescription("Development", d.Stage) : '';
            var awardDate = d.AwardDate ? getProductDescription("Award Date", d.AwardDate) : '';
            var productName = d.ProductName ? getProductDescription("Product", d.ProductName) : '';
            var description = d.Description ? getProductDescription("Product Description",
                "<span class='capes'>" + d.Description + "</span>") : '';
            var disruption = d.Disruption ? getProductDescription("Disruptive Innovation",
                "<span class='capes'>" + d.Disruption + "</span>") : '';

            if (dottype == "products") {
                tipImg = d.logofile ? "<img src='assets/images/ProductLogos/" + d.logofile + "' alt='" + d.Name + "' />" : "";
            } else if (dottype == "technologies") {
                tipImg = d.logofile ? "<img src='assets/images/TechLogos/" + d.logofile + "' alt='" + d.Name + "' />" : "";
            }
        }

        dottip.transition()
            .ease(d3.easePolyOut)
            .duration(400)
            .style("opacity", 0)
            .on("end", function () {
                if (dottype == "accelerators") {
                    dottip.html("<div id='tipLogo'>" + tipImg + "</div>" +
                        "<div class='tipContainer'>" +
                        "<div class='tipFirst' id='tipLocation'><b>" + d.Name + "</b></div>" +
                            "<div class='tipBody'>" +
                                "<div class='tipfield'>" + address + "</div>" +
                                 contact + site + capes + powers + "</div></div>");
                } else if (dottype == "products" || dottype == "technologies") {
                    dottip.html("<div id='tipLogo'>" + tipImg + "</div>" +
                        "<div class='tipContainer'>" +
                        "<div class='tipFirst' id='tipLocation'><b>" + d.Name + "</b></div>" +
                            "<div class='tipBody'>" +
                                "<div class='tipfield'></div>" +
                                contact + site + productName + funding + stage + awardDate + description + disruption +
                             "</div></div>");
                }

                if (d.logofile != undefined && d.logofile != "" && d.logobg == "y") {
                    d3.select("#tipLogo").classed("shaded", true);
                } else {
                    d3.select("#tipLogo").classed("shaded", false);
                }

                dottip.transition()
                    .ease(d3.easePolyOut)
                    .duration(500)
                    .style("opacity", 1)
                    .style("z-index", 1000);     // 03-03
            });

        var lat = d.y;
        var lon = d.x;

        spotLocations.selectAll(".tipline").classed("active", false);
        var pointerline = spotLocations.append("line")
            .attr("class", "tipline")
            .classed("active", true)
            .lower();

        pointerline.attr("x1", lon + 4)
            .attr("y1", lat)
            .attr("x2", lon)
            .attr("y2", lat)
            .transition()
            .ease(d3.easePolyOut)
            .duration(900)
            .attr("x2", width)

    }).on("mouseleave", function (d) {
        // d3.event.stopPropagation();
        var lon = d.x;
        d3.select(this).transition()
            .duration(500)
            .ease(d3.easePolyOut)
            .attr("r", 4);

        d3.select(this).lower();

        var active = spotLocations.selectAll(".tipline");
        active.transition()
            .ease(d3.easePolyOut)
            .duration(1500)
            .attr("x2", lon + 4)
            .on("end",function() { active.remove() } )

    }).on("click", dotclicked)
}

function shademap(shadedata, stringlabel, shadevar, shadearea) {
    reset();
    dottip.style("opacity", 0);

    if (!d3.select(".slider").empty()) {
        d3.select(".slider")
            .transition()
            .duration(800)
            .ease(d3.easePolyOut)
            .style("opacity", 0)
            .on("end", function () {
                d3.select(this).remove()
            });
    }

    color.domain(d3.extent(shadedata.map(function(d) { return +d[shadevar] } )));
    linearScale.domain([
        d3.min(shadedata, function(d) { return +d[shadevar] }),
        d3.max(shadedata, function(d) { return +d[shadevar] })
    ]);

    keyrects = key.selectAll(".keyrect")
        .data(color.range())
        .enter()
        .append("rect")
        .attr("class", "keyrect")
        .merge(keyrects);

    keyrects = d3.selectAll(".keyrect");

    keyrects.data(color.range().map(function(d) {
        d = color.invertExtent(d);
        if (d[0] == null) d[0] = linearScale.domain()[0];
        if (d[1] == null) d[1] = linearScale.domain()[1];
        return d;
    }))
        .attr("height", 8)
        .attr("x", function(d) { return linearScale(d[0])})
        .attr("width", function(d) { return linearScale(d[1]) - linearScale(d[0]) })
        .attr("fill", function(d) { return color(d[0]) });

    var tickvals = color.range().map(function(d) {
        d = color.invertExtent(d);
        if (d[0] == null) d[0] = linearScale.domain()[0];
        if (d[1] == null) d[1] = linearScale.domain()[1];
        return d[1].toFixed(0);
    });

    tickvals.unshift(color.domain()[0].toFixed(0));

    key.call(d3.axisBottom(linearScale)
        .tickSize(13)
        .tickFormat(function(x, i) { return x; })
        .tickValues(tickvals)
    ).select(".domain")
        .remove();

    var keyLabel = "";

    if (stringlabel == "sepsis") {
        keyLabel = "septecimia death rate per 100,000";
        $("#instructions").html("<h3>Sepsis Deaths by County 1999-2016 </h3>").css("opacity", 1);

        d3.select(resolveId("picholder"))
            .transition()
            .duration(800)
            .style("opacity", 0)
            .on("end", function() {
                d3.select(resolveId("picholder"))
                    .transition()
                    .duration(800)
                    .style("opacity", .1)
                    .style("background-size", "cover")
                    .style("height", $(resolveId("map-col")).height());

                d3.select(resolveId("map-col"))
                    .style("background", "url(assets/images/e_coli.jpg)");
            });

        shadedata.forEach(function(d) {
            var string = d[shadevar], substring = "(Unreliable)";

            if (string.indexOf(substring) !== -1) {
                rateById.set(d.CountyCode, "na");
            } else {
                rateById.set(d.CountyCode, parseFloat(d[shadevar]));
            }
        });

        countyShade(stringlabel, shadedata);

        sources.html("¹The number of deaths per 100,000 total population. Source: https://wonder.cdc.gov<br/>Image Courtesy: National Institute of Allergy and Infectious Diseases</br><a href='data/sepsis_deaths_county_1999-2016.csv'>Download sepsis by county data displayed on this map</a>")
        $(resolveId("picholder")).height($("body").height());

    } else if (stringlabel == "flu") {

        keyLabel = "CDC Influenza-Like Illness (ILI) Activity Level Indicator";
        $("#instructions").html("<h3>2017-18 Influenza Season</h3> press play on timeline below to animate").css("opacity", 1);

        d3.select(resolveId("picholder"))
            .transition()
            .duration(800)
            .style("opacity", 0)
            .on("end", function() {
                d3.select(resolveId("picholder"))
                    .transition()
                    .duration(800)
                    .style("opacity", .1)
                    .style("background-size", "cover")
                    .style("height", $(resolveId("map-col")).height());

                d3.select(resolveId("map-col"))
                    .style("background", "url(assets/images/flu_small_faded.jpg)");
            });

        var currentweekdata = shadedata.filter(function(d) {
            return parseInt(d.WEEK) == 40;
        });

        currentweekdata.forEach(function(d) {
            var string = d[shadevar], substring = "NA";

            if (string.indexOf(substring) !== -1) {
                rateById.set(d.State, "na");
            } else {
                rateById.set(d.State, parseFloat(d[shadevar]));
            }
        });

        var timespan = d3.extent(shadedata.map(function(d) { return d.WEEKEND }));
        var allweeks = d3.scaleOrdinal().domain(shadedata.map(function(d) { return d.WEEK }));

        var moving = false;
        var currentValue = 0;
        var targetValue = width / 2;

        timeScale.domain(timespan)
            .range([0, targetValue])
            .clamp(true)
            .nice();

        var slider = sliderholder.append("g")
            .attr("class", "slider")
            .attr("transform", "translate(" + (width / 4) + "," + 50 + ")");

        var playButton = slider.append("g")
            .attr("id", "play-button")
            .attr("transform", "translate(" + (-60) + "," + -20 + ") scale(1.6)")
            .raise();

        playButton.append("path")
            .attr("class", "bg")
            .attr("d", "M0 0h24v24H0z");

        var playstatus = playButton.append("path")
            .attr("class", "playstatus")
            .attr("d", "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z");

        playButton.append("text")
            .attr("dx", 4)
            .attr("dy", 4)
            // .text("▶");
            .text("play")
            .style("display", "none");

        playButton.raise();

        slider.append("line")
            .attr("class", "track")
            .attr("x1", timeScale.range()[0])
            .attr("x2", timeScale.range()[1])
            .select(function () {
                return this.parentNode.appendChild(this.cloneNode(true));
            })
            .attr("class", "track-inset")
            .select(function () {
                return this.parentNode.appendChild(this.cloneNode(true));
            })
            .attr("class", "track-overlay")
            .call(d3.drag()
                .on("start.interrupt", function () {
                    slider.interrupt();
                })
                .on("start drag", function () {
                    currentValue = d3.event.x;
                    update(timeScale.invert(currentValue));
                })
            );

        insert = slider.insert("g", ".track-overlay")
            .attr("class", "ticks")
            .attr("transform", "translate(0," + 2 + ")");

        insert.call(d3.axisBottom(timeScale)
            .ticks(d3.timeWeek, 1)
            .tickSize(13)
            .tickFormat(function(d) {
                return parseInt(weekOfYear(d)) % 52 + 1
            }));

        insert.append("text")
            .attr("id", "axislabel")
            .text("2017-18 Influenza Season Week")
            .attr("x", targetValue / 2)
            .attr("y", 50)

        var handle = slider.insert("circle", ".track-overlay")
            .attr("class", "handle")
            .attr("r", 5)

        var label = slider.append("text")
            .attr("class", "label")
            .attr("text-anchor", "middle")
            .text(formatDate(timespan[0]))
            .attr("transform", "translate(0," + (-25) + ")")

        wholemap.select(".track-overlay").raise();


        playButton.on("click", function () {
            var button = d3.select(this);
            if (button.select("text").text() == "pause") {
                moving = false;
                clearInterval(timer);
                button.select("text").text("play");
                playstatus.attr("d", "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z");
            } else {
                moving = true;
                timer = setInterval(step, 500);
                button.select("text").text("pause")
                playstatus.attr("d", "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z");
            }
        });

        function step() {
            update(timeScale.invert(currentValue));

            currentValue = currentValue + (targetValue / allweeks.domain().length);
            if (currentValue > targetValue) {
                moving = false;
                currentValue = 0;
                clearInterval(timer);
                playButton.select("text").text("▶");
                playButton.dispatch("click");
            }
        }

        function update(h) {
            handle.attr("cx", timeScale(h));
            label.attr("x", timeScale(h)).text(formatDate(h));

            var epiweek = weekOfYear(h);
            var currentweek = parseInt(epiweek) + 1;

            if (currentweek > 17 && currentweek < 40) {
                currentweek = 17;
            }

            var newData = shadedata.filter(function(d) {
                return parseInt(d.WEEK) == currentweek;
            });

            newData.forEach(function(d) {
                var string = d[shadevar], substring = "NA";

                if (string.indexOf(substring) !== -1) {
                    rateById.set(d.State, "na");
                } else {
                    rateById.set(d.State, parseFloat(d[shadevar]));
                }
            });

            stateShade(stringlabel, shadedata);
        }

        stateShade(stringlabel, shadedata);

        sources.html("Source: https://gis.cdc.gov/grasp/fluview/main.html#</br><a href='data/ILI_StateDatabySeason57_culled.csv'>Download influenza-like-illness season data displayed on this map</a>");
        $(resolveId("picholder")).height($("body").height());
    }

    keytext.text(keyLabel)
        .attr("x", linearScale.range()[1])
        .attr("text-anchor", "end");
}

function countyShade(stringlabel, sepsis) {
    wholemap.select(".counties").style("opacity", 1);

    statefills.transition()
        .duration(900)
        .ease(d3.easeBackOut)
        .style("fill-opacity", 0)
        .style("stroke-width", 1)
        .on("end", function() {
            statefills.style("fill", "none")
                .style("pointer-events", "none")
                .classed("poordata", false);
        });

    counties.attr("class", function(d) {
        if (!isNaN(rateById.get(d.id))) {
            return "county";
        } else {
            return "county poordata";
        }
    })
        .transition()
        .duration(600)
        .style("fill", function (d) {
            if (stringlabel == "sepsis") {
                if (d3.select(this).classed("poordata") == true) {
                    return 'url(#texture0)';
                } else if (!isNaN(rateById.get(d.id))) {
                    return color(rateById.get(d.id));
                } else {
                    return '';
                }
            } else {
                return "none";
            }
        })
        .style("pointer-events", "all");

    counties.on("mouseenter", function (d) {
        var thiscounty = d.id;
        var thisdata = sepsis.filter(function(v) {return v.CountyCode == thiscounty});
        var thispath = d3.select(this).raise();

        if (!thispath.classed("active")) {
            thispath.transition()
                .duration(200)
                .ease(d3.easePolyOut)
                .style("stroke-width", 1);
        }

        tooltip.html("<div id='tipContainer'><div class='tipfirst'><b>" + thisdata[0].County + "</b></div>" +
            "<div id='tipKey'>Death rate per 100,000 persons (age adjusted): <b>" + thisdata[0].AgeAdjustedRate + "</b><br>" +
            "Deaths: <b>" + thisdata[0].Deaths + "</b><br>out of: <b>" + commaFormat(thisdata[0].Population) + " population</b></div>" +
            "<div class='tipClear'></div> </div>");

        tooltip.transition()
            .duration(400)
            .ease(d3.easePolyOut)
            .style("opacity", 1);

    }).on("mouseleave", function (d) {
        var thispath = d3.select(this);
        if (!thispath.classed("active")) {
            thispath.transition()
                .duration(200)
                .ease(d3.easePolyOut)
                .style("stroke-width", 0);
        }

        tooltip.transition()
            .duration(400)
            .ease(d3.easePolyOut)
            .style("opacity", 0);

    }).on("mousemove", function (d, v) {
        var myPos = d3.mouse(this);
        var myX = myPos[0], myY = myPos[1];

        var coords = getScreenCoords(myX, myY, this.getCTM());
        myX = coords.x;
        myY = coords.y;

        return tooltip.style("top", myY + -10 + "px").style("left", myX + 20 + "px");
    }).on("click", clicked);
}

function stateShade(stringlabel, shadedata) {

    statefills.style("fill-opacity", 1);
    wholemap.select(".states").style("fill-opacity", 1);

    wholemap.select(".counties").transition()
        .duration(900)
        .ease(d3.easeBackOut)
        .style("opacity", 0)
        .on("end", function () {
            counties.style("fill", "none")
                .style("stroke-width", 0)
                .style("pointer-events", "none")
                .classed("poordata", false);
        });

    statefills.attr("class", function(d) {
        if (!isNaN(rateById.get(d.properties.name))) {
            return "statefill";
        } else {
            return "statefill poordata";
        }
    }).transition()
        .duration(180)
        .style("fill", function (d) {
            if (stringlabel == "flu") {
                if (d3.select(this).classed("poordata")) {
                    return 'url(#texture0)';
                } else if (!isNaN(rateById.get(d.properties.name))) {
                    return color(rateById.get(d.properties.name));
                } else {
                    return '';
                }
            } else {
                return "none";
            }
        })
        .style("fill-opacity", function() {
            if (stringlabel == "flu") {
                return 1;
            }
        })
        .style("pointer-events", "all");

    statefills.on("mouseenter", function (d) {
        var thispath = d3.select(this).raise();
        if (!thispath.classed("active")) {
            thispath.transition()
                .duration(200)
                .ease(d3.easePolyOut)
                .style("stroke-width", 3);
        }
        tooltip.style("opacity", 1);
    }).on("mouseleave", function (d) {
        var thispath = d3.select(this);
        if (!thispath.classed("active")) {
            thispath.transition()
                .duration(200)
                .ease(d3.easePolyOut)
                .style("stroke-width", 1);
        }
        tooltip.style("opacity", 0);
    }).on("mousemove", function (d, v) {
        var thisstate = d.properties.name;
        var thisdata = shadedata.filter(function(v) {
            return v.State == thisstate && v.WEEK == 40;
        });

        var myPos = d3.mouse(this);
        var myX = myPos[0];
        var myY = myPos[1];

        var coords = getScreenCoords(myX, myY, this.getCTM());

        myX = coords.x;
        myY = coords.y;

        return tooltip.style("top", myY + -10 + "px")
            .style("left", myX + 20 + "px")
            .html("<div id='tipContainer'><div class='tipfirst' id='tipLocation'><b>" + thisstate + "</b></div>" +
                "<div id='tipKey'>Influenza-Like Illness (ILI) Activity Level: <b>" + thisdata[0].AcLevNum + "</b><br/>" +
                "<div id='tipKey'>Activity Level: <b>" + thisdata[0].ACTIVITY_LEVEL_LABEL + "</b><br/>" +
                "Week: <b>" + thisdata[0].WEEK + "</b></div><div class='tipClear'></div> </div>");
    })
}

function clicked(d) {
    if (active.node() === this) {
        reset();
        return;
    }

    active.classed("active", false);
    active = d3.select(this)
        .classed("active", true)
        .raise();

    d3.selectAll(".county")
        .each(function () {
            if (!d3.select(this).classed("active")) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .ease(d3.easePolyOut)
                    .style("stroke-width", 0);
            }
        });

    var bounds = path.bounds(d);
    var dx = bounds[1][0] - bounds[0][0];
    var dy = bounds[1][1] - bounds[0][1];
    var x = (bounds[0][0] + bounds[1][0]) / 2;
    var y = (bounds[0][1] + bounds[1][1]) / 2;
    var scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height)));
    var translate = [width / 2 - scale * x, height / 2 - scale * y];

    wholemap.transition()
        .ease(d3.easeQuadOut)
        .duration(1000)
        .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale))
}

function dotclicked(d) {
    console.log('CIRCLE CLICKED')
    if (active.node() === this) {
        reset();
        return;
    }

    active.classed("active", false);
    active = d3.select(this)
        .classed("active", true)
        .raise();

    var cx = d3.select(this).attr("cx");
    var cy = d3.select(this).attr("cy");
    var scale = Math.max(5, Math.min(8, 0.9 / Math.max(cx / width, cy / height)));
    var translate = [width / 2 - scale * cx, height / 2 - scale * cy];

    wholemap.transition()
        .ease(d3.easeQuadOut)
        .duration(1000)
        .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale))
}

function reset() {

    active.classed("active", false);
    active = d3.select(null);

    svg.select(".keybg").style("opacity", 0);
    d3.selectAll(".reset_map").classed("active", false);

    wholemap.transition()
        .ease(d3.easeQuadOut)
        .duration(1000)
        .call(zoom.transform, d3.zoomIdentity);

    if (activeState)
        stateData.resetStyle(activeState);

    if (map && mapBounds) {
        map.fitBounds(mapBounds);
    }

    dottip.html("");
    dottip.style("opacity", 0);

    d3.selectAll(".us-state-drop-down > select")
        .each(function () {
            d3.select(this).property("selectedIndex", 0);
        });
}

function zoomed() {
    var transk = d3.event.transform.k;
    wholemap.style("stroke-width", 1 / transk + "px")
        .attr("transform", d3.event.transform);

    if (transk == 1) {
        svg.select(".keybg").style("opacity", 0);
    } else {
        d3.selectAll(".reset_map").classed("active", true);
        svg.select(".keybg").style("opacity", .8);
    }
}

function redraw() {

    if ($(window).height() < $(window).width()) {
        $(resolveId("picholder")).height($(resolveId("map-col")).height());
    }

    width = $(resolveId("mapholder")).width();
    height = width * .58;

    svg.attr("width", width).attr("height", height);
    linearScale.rangeRound([0, width * .25]);

    projection.translate([width / 2, (height / 2) + 30])
        .scale([width]);

    wholemap.selectAll("path").attr("d", path);
    wholemap.selectAll(".circle")
        .attr("cx", function(d) {
            if (d.Country == undefined || d.Country == "United States") {
                return projection(d.coords)[0];
            } else {
                return width - 30;
            }
        })
        .attr("cy", function(d) {
            if (d.Country == undefined || d.Country == "United States") {
                return projection(d.coords)[1];
            } else {
                wholemap.selectAll(".international")
                    .each(function(d, i) {
                        return height * .9 - (i * 20);
                    });
            }
        });

    wholemap.selectAll(".circle.international")
        .attr("cx", width - 30)
        .attr("cy", function(d, i) {
            return height * .9 - (i * 20);
        });

    wholemap.selectAll(".circle")
        .each(function (d) {
            if (d.Country == "United States") {
                d.x = projection([d.lon, d.lat])[0];
                d.y = projection([d.lon, d.lat])[1];
            } else {
                d.x = d3.select(this).attr("cx");
                d.y = d3.select(this).attr("cy");
            }
        });

    wholemap.selectAll("#internat_label")
        .attr("x", width - 30)
        .attr("y", function() {
            var length = wholemap.selectAll(".circle.international")._groups[0].length;
            return height * .9 - (length * 20);
        })

    svg.style("opacity", 1);
    svg.select(".key")
        .attr("transform", "translate(" + (width - 40 - linearScale.range()[1]) + ", 30)");

    wholemap.call(zoom);
    wholemap.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity.translate(0, 0).scale(1));

    d3.select(".dottip").style("height", height + "px");
    d3.selectAll(".reset_map")
        .style("top", height - 30 + "px");

    if (d3.select(".sliderholder")) {
        d3.select(".sliderholder")
            .attr("width", width)
            .attr("height", height / 4 + 25);

        d3.select(".slider")
            .attr("transform", "translate(" + width / 4 + "," + 50 + ")");

        d3.select("#play-button")
            .attr("transform", "translate(" + (-60) + "," + -20 + ") scale(1.6)");

        var targetValue = width / 2;
        timeScale.range([0, targetValue]);

        d3.select(".slider").select(".track")
            .attr("x1", timeScale.range()[0])
            .attr("x2", timeScale.range()[1]);

        d3.select(".slider").select(".track-overlay")
            .attr("x1", timeScale.range()[0])
            .attr("x2", timeScale.range()[1]);

        d3.select(".slider").select(".track-inset")
            .attr("x1", timeScale.range()[0])
            .attr("x2", timeScale.range()[1]);

        if (insert != undefined) {
            insert.attr("transform", "translate(0," + 2 + ")");
            insert.call(d3.axisBottom(timeScale)
                .ticks(d3.timeWeek, 1)
                .tickSize(13)
                .tickFormat(function(d) { return parseInt(weekOfYear(d)) })
                .tickFormat(function(d) { return parseInt(weekOfYear(d)) % 52 + 1 }));
        }

        d3.select("#axislabel").attr("x", targetValue / 2);
        d3.select(".track-overlay").dispatch("start drag");
    }

    d3.selectAll(".reset_map").classed("active", false);
}


function makeGallery(data) {
    var output = "<div class='row equal'>";

    data.forEach(function(d) {
        var site = d.Website ? getInlineDescription("Web",
            "<a href='" + d.Website + "' target='_blank' onclick='return confirmExit()'> " + d.Website + "</a>") : '';
        var contact = d.Contact ? getInlineDescription("Contact",
            "<a href='mailto: " + d.Contact + "'>" + d.Contact + "</a>") : '';
        var funding = d.Funding ? getDescription("Funding", "$" + numberWithCommas(d.Funding)) : '';
        var stage = d.Stage ? getDescription("Development", d.Stage) : '';
        var awardDate = d.AwardDate ? getDescription("Award Date", d.AwardDate) : '';
        var productName = d.ProductName ? getDescription("Product", "<span style='color:#B36500; font-weight:bold;'>" + d.ProductName + "</span>") : '';
        var description = d.Description ? getDescription("Product Description", "<span class='capes'>" + d.Description + "</span>") : '';
        var disruption = d.Disruption ? getDescription("Disruptive Innovation", "<span class='capes'>" + d.Disruption + "</span>") : '';
        var location = getInlineDescription("Location", (d.City ? d.City + ", " : '') + (d.State ? d.State + ", " : '') + (d.Country ? d.Country : ''));
        var impactArea = d.ImpactArea ? getDescription("Impact Area", d.ImpactArea) : '';
        var costShare = d.CostShare ? getDescription("Cost Share", "$" + numberWithCommas(d.CostShare)) : '';
        var productType = d.ProductType ? getDescription("Deliverable Type", d.ProductType) : '';
        var tipImg = d.logofile ? "<img class='gallerylogos' src='assets/images/ProductLogos/" + d.logofile + "' width='100%' alt='" + d.Name + "' style='padding:20px;'/>" : "";

        String.prototype.replaceAll = function (find, replace) {
            return this.replace(new RegExp(find.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), replace);
        };

        var productTarget = escapeProductTarget(d.Name + d.ProductName).replaceAll(" ", "-");
        var classProductType = "product-type-" + d.ProductType.replaceAll(" ", "_").replace('/', '_');
        var classProductActive = "product-active-" + d.Active;
        var classCountry = "product-country-" + d.Country.replaceAll(" ", "_");
        var classImpactArea = "product-impact-area-" + d.ImpactArea.replaceAll(" ", "_");
        var classTRL = "product-TRL-" + d.Stage.replace(/^(TRL )?([^ ]+)/, '$2');

        // updated at Feb 11th 2020
        output = output +
            "<div class='col-xs-12 col-sm-4 col-md-3 col-lg-3 col-xl-3 productbox product-active-all " + classProductType + " " + classProductActive + " " + classCountry
				+ " " + classImpactArea + " " + classTRL + "' style='position: relative; vertical-align: middle;'>" +
				"<div class='product-content'>" +
					"<a data-toggle='modal' data-target='#" + productTarget + "' href='#' style='color:#000000;'>" +
					 	tipImg + "<p class='galleryproductname'>" + d.ProductName + "</p></div>" +
						"<p class='full-profile'>READ MORE</p></a></div>";

        // Modal section
        output = output +
            "<div class='modal fade' id='" + productTarget + "' role='dialog'>" +
				"<div class='modal-dialog modal-lg'>" +
					"<div class='modal-content' style='font-size: 20px;'>" +
						"<div class='modal-header'>" + tipImg + "</div>" +
						"<div class='modal-body'>" +
							"<div class='tipContainer'>" +
								"<div class='tipFirst'>" +
									"<p style='color:#EE6352; font-size:200%;'><b>" + d.Name + "</b></p>" +
								"</div>" +
								"<p>" + location + " " + site + " " + contact + "</p>" +
								"<p style='margin: 30px 0; border-bottom: 1px solid #e0e0e0; padding-bottom: 3px; padding-left: 10px;" +
                                    " font-size:150%; font-weight:bold; color:#B36500;'>" + d.ProductName + "</p>" +
								description + " " + productType + " " + disruption + " " + stage + " " + funding + " " + costShare + " " + awardDate +
							"</div></div>" +
						"<div class='modal-footer'>" +
							"<button type='button' class='btn btn-default' data-dismiss='modal'>Close</button>" +
						"</div></div></div></div>";
    });

	output = output + "</div>";

	$('#gallery-content').html(output);
}

// upgrade 02-13-2020
function makeGalleryUpgrade(data) {
    var output = "<div class='row equal'>";  //style='display: flex; justify-content: center;'
    data.map((item, index) => {
        if (index == 1) {
            output += "<div class='seperate col-11'></div>";
        }
        output += "<div class='col-11 productbox type " + (index == 0 ? "product-active-Y" : "product-active-N") + "'> <h2 class='type awards'>" + (index == 0 ? "Active Awards" : "Inactive Awards") + " </h2> </div>";
        if (item.length == 0) {
            output += "<div class=''><p class='no-data'>No data</p></div>";
        }
        item.forEach(function(d) {
            var site = d.Website ? getInlineDescription("Web",
                "<a href='" + d.Website + "' target='_blank' onclick='return confirmExit()'> " + d.Website + "</a>") : '';
            var contact = d.Contact ? getInlineDescription("Contact",
                "<a href='mailto: " + d.Contact + "'>" + d.Contact + "</a>") : '';
            var funding = d.Funding ? getDescription("Funding", "$" + numberWithCommas(d.Funding)) : '';
            var stage = d.Stage ? getDescription("Development", d.Stage) : '';
            var awardDate = d.AwardDate ? getDescription("Award Date", d.AwardDate) : '';
            var productName = d.ProductName ? getDescription("Product", "<span style='color:#B36500; font-weight:bold;'>" + d.ProductName + "</span>") : '';
            var description = d.Description ? getDescription("Product Description", "<span class='capes'>" + d.Description + "</span>") : '';
            var disruption = d.Disruption ? getDescription("Disruptive Innovation", "<span class='capes'>" + d.Disruption + "</span>") : '';
            var location = getInlineDescription("Location", (d.City ? d.City + ", " : '') + (d.State ? d.State + ", " : '') + (d.Country ? d.Country : ''));
            var impactArea = d.ImpactArea ? getDescription("Impact Area", d.ImpactArea) : '';
            var costShare = d.CostShare ? getDescription("Cost Share", "$" + numberWithCommas(d.CostShare)) : '';
            var productType = d.ProductType ? getDescription("Deliverable Type", d.ProductType) : '';
            var tipImg = d.logofile ? "<img class='gallerylogos' src='assets/images/ProductLogos/" + d.logofile + "' width='100%' alt='" + d.Name + "' style='padding:20px;'/>" : "";
    
            String.prototype.replaceAll = function (find, replace) {
                return this.replace(new RegExp(find.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), replace);
            };
    
            var productTarget = escapeProductTarget(d.Name + d.ProductName).replaceAll(" ", "-");
            var classProductType = "product-type-" + d.ProductType.replaceAll(" ", "_").replace('/', '_');
            var classProductActive = "product-active-" + d.Active;
            var classCountry = "product-country-" + d.Country.replaceAll(" ", "_");
            var classImpactArea = "product-impact-area-" + d.ImpactArea.replaceAll(" ", "_");
            var classTRL = "product-TRL-" + d.Stage.replace(/^(TRL )?([^ ]+)/, '$2');
    
            // updated at Feb 11th 2020
            output = output +
                "<div class='col-xs-12 col-sm-4 col-md-3 col-lg-3 col-xl-3 productbox product-active-all " + classProductType + " " + classProductActive + " " + classCountry
                    + " " + classImpactArea + " " + classTRL + "' style='position: relative; vertical-align: middle;'>" +
                    "<div class='product-content'>" +
                        "<a data-toggle='modal' data-target='#" + productTarget + "' href='#' style='color:#000000;'>" +
                             tipImg + "<p class='galleryproductname'>" + d.ProductName + "</p></div>" +
                            "<p class='full-profile'>READ MORE</p></a></div>";
    
            // Modal section
            output = output +
                "<div class='modal fade' id='" + productTarget + "' role='dialog'>" +
                    "<div class='modal-dialog modal-lg'>" +
                        "<div class='modal-content' style='font-size: 20px;'>" +
                            "<div class='modal-header'>" + tipImg + "</div>" +
                            "<div class='modal-body'>" +
                                "<div class='tipContainer'>" +
                                    "<div class='tipFirst'>" +
                                        "<p style='color:#EE6352; font-size:200%;'><b>" + d.Name + "</b></p>" +
                                    "</div>" +
                                    "<p>" + location + " " + site + " " + contact + "</p>" +
                                    "<p style='margin: 30px 0; border-bottom: 1px solid #e0e0e0; padding-bottom: 3px; padding-left: 10px;" +
                                        " font-size:150%; font-weight:bold; color:#B36500;'>" + d.ProductName + "</p>" +
                                    description + " " + productType + " " + disruption + " " + stage + " " + funding + " " + costShare + " " + awardDate +
                                "</div></div>" +
                            "<div class='modal-footer'>" +
                                "<button type='button' class='btn btn-default' data-dismiss='modal'>Close</button>" +
                            "</div></div></div></div>";
        });
    })

	output = output + "</div>";

	$('#gallery-content').html(output);
}

function getDescription(label, description) {
	return "<div class='tipfield'><p><span class='tiplabel' style='font-size: 20px'>" + label + ": </span>" +
				description + "</p></div>";
}

function getInlineDescription(label, description) {
	return "<div class='tipfield'><span class='tiplabel' style='font-size: 20px'>" + label + ": </span>" + description + "</div>";
}

function getProductDescription(label, description) {
    return "<div class='tipfield'><span class='tiplabel'>" + label + ": </span>" + description + "</div>";
}

function updateGallery(targetFilter) {
	if (targetFilter.indexOf("Select ") === 0) {
		showAllGalleryMembers();
	} else {
		$('.container').find('.productbox').each(function (index, element) {
			if ($(element).hasClass(targetFilter)) {
				$(element).show();
			} else {
				$(element).hide();
			}
		});
	}
}

// upgrade 02-13-2020
function updateGalleryUpgraded(targetFilter) {
	if (targetFilter.indexOf("Select ") === 0) {
        showAllGalleryMembers();
        $(".seperate").show();
	} else {
        let num_active_hidden = 0;
        let num_inactive_hidden = 0;
		$('.container').find('.productbox').each(function (index, element) {
			if ($(element).hasClass(targetFilter)) {
				$(element).show();
			} else {
                $(element).hide();
                if ($(element).hasClass("product-active-Y")) num_active_hidden++;
                if ($(element).hasClass("product-active-N")) num_inactive_hidden++;
            }
        });        
        if (targetFilter.indexOf("product-active") !== 0) {
            $(".type.productbox").show();
            $(".seperate").show();
        } else {
            $(".seperate").hide();
        }
        if (num_active_hidden == (num_active_products + 1)) {
            $(".type.productbox.product-active-Y").hide();
            $(".seperate").hide();
        }
        if (num_inactive_hidden == (num_inactive_products + 1)) {
            $(".type.productbox.product-active-N").hide();
            $(".seperate").hide();
        }
	}
}

function showAllGalleryMembers() {
	d3.selectAll(".gallery-drop-down")
		.each(function() {
			var selectionId = d3.select(this).select("select").attr("id");
			d3.select("#" + selectionId).property("selectedIndex", 0);
		});

	d3.selectAll(".container")
		.selectAll(".productbox")
		.style("display", "block");
}

function escapeProductTarget(x) {
	return "link" + x.replace(/[, ]/g, "-");
}

function csvToJson(csvData) {
  var geoJson = {
    type: "FeatureCollection",
    features: []
  }

  csvData.forEach(function(data) {
    geoJson.features.push(getFeature(data))
  })
  return geoJson
}

function getFeature(item) {
  var feature = { type: "Feature" };

  feature.geometry = buildGeom(item);
  feature.properties = buildProps(item);

  return feature;
}

function buildGeom(item) {
  return {
    type: 'Point',
    coordinates: [parseFloat(item['lon']), parseFloat(item['lat'])]
  };
}

function buildProps(item) {
  var properties = {};

  for (var key in item) {
    if (key !== 'lat' && key !== 'lon') {
      properties[key] = item[key]
    }
  }

  return properties;
}
