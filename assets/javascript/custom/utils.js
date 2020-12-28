var percentFormat = d3.format(".1%");
var commaFormat = d3.format(',');


d3.selection.prototype.moveToBack = function () {
	return this.each(function () {
		var firstChild = this.parentNode.firstChild;
		if (firstChild) {
			this.parentNode.insertBefore(this, firstChild);
		}
	});
};

d3.selection.prototype.moveToFront = function () {
	return this.each(function () {
		this.parentNode.appendChild(this);
	});
};

//to wait until end of resize
function debouncer(func, timeout) {
	var timeoutID, timeout = timeout || 200;
	return function () {
		var scope = this,
			args = arguments;
		clearTimeout(timeoutID);
		timeoutID = setTimeout(function () {
			func.apply(scope, Array.prototype.slice.call(args));
		}, timeout);
	};
}


//svg text wrap
function wrap(text, width) {
	text.each(function () {
		var text = d3.select(this);
		//	console.log("text.text()", text.text());

		var dyorig = parseFloat(text.attr("dy"));
		var dxorig = parseFloat(text.attr("dx"));

		//console.log("dyorig", dyorig);
		//console.log("dxorig", dxorig);

		//		if(dyorig == NaN){dyorig =0};
		//		if(dxorig == NaN){dxorig =0};
		var dx;
		var dy;

		//		if(dyorig === NaN){dy = 0 }else{dy =dyorig};
		//			if(dxorig === NaN){dx = 0 }else{dx =dxorig};

		if (isNaN(dyorig)) {
			dy = 0
		} else {
			dy = dyorig
		};
		if (isNaN(dxorig)) {
			dx = 0
		} else {
			dx = dxorig
		};


		//console.log("dy", dy);
		//console.log("dx", dx);

		//console.log("step1: text.text()",  text.text());

		var breakslashtext = text.text().replace(/\//g, "/ "),
			words = breakslashtext.split(/\s+/).reverse(),
			word,
			line = [],
			lineNumber = 0,
			lineHeight = .9, // ems
			y = text.attr("y"),
			//  dy = dyorig,
			//dx = dxorig,
			tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em").attr("dx", dx + "em");

		//console.log("text", text);
		//console.log("text.attr(textContent)", text.attr("textContent"));
		//console.log("text._data_", text._data_);
		//console.log("text.text()", text.text());
		//console.log("text._groups.text()", text._groups.text());
		//console.log("step2: breakslashtext", breakslashtext);
		//console.log("step3: words", words);
		//console.log("step3b: word -outside while", word);
		//console.log(" tspan", tspan);

		while (word = words.pop()) {
			//console.log("step4:word after pop", word)
			line.push(word + " ");
			//console.log("step5:line in while", line)
			tspan.text(line.join(" "));
			//console.log("step6:line.join(' ')", line.join(" "))

			if (tspan.node().getComputedTextLength() > width) {
				line.pop();
				//console.log("step7in if:line  popped", line)
				tspan.text(line.join(" "));
				//console.log("step8in if:line.join(' ')", line.join(" "))
				line = [word];
				//console.log("step9in if:line = [word]", [word])
				//console.log("step10in if:word", word)			
				//			console.log("line if >width", line)
				//				console.log("word if >width", word)
				tspan = text.append("tspan")
					.attr("x", 0)
					.attr("y", y)
					.attr("dy", ++lineNumber * lineHeight + dy + "em")
					.attr("dx", dx + "em")
					.text(word);
			}
		}
	});
}

const TO_NAME = 1;
const TO_ABBREVIATED = 2;

function convertRegion(input, to) {

	//console.log("input", input)
	var states = [
        ['Alabama', 'AL'],
        ['Alaska', 'AK'],
        ['American Samoa', 'AS'],
        ['Arizona', 'AZ'],
        ['Arkansas', 'AR'],
        ['Armed Forces Americas', 'AA'],
        ['Armed Forces Europe', 'AE'],
        ['Armed Forces Pacific', 'AP'],
        ['California', 'CA'],
        ['Colorado', 'CO'],
        ['Connecticut', 'CT'],
        ['Delaware', 'DE'],
        ['District Of Columbia', 'DC'],
        ['Florida', 'FL'],
        ['Georgia', 'GA'],
        ['Guam', 'GU'],
        ['Hawaii', 'HI'],
        ['Idaho', 'ID'],
        ['Illinois', 'IL'],
        ['Indiana', 'IN'],
        ['Iowa', 'IA'],
        ['Kansas', 'KS'],
        ['Kentucky', 'KY'],
        ['Louisiana', 'LA'],
        ['Maine', 'ME'],
        ['Marshall Islands', 'MH'],
        ['Maryland', 'MD'],
        ['Massachusetts', 'MA'],
        ['Michigan', 'MI'],
        ['Minnesota', 'MN'],
        ['Mississippi', 'MS'],
        ['Missouri', 'MO'],
        ['Montana', 'MT'],
        ['Nebraska', 'NE'],
        ['Nevada', 'NV'],
        ['New Hampshire', 'NH'],
        ['New Jersey', 'NJ'],
        ['New Mexico', 'NM'],
        ['New York', 'NY'],
        ['North Carolina', 'NC'],
        ['North Dakota', 'ND'],
        ['Northern Mariana Islands', 'NP'],
        ['Ohio', 'OH'],
        ['Oklahoma', 'OK'],
        ['Oregon', 'OR'],
        ['Pennsylvania', 'PA'],
        ['Puerto Rico', 'PR'],
        ['Rhode Island', 'RI'],
        ['South Carolina', 'SC'],
        ['South Dakota', 'SD'],
        ['Tennessee', 'TN'],
        ['Texas', 'TX'],
        ['US Virgin Islands', 'VI'],
        ['Utah', 'UT'],
        ['Vermont', 'VT'],
        ['Virginia', 'VA'],
        ['Washington', 'WA'],
        ['West Virginia', 'WV'],
        ['Wisconsin', 'WI'],
        ['Wyoming', 'WY'],
    ];

	// So happy that Canada and the US have distinct abbreviations
	var provinces = [
        ['Alberta', 'AB'],
        ['British Columbia', 'BC'],
        ['Manitoba', 'MB'],
        ['New Brunswick', 'NB'],
        ['Newfoundland', 'NF'],
        ['Northwest Territory', 'NT'],
        ['Nova Scotia', 'NS'],
        ['Nunavut', 'NU'],
        ['Ontario', 'ON'],
        ['Prince Edward Island', 'PE'],
        ['Quebec', 'QC'],
        ['Saskatchewan', 'SK'],
        ['Yukon', 'YT'],
    ];

	var regions = states.concat(provinces);

	var i; // Reusable loop variable
	if (to == TO_ABBREVIATED) {
		input = input.replace(/\w\S*/g, function (txt) {
			return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
		});
		for (i = 0; i < regions.length; i++) {
			if (regions[i][0] == input) {
				return (regions[i][1]);
			}
		}
	} else if (to == TO_NAME) {

		//console.log("input", input)
		input = input.toUpperCase();
		for (i = 0; i < regions.length; i++) {
			if (regions[i][1] == input) {
				return (regions[i][0]);
			}
		}
	}
}



function getTransformation(transform) {
    /*
     * This code comes from a StackOverflow answer to a question looking
     * to replace the d3.transform() functionality from v3.
     * http://stackoverflow.com/questions/38224875/replacing-d3-transform-in-d3-v4
     */
    var g = document.createElementNS("http://www.w3.org/2000/svg", "g");

    //    console.log("g", g)
    //    
    //     console.log("transform", transform)
    //    
    g.setAttributeNS(null, "transform", transform);

    // g.setAttributeNS("http://www.w3.org/2000/svg", "transform", transform);

    // console.log("g", g)

    var matrix = g.transform.baseVal.consolidate()
        .matrix;

    var a = matrix;
    var b = matrix;
    var c = matrix;
    var d = matrix;
    var e = matrix;
    var f = matrix;

    var scaleX, scaleY, skewX;
    if (scaleX = Math.sqrt(a * a + b * b)) a /= scaleX, b /= scaleX;
    if (skewX = a * c + b * d) c -= a * skewX, d -= b * skewX;
    if (scaleY = Math.sqrt(c * c + d * d)) c /= scaleY, d /= scaleY, skewX /= scaleY;
    if (a * d < b * c) a = -a, b = -b, skewX = -skewX, scaleX = -scaleX;
    return {
        translateX: e,
        translateY: f,
        rotate: Math.atan2(b, a) * Math.PI / 180,
        skewX: Math.atan(skewX) * Math.PI / 180,
        scaleX: scaleX,
        scaleY: scaleY
    };
}


function arrangeLabels(selection, label_class) {
    var move = 1;
    while (move > 0) {
        move = 0;
        selection.selectAll(label_class)
            .each(function () {
                var that = this;
                var a = this.getBoundingClientRect();
                selection.selectAll(label_class)
                    .each(function () {
                        if (this != that) {
                            var b = this.getBoundingClientRect();
                            if ((Math.abs(a.left - b.left) * 2 < (a.width + b.width)) && (Math.abs(a.top - b.top) * 2 < (a.height + b.height))) {
                                var dx = (Math.max(0, a.right - b.left) + Math.min(0, a.left - b.right)) * 0.01;
                                var dy = (Math.max(0, a.bottom - b.top) + Math.min(0, a.top - b.bottom)) * 0.02;
console.log("theres an overlap")
                                //                                 console.log('d3.select(this)', d3.select(this));
                                //                                
                                //                                console.log('d3.select(this).attr("transform")', d3.select(this).attr("transform"));

                                var tt = getTransformation(d3.select(this)
                                    .attr("transform"));
                                var to = getTransformation(d3.select(that)
                                    .attr("transform"));
                                move += Math.abs(dx) + Math.abs(dy);

                                //                                to.translate = [to.translateX + dx, to.translateY + dy];
                                //                                tt.translate = [tt.translateX - dx, tt.translateY - dy];

                                //adaptation for vertical only bumps
                                to.translate = [0, to.translateY * 2 + dy];
                                tt.translate = [0, tt.translateY * 2 - dy];

                                d3.select(this)
                                    .attr("transform", "translate(" + tt.translate + ")");
                                d3.select(that)
                                    .attr("transform", "translate(" + to.translate + ")");
                                a = this.getBoundingClientRect();
                            }
                        }
                    });
            });
    }
}

//function arrangeLabels(overlappingthing) {
//	var move = 1;
//	while (move > 0) {
//		move = 0;
//		svg.selectAll(overlappingthing)
//			.each(function () {
//			console.log("d3.select(this).attr(r)", d3.select(this).attr("r"));
//				var that = this,
//					a = this.getBoundingClientRect();
//			
//				//console.log("a", a);
//				svg.selectAll(overlappingthing)
//					.each(function () {
//						//			  d3.select(this).attr("transform", "translate(" + 0 + "," + 50 + ")");
//						//					 d3.select(this).attr("fill", "red");
//						//			  d3.select(that).attr("fill", "green");
//
//						console.log("doing arrange")
//						if (this != that) {
//							var b = this.getBoundingClientRect();
//							console.log("b", b);
//	console.log("d3.select(this).attr(r)", d3.select(this).attr("r"));
//
//a.width = d3.select(this).attr("r") * 2;
//							a.height = d3.select(this).attr("r") * 2;
//								b.width = d3.select(that).attr("r") * 2;
//							b.height = d3.select(that).attr("r") * 2;
//								console.log("b", b);
//							
//							                if((Math.abs(a.left - b.left) * 2 < (12)) &&
//							                   (Math.abs(a.top - b.top)* 2  < (12))) {
//
////							if ((Math.abs(a.left - b.left) * 2 < ((d3.select(this).attr("r") * 2) + (d3.select(that).attr("r") * 2))) &&
////								(Math.abs(a.top - b.top) * 2 < ((d3.select(this).attr("r") * 2) + (d3.select(that).attr("r") * 2)))) {
//								console.log("theres an overlap")
//									// overlap, move labels
//								var dx = (Math.max(0, a.right - b.left) +
//										Math.min(0, a.left - b.right)) * 0.01,
//									dy = (Math.max(0, a.bottom - b.top) +
//										Math.min(0, a.top - b.bottom)) * 0.02,
//									//                      tt = d3.transform(d3.select(this).attr("transform")),
//									//                      to = d3.transform(d3.select(that).attr("transform"));
//									tt = getTransformation(d3.select(this).attr("transform")),
//									to = getTransformation(d3.select(that).attr("transform"));
//								move += Math.abs(dx) + Math.abs(dy);
//
//								to.translate = [to.translate[0] + dx, to.translate[1] + dy];
//								tt.translate = [tt.translate[0] - dx, tt.translate[1] - dy];
//								//d3.select(this).attr("transform", "translate(" + tt.translate + ")");
//
//								d3.select(that).attr("transform", "translate(" + to.translate + ")");
//								a = this.getBoundingClientRect();
//							}
//						}
//					});
//			});
//	}
//}


