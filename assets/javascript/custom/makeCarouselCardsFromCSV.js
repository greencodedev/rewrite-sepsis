// Parse the CSV file and calls the given function with the data
function parseCSVToCallback(file, callback) {
	// This reads in CSV and then calls the callback function to process it
	Papa.parse(file, {
		download: true,
		header:true,
		skipEmptyLines:true,
		delimiter:",",
		complete: function(results) {
            callback(results.data);
        }});
}

// Generates the deck of cards
function generateCarouselDeckFromArray(data) {
	const numberOfEventsToShow = 6;
	const numberOfCarouselSlides = 2;
	
	// Arrange by date
	data.sort(function(a,b){
		// Turn your strings into dates, and then subtract them
		// to get a value that is either negative, positive, or zero.
		return new Date(a.EventDate) - new Date(b.EventDate);
	});
	
	// Find those that we want to always display
	var alwaysDisplay = data.filter(function(value, index, arr){
		return value.AlwaysDisplay == "TRUE";
	});
	// Include up to numberOfEventsToShow entries
	alwaysDisplay = alwaysDisplay.slice(0, Math.max(numberOfEventsToShow, alwaysDisplay.length));

	// Which are the items that we don't want to always display?
	var dontAlwaysDisplay = data.filter(function(value, index, arr){
		return value.AlwaysDisplay == "FALSE";
	});
	// Only show future events
	dontAlwaysDisplay = dontAlwaysDisplay.filter(function(value, index, arr){
		return (new Date(value.EventDate) >= new Date());
	});
	
	// How many dontAlwaysDisplay items will we be displaying?
	var numberOfAdditionalEventsNeeded = numberOfEventsToShow - alwaysDisplay.length;
	
	// Concatinate the two arrays together
	var eventsToProcess = alwaysDisplay.concat(dontAlwaysDisplay.slice(0, numberOfAdditionalEventsNeeded));
			
	// Process the events
	
	if (numberOfEventsToShow % numberOfCarouselSlides != 0) {
		throw "Cannot spread " + numberOfEventsToShow + " events across " + numberOfCarouselSlides + " slides.";
	}
	
	// This section makes an arbitrary number of cards split over an arbitrary number of slides
	var cardsDisplayedThusFar = 0; // How many cards (out of numberOfEventsToShow) have we displayed thus far
	for (iterator = 1; iterator <= numberOfCarouselSlides; iterator++) {
		// Need to make a number of divs to contain the cards
		// First one is the slide itself
		var newCarouselSlideOuter = document.createElement("div");
		// Make the first one active
		if (iterator == 1) {
			newCarouselSlideOuter.className = "carousel-item active";
		} else {
			newCarouselSlideOuter.className = "carousel-item";
		}
		// Next is to make a deck for the cards
		var newCarouselSlideInner = document.createElement("div");
		newCarouselSlideInner.className = "card-deck";
		// Give it a unique ID so the cards can get placed into it
		newCarouselSlideInner.id = "slide" + iterator;
		
		// Add the deck to the slide and the slide to the DOM
		newCarouselSlideOuter.appendChild(newCarouselSlideInner);
		document.getElementById("carouselGeneratedContent").appendChild(newCarouselSlideOuter);
		
		// Now add the cards to the DOM directly
		eventsToProcess.slice(cardsDisplayedThusFar, cardsDisplayedThusFar + numberOfEventsToShow / numberOfCarouselSlides).
			forEach(function(item, index) {
			addCardToDeck(item, "slide" + iterator, "generatedCarouselModals");
		});
		// Update number of cards displayed so we don't show the same ones over and over
		cardsDisplayedThusFar += numberOfEventsToShow / numberOfCarouselSlides;
	}
}

// Adds a single card to the given deck ID
function addCardToDeck(item, idOfDeck, idOfModals) {
	// Make a card
	var card = generateCard(item.EventName, item.EventType, item.EventDate, item.Who, item.Where, item.Website, item.Description, item.Banner);
	// Add card to the DOM
	document.getElementById(idOfDeck).appendChild(card);
	var modal = generateModal(item.EventName, item.EventType, item.EventDate, item.Who, item.Where, item.Website, item.Description, item.Banner);
	document.getElementById(idOfModals).appendChild(modal);
}

// Generates the HTML for a card
function generateCard(EventName, EventType, EventDate, Who, Where, Website, Description, Banner) {

	// Outer div
	var card = document.createElement("div");
	// Always set the class for the div you just made
	card.className = "card";
	card.setAttribute("style", "height:450px;");
	
	// Inner div
	var cardBody = document.createElement("div");
	cardBody.className = "card-body";
	
	// Manually make HTML for the cardBody div
	cardBody.innerHTML = "<img src='" + Banner + "' class='img-responsive' alt='Photo' />" +
		"<h5 class='card-title'><br> " + EventName + "</h5>" + 
		"<p class='card-text'>" + 
			"<strong>Location:</strong> " + Where + "<br>" +
			"<strong>Date:</strong> " + EventDate + "<br>" +
		    "<strong>Opportunities:</strong> " + Description + "<br>" +
			"<strong>Who's attending?</strong> " + Who;
		
	// Another inner div
	var cardFooter = document.createElement("div");
	cardFooter.className = "card-footer";
	cardFooter.innerHTML = "<button style='padding: 10px; border-radius: 5px' class='btn-secondary' data-toggle='modal' data-target='#" +
		EventName.replace(/ /g, "") + EventType.replace(/ /g, "") + "'>Find out More</button>";
	
	// Add created divs to the card
	card.appendChild(cardBody);
	card.appendChild(cardFooter);
	return card;
}

// Generates the modal for the popup
function generateModal(EventName, EventType, EventDate, Who, Where, Website, Description, Banner) {
		
	var modal = document.createElement("div");
	modal.className = "modal fade";
	modal.id = EventName.replace(/ /g, "") + EventType.replace(/ /g, "");
	modal.setAttribute("tabindex", "-1");
	modal.setAttribute("role", "dialog");
	modal.setAttribute("aria-labelledby", "exampleModalCenterTitle");
	modal.setAttribute("aria-hidden", "true");
	
	var modalDialog = document.createElement("div");
	modalDialog.className = "modal-dialog modal-dialog-centered";
	modalDialog.setAttribute("role", "document");
	
	var modalContent = document.createElement("div");
	modalContent.className = "modal-content";
	
	var modalHeader = document.createElement("div");
	modalHeader.className = "modal-header text-center";
	modalHeader.innerHTML = "<h5 class='modal-title' id='exampleModalLongTitle'>" +
		EventName + "</h5> <button type='button' class='close' data-dismiss='modal' aria-label='Close'>" +
		"<span aria-hidden='true'>&times;</span></button>";
		
	var modalBody = document.createElement("div");
	modalBody.className = "modal-body";
 	modalBody.innerHTML = "<p>" + 
			"<strong>Location:</strong> " + Where + "<br>" +
			"<strong>Date:</strong> " + EventDate + "<br>" +
			"<strong>Who's attending?</strong> " + Who + "<br>" +
			"<strong>About:</strong> " + Description + "</p>" +
			"<p><a href='" + Website + "' target = '_blank'>More information</a>";
			
	var modalFooter = document.createElement("div");
	modalFooter.className = "modal-footer";
	modalFooter.innerHTML = "<button type='button' class='btn btn-secondary' data-dismiss='modal'>Close</button>";
		
	modalContent.appendChild(modalHeader);
	modalContent.appendChild(modalBody);
	modalContent.appendChild(modalFooter);
	modalDialog.appendChild(modalContent);
	modal.appendChild(modalDialog);
	
	return modal;	
}

// Make a deck of cards of everything in the event list
// This presumes that there is a card-deck with id=generatedEventListDeck for the deck and a div with id=generatedEvenListModals for the modals
function generateDeckFromArray(data) {
	// Arrange by date
	data.sort(function(a,b){
		// Turn your strings into dates, and then subtract them
		// to get a value that is either negative, positive, or zero.
		return new Date(a.EventDate) - new Date(b.EventDate);
	});

	// Process the events
	data.forEach(function(item, index) {
			addCardToEventListDeck(item, "generatedEventListDeck", "generatedEventListModals");
		});
}

// Adds a single card to the given deck ID
// Adds additional column information as well
function addCardToEventListDeck(item, idOfDeck, idOfModals) {
	// Make a card
	var card = generateCard(item.EventName, item.EventType, item.EventDate, item.Who, item.Where, item.Website, item.Description, item.Banner);
	var cardColumn = document.createElement("div");
	cardColumn.className = "col-4";
	cardColumn.appendChild(card);
	// Add card to the DOM
	document.getElementById(idOfDeck).appendChild(cardColumn);
	var modal = generateModal(item.EventName, item.EventType, item.EventDate, item.Who, item.Where, item.Website, item.Description, item.Banner);
	document.getElementById(idOfModals).appendChild(modal);
}