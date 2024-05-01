"use strict"
const vallauriLat = "44.55550000000000"
const vallauriLng = "7.736695711804882"
let durata = "";
let distanza = "";
let codOperatore = 0;
var markers = [];
let perizie = [];
let userLogged;
let _idInfo;
$(document).ready(async function () {

	controllaLogIn();

	$("#overlay").hide();
	$("#lblMsg").hide();
	$("#lblMsgSucc").hide();
	$("#visualizzaInfo").hide();
	let home = $("#homeDiv");
	let edit = $("#editDiv");
	home.show();
	edit.hide();
	$("#divDeleteOp").hide();
	$(".navLink").on("click", function () {
		$(".navLink").removeClass("active");
		$(this).addClass("active");
	});
	$("#home").on("click", function () {
		edit.fadeOut();
		home.fadeIn();
	});
	$("#editInfo").on("click", function () {
		home.fadeOut();
		edit.fadeIn();
	});
	$("#btnInviaPop").on("click", function () {
		applicaDatiImg();
	});
	$("#btnEliminaPop").on("click", function () {
		eliminaFoto();
	});
	$(".noInfo").hide();
	$('#divNormale').hide();
	$('#popupOp').hide();
	$("#divInfo").hide();
	await caricaGoogleMaps()

	caricaMarkers();
	mostraPeriti();

	$('.btnAnnulla').click(function () {
		$(".noInfo").hide();
	});
	$('#btnAnnulla').click(function () {
		var elementToScrollTo = $('#title');
		// Esegui lo scroll verso l'elemento con animazione
		$('#divNormale').slideUp(1000);
		setTimeout(function () {
			svuotaCampi();
		}, 1000);
	});
	$('#btnInvia').click(function () {
		if ($("#data").val() != "" && $("#ora").val() != "" && $("#descrizione").val() != "" && $("#coordinate").val() != "" && $("#codOperatore").val() != "") {
			$(".noInfo").hide();

			aggiungiPerizia();


		}
		else {
			$(".noInfo").show();
		}
	});

	$('#btnAnnullaOp').click(function () {
		$('#popupOp').slideUp(1000);

		svuotaCampi();
	});
	$('#btnInviaOp').click(function () {
		if ($("#codOperatoreOp").val() != "" && $("#nome").val() != "" && $("#cognome").val() != "" && $("#email").val() != "" && $("#pwd").val() != "") {
			$(".noInfo").hide();
			addOperator();

		}
		else {
			$(".noInfo").show();
		}
	});

	$(".button").on("click", function () {
		$(".forms").slideUp(1000);
		$(".noInfo").hide();
		setTimeout(function () {
			svuotaCampi();
		}, 1000);
	});



	$("#operatori").on("click", ".card", function () {
		$("#divInfo").slideUp(600);
		directionsRenderer.setDirections({ routes: [] });
		if ($(this).hasClass("selected")) {
			$(".card").removeClass("selected");
			codOperatore = 0;
		}
		else if (!$(this).hasClass("selected")) {
			$(".card").removeClass("selected");
			$(this).addClass("selected");
			codOperatore = $(this).attr("id");
		}
		caricaMarkers();
	});





	var mapOptions = {
		zoom: 15,
		center: new google.maps.LatLng(vallauriLat, vallauriLng),
		mapTypeControl: false,
		streetViewControl: false
	};

	var map = new google.maps.Map(document.getElementById('map'), mapOptions);
	map.markers = [];
	// MARKER AZIENDA
	var infoWindow = new google.maps.InfoWindow({
		content: '<br><h3>Sede aziendale</h3>'
	});

	var marker = new google.maps.Marker({
		position: new google.maps.LatLng(vallauriLat, vallauriLng),
		map: map,
		title: 'Sede azienda',
		label: {
			text: "A",
			color: "black",
			fontSize: "16px"
		}
	});

	marker.addListener('click', function () {
		infoWindow.open(map, marker);
	});



	var directionsService = new google.maps.DirectionsService();
	var directionsRenderer = new google.maps.DirectionsRenderer({
		suppressMarkers: true  // Nascondi i marker di partenza e arrivo
	});



	// Definisci lo stile della polyline
	var lineSymbol = {
		path: google.maps.SymbolPath.CIRCLE, // Puoi usare diversi tipi di simboli
		scale: 7,  // Dimensione del simbolo
		strokeColor: '#0000FF', // Colore della linea
		strokeOpacity: 1.0, // Opacità della linea
		strokeWeight: 2 // Spessore della linea
	};

	var lineStyle = {
		icons: [{
			icon: lineSymbol,
			offset: '100%'
		}],
		strokeColor: '#0000FF',
		strokeOpacity: 1.0,
		strokeWeight: 5
	};
	// Applica lo stile alla polyline
	directionsRenderer.setOptions({ polylineOptions: lineStyle });

	// Imposta la mappa per il renderer delle indicazioni
	directionsRenderer.setMap(map);

	// Definisci la funzione getDirections nel contesto globale
	window.getDirections = function (destLat, destLng) {
		var request = {
			origin: new google.maps.LatLng(vallauriLat, vallauriLng),
			destination: new google.maps.LatLng(destLat, destLng),
			travelMode: google.maps.TravelMode.DRIVING
		};
		directionsService.route(request, function (result, status) {
			if (status == google.maps.DirectionsStatus.OK) {
				directionsRenderer.setDirections(result);

				var route = result.routes[0].legs[0];
				var distance = route.distance.text;
				var duration = route.duration.text;

				distanza = distance;
				durata = duration;
				visualizzaInfo();
			} else {
				console.error("Errore nel calcolo delle indicazioni stradali:", status);
			}
		});
	};


	async function modificaInformazioni() {

		let cod = $("#operatoreInfo").splice(" ");
		let codice = cod[1];
		let fileInput = document.querySelector("#fotoInputInfo");
		let p = []
		for (let i = 0; i < fileInput.files.length; i++) {
			let file = fileInput.files[i];
			let imgBase64 = await base64Convert(file).catch((err) => alert(`Errore conversione file: ${err}`));
			p.push(inviaRichiesta("POST", "/api/addBase64CloudinaryImage", { "codOp": codice, imgBase64 }));
		}
		let imgs;
		try {

			imgs = (await Promise.all(p)).map(r => {
				return { "url": r.data.url, "descrizioneFoto": "" }
			})
		}
		catch (err) {
			console.log(err);
			return;
		}

		console.log(JSON.stringify(imgs));
		let jsonInfo = {
			"descrizione": $("#descrizioneInfo").val()
		};
		let rq = inviaRichiesta("patch", "/api/modificaInfo/" + $("#idInfo").val(), { jsonInfo });
		rq.then(function (data) {
			if (imgs.length > 0) {
				let req = inviaRichiesta("post", "/api/addFotoPerizia/" + $("#idInfo").val(), { imgs });
				req.then(function (data) {
					caricaMarkers();
				});
				req.catch(errore);
			}
			else {
				console.log("Nessuna foto da aggiungere")
				caricaMarkers();
			}
		});
		rq.catch(errore);
	}

	function caricaMarkers() {
		rimuoviMarkers();
		var openInfoWindow = null;


		let richiesta = inviaRichiesta("get", "/api/perizie")
		richiesta.then(function (response) {
			for (let perizia of response.data) {
				if (codOperatore == 0 || codOperatore == perizia.codOperatore) {
					let coordinate = perizia.coordinate.trim().split(",");
					var infoWindow = new google.maps.InfoWindow({
						content: `<p style="font-weight:bold;font-size:11pt">Perizia del ${perizia.data}</p>` +
							`<button class="getDirections buttonInfo" onclick="getDirections(${coordinate[0]}, ${coordinate[1]})">Ottieni indicazioni</button>` +
							`<br><br><button class="buttonInfo" onclick='modificaInfo(${JSON.stringify(perizia)})'>Visualizza informazioni</button>`
					});
					var marker = new google.maps.Marker({
						position: new google.maps.LatLng(coordinate[0], coordinate[1]),
						map: map,
						title: perizia._id,
						label: {
							text: perizia.codOperatore,
							color: "black",
							fontSize: "16px"
						}
					});
					map.markers.push(marker);
					attachInfoWindow(marker, infoWindow);

				}

			}
		});

		function attachInfoWindow(marker, infoWindow) {
			marker.addListener('click', function () {
				$("#visualizzaInfo").slideUp(1000);
				directionsRenderer.setDirections({ routes: [] });
				$("#divInfo").slideUp(600);
				// Chiudi l'infoWindow aperto attualmente se presente
				if (openInfoWindow) {
					openInfoWindow.close();
				}
				// Apri l'infoWindow associato al marker cliccato
				infoWindow.open(map, marker);
				// Imposta l'infoWindow aperto attualmente come quello associato al marker cliccato
				openInfoWindow = infoWindow;
			});
		}

		richiesta.catch(errore);
	}
	function visualizzaInfo() {
		$("#divInfo").slideDown(600);
		$("#lunghezza").text(distanza);
		$("#durata").text(durata);
	}
	function rimuoviMarkers() {
		if (map && map.markers) {
			// Itera attraverso tutti i marker sulla mappa e rimuovili
			map.markers.forEach(function (marker) {
				marker.setMap(null);
				console.log("Rimosso marker")
			});
			// Svuota l'array dei marker
			map.markers = [];
		}
	}

	function mostraPeriti() {
		$("#operatori").empty();
		let richiesta = inviaRichiesta("get", "/api/periti")
		richiesta.then(function (response) {
			for (let perito of response.data) {
				if (perito._id != "661e9ba776dfea22a9fbd290")
					$("#operatori").append(`<div class="card" id="${perito.codOperatore}">
					<img src="${perito.img}" alt="Image">
					<div class="content">
					  <h2 class="title">${perito.cognome} ${perito.nome}</h2>
					</div>`)
			}
		});
		richiesta.catch(errore);
	}

	$("#addOperator").on("click", function () {
		$('#popupOp').slideDown(1000);
	});
	async function addOperator() {
		$("#lblMsg").hide();
		let fileInput = document.querySelector("#foto");
		let img;
		if (fileInput.files.length > 0) {
			let imgBase64 = await base64Convert($("#foto").prop("files")[0]).catch((err) => alert(`Errore conversione file: ${err}`));
			let rq = inviaRichiesta("POST", "/api/addBase64CloudinaryImage", { "codOp": $("#codOperatoreOp").val(), imgBase64 });
			rq.catch(errore);
			rq.then((response) => {
				img = response.data.url;
				let newOp = {
					"codOperatore": $("#codOperatoreOp").val(),
					"nome": $("#nome").val(),
					"cognome": $("#cognome").val(),
					"email": $("#email").val(),
					"password": "password",
					"img": img,
					"newPass": true
				};
				console.log(newOp);
				let request = inviaRichiesta("post", "/api/addOperator", { newOp });
				request.then(function (response) {
					$("#lblMsgTextSucc").text("Operatore aggiunto con successo, hai ricevuto una mail con la password!");
					$("#lblMsgSucc").show();
					mostraPeriti();
					$('#popupOp').slideUp(1000);
					setTimeout(function () {
						svuotaCampi();
					}, 1000);
				});
				request.catch(error => {
					if (error.response && error.response.status === 409) {
						$("#lblMsgText").text("Operatore già esistente!");
						$("#lblMsg").show();
						$("#lblMsgSucc").hide();
					}
				});

			});
		} else {
			img = "https://www.w3schools.com/howto/img_avatar.png";

			let newOp = {
				"codOperatore": $("#codOperatoreOp").val(),
				"nome": $("#nome").val(),
				"cognome": $("#cognome").val(),
				"email": $("#email").val(),
				"password": "password",
				"img": img,
				"newPass": true
			};

			let rq = inviaRichiesta("post", "/api/addOperator", { newOp });
			rq.then(function (response) {
				$("#lblMsgTextSucc").text("Operatore aggiunto con successo, hai ricevuto una mail con la password!");
				$("#lblMsgSucc").show();
				mostraPeriti();
				$('#popupOp').slideUp(1000);
				setTimeout(function () {
					svuotaCampi();
				}, 1000);
			});
			rq.catch(error => {
				if (error.response && error.response.status === 409) {
					$("#lblMsgText").text("Operatore già esistente!");
					$("#lblMsg").show();
				}
			});
		}


	}


	$("#addPerizia").on("click", function () {
		svuotaCampi();
		$('#divNormale').slideDown(1000);

	});
	$("#eliminaPerizia").on("click", function () {
		svuotaCampi();
		$('#divDeleteOp').slideDown(1000);

	});

	async function aggiungiPerizia() {
		if ($("#data").val() == "" || $("#ora").val() == "" || $("#descrizione").val() == "" || $("#coordinate").val() == "" || $("#codOperatore").val() == "" || $("#fotoPer").val() == "") {
			$(".noInfo").show();
		}
		else {
			let fileInput = document.querySelector("#fotoPer");
			let p = []
			for (let i = 0; i < fileInput.files.length; i++) {
				let file = fileInput.files[i];
				let imgBase64 = await base64Convert(file).catch((err) => alert(`Errore conversione file: ${err}`));
				p.push(inviaRichiesta("POST", "/api/addBase64CloudinaryImage", { "codOp": $("#codOperatore").val(), imgBase64 }));
			}
			let imgs;
			try {

				imgs = (await Promise.all(p)).map(r => {
					return { "url": r.data.url, "descrizioneFoto": "descrizione immagine" }
				})
			}
			catch (err) {
				console.log(err);
				return;
			}

			console.log(JSON.stringify(imgs));
			let dataSplit = $("#data").val().split("-");
			let data = dataSplit[2] + "-" + dataSplit[1] + "-" + dataSplit[0];
			let newPerizia = {
				"codOperatore": $("#codOperatore").val(),
				"coordinate": $("#coordinate").val(),
				"data": data,
				"ora": $("#ora").val(),
				"descrizione": $("#descrizione").val(),
				"foto": imgs

			}
			let rq = inviaRichiesta("post", "/api/addPerizia", { newPerizia });
			rq.then(function (response) {
				caricaMarkers();
				$("#lblMsgTextSucc").text("Perizia aggiunta con successo!");
				$("#lblMsgSucc").show();
				$("#lblMsg").hide();
				$('#divNormale').slideUp(1000);
				setTimeout(function () {
					svuotaCampi();
				}, 1000);
				window.scroll({
					top: 0,
					behavior: 'smooth'
				});
			});
			rq.catch(error => {
				if (error.response && error.response.status === 409) {
					$("#lblMsgText").text("Perizia già esistente!");
					$("#lblMsg").show();
					$("#lblMsgSucc").hide();
					//scroll to top
					window.scroll({
						top: 0,
						behavior: 'smooth'
					});
				}
			});



		}
	}


	/* ************************* LOGOUT  *********************** */

	/*  Per il logout è inutile inviare una richiesta al server.
		E' sufficiente cancellare il cookie o il token dal pc client.
		Se però si utilizzano i cookies la gestione dei cookies lato client 
		è trasparente, per cui in quel caso occorre inviare una req al server */

	$(".btnLogout").on("click", function () {
		localStorage.removeItem("token")
		window.location.href = "login.html"
	});
	$("#closeImg").on("click", function () {
		$("#overlay").fadeOut(1000);
	});
	$("#buttonInfo").on("click", function () {
		//scroll to top
		window.scroll({
			top: 0,
			behavior: 'smooth'
		});
		$("#visualizzaInfo").slideUp(600);
	});
	$("#lblMsg").children("button").on("click", function () {
		$("#lblMsg").hide();
	})
	$("#lblMsgSucc").children("button").on("click", function () {
		$("#lblMsgSucc").hide();
	})
	$(".button").on("click", function () {
		$("#lblMsg").hide();
		$("#lblMsgSucc").hide();
	})
	$("#btnAnnullaInfo").on("click", function () {
		$("#visualizzaInfo").slideUp(600);
		//scroll to top
		window.scroll({
			top: 0,
			behavior: 'smooth'
		});
	});
	$("#btnInviaInfo").on("click", function () {
		modificaInformazioni();
		$("#visualizzaInfo").slideUp(600);
		window.scroll({
			top: 0,
			behavior: 'smooth'
		});
	});


	$("#btnAnnullaDel").on("click", function () {
		$("#divDeleteOp").slideUp(1000);
	});

	$("#btnEliminaInfo").on("click", function () {
		eliminaPerizia();
		//scroll to top
		window.scroll({
			top: 0,
			behavior: 'smooth'
		});
	});

	function eliminaPerizia() {
		let rq = inviaRichiesta("post", "/api/deletePerizia/" + $("#idInfo").val());
		rq.then(function (response) {
			console.log(response.data)
			caricaMarkers();
			$("#visualizzaInfo").slideUp(600);
		});
		rq.catch(errore);
	}
	$("#btnInviaDel").on("click", function () {
		if ($("#codOperatoreDel").val() && $("#emailDel").val()) {
			eliminaOp();
		}
		else {
			$(".noInfo").show();
		}
	});

	function eliminaOp() {
		let rq = inviaRichiesta("post", "/api/deleteOperator", { "codOp": $("#codOperatoreDel").val(), "email": $("#emailDel").val() });
		rq.then(function (response) {
			console.log(response.data)
			$("#lblMsgTextSucc").text("Operatore eliminato con successo!");
			$("#lblMsgSucc").show();
			$("#lblMsg").hide();
			mostraPeriti();
			$("#divDeleteOp").slideUp(1000);
			setTimeout(function () {
				svuotaCampi();
			}, 1000);
		});
		rq.catch(error => {
			if (error.response && error.response.status === 404) {
				$("#lblMsgText").text("Operatore non trovato!");
				$("#lblMsg").show();
				$("#lblMsgSucc").hide();
			}
		});
	}
	function applicaDatiImg() {
		let descrizione = $("#txtAreaPop").val();
		let img = $("#imgPopup").attr("src");
		let rq = inviaRichiesta("post", "/api/modificaDescrizioneFoto/" + $("#idInfo").val(), { "descrizione": descrizione, "url": img });
		rq.then(function (response) {
			modificaInfo(response.data);
			$("#overlay").fadeOut(500);
			caricaMarkers();

		});
		rq.catch(errore);
	}

	function eliminaFoto() {
		let _id = _idInfo;
		let img = $("#imgPopup").attr("src");
		let descrizione = $("#txtAreaPop").val();
		let rq = inviaRichiesta("post", "/api/deleteFotoPerizia/" + _id, { "url": img, "descrizione": descrizione });
		rq.then(function (response) {
			modificaInfo(response.data);
			caricaMarkers();
			$("#overlay").fadeOut(500);

		});
		rq.catch(errore);
	}
});

function svuotaCampi() {
	$("#_id").val("");
	$("#codOperatore").val("");
	$("#codOperatoreOp").val("");
	$("#coordinate").val("");
	$("#data").val("");
	$("#ora").val("");
	$("#descrizione").val("");

	document.querySelector("#foto").value = "";
	document.querySelector("#fotoPer").value = "";
	document.querySelector("#fotoInputInfo").value = "";

	$("#nome").val("");
	$("#cognome").val("");
	$("#email").val("");
	$("#pwd").val("");


	$("#codOperatoreDel").val("");
	$("#emailDel").val("");
}


function modificaInfo(periziaEdit) {

	document.querySelector("#fotoInputInfo").value = "";
	// scroll to #visualizzaInfo
	setTimeout(function () {
		let element = document.querySelector("#visualizzaInfo");
		let elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
		window.scrollTo({ top: elementPosition - 100, behavior: 'smooth' });
	}, 90);

	let codOperatore = periziaEdit.codOperatore;
	let coordinate = periziaEdit.coordinate;
	let data = periziaEdit.data;
	let ora = periziaEdit.ora;
	let descrizione = periziaEdit.descrizione;
	let foto = periziaEdit.foto; // Array di oggetti
	let dateSplit = data.split("-");
	data = dateSplit[0] + "-" + dateSplit[1] + "-" + dateSplit[2];
	// $("#_id").val(periziaEdit._id);
	// $("#codOperatore").val(codOperatore);
	// $("#coordinate").val(coordinate);
	// $("#data").val(data);
	// $("#ora").val(ora);
	// $("#descrizione").val(descrizione);
	$("#idInfo").val(periziaEdit._id);
	$("#titoloInfo").text("Perizia del " + data);
	$("#operatoreInfo").text("Operatore " + codOperatore);
	$("#coordinateInfo").text("Coordinate: " + coordinate);
	$("#descrizioneInfo").val(descrizione);


	// Per le foto, è necessario un ciclo per iterare l'array e 
	// aggiungere ogni foto al campo file
	$("#fotoInfo").empty();
	for (let foto of periziaEdit.foto) {
		// Crea un nuovo elemento "input" di tipo "file"
		let inputFile = $(`<img style="margin-bottom:5px;"alt="foto" class="fotoPerizia" onClick="visualizzaFoto('${foto.url}', '${foto.descrizioneFoto}','${codOperatore}','${periziaEdit._id}')"> `);

		// Imposta il valore dell'attributo "value" con il nome della foto
		inputFile.prop("src", foto.url);

		// Aggiungi l'elemento "input" al campo file
		$("#fotoInfo").append(inputFile);
	}

	$("#visualizzaInfo").slideDown(1000);
}

function controllaLogIn() {
	let params = new URLSearchParams(window.location.search);
	let _id = params.get('id');
	let rq = inviaRichiesta("get", "/api/user/" + _id);
	rq.then(function (response) {
		userLogged = response.data;
		if (userLogged.newPass == true) {
			window.location.href = "cambiaPassword.html?id=" + userLogged._id;
		}
		else if (userLogged._id != "661e9ba776dfea22a9fbd290") {
			$("#containerAdmin").hide();
			$("#containerUsers").show();
		}
		else {
			$("#containerUsers").hide();
			$("#containerAdmin").show();
		}
	});
	rq.catch(errore);
}



function base64Convert(fileObject) {
	return new Promise((resolve, reject) => {
		let reader = new FileReader();
		reader.readAsDataURL(fileObject);
		// event viene passato a tutte le procedure Javascript e contiene 
		// un parametro chiamato target che rappresenta il puntatore all'elemento 
		// che ha scatenato l'evento
		reader.onload = (event) => {
			// resolve(reader.result);
			resolve(event.target.result);
		}
		reader.onerror = (err) => {
			reject(err);
		}
	});
}



function visualizzaFoto(url, descrizione, codOperatore, _id) {
	_idInfo = _id;

	$("#imgPopup").attr("src", url);
	$("#txtAreaPop").val(descrizione);

	$("#overlay").fadeIn(1000);
}

function downloadImg() {
	// Ottieni l'URL dell'immagine
    let imgURL = $("#imgPopup").attr("src");

    // Effettua una richiesta AJAX per scaricare l'immagine
    $.ajax({
        url: imgURL,
        method: 'GET',
        xhrFields: {
            responseType: 'blob' // Imposta il tipo di risposta come blob
        },
        success: function(data) {
            // Crea un URL oggetto per il blob restituito dalla risposta
            let url = window.URL.createObjectURL(new Blob([data]));

            // Crea un elemento <a> per il download
            let downloadLink = document.createElement('a');
            downloadLink.href = url;

            // Imposta l'attributo 'download' per forzare il download del file con un nome specificato
            downloadLink.download = 'foto.jpg'; // Sostituisci 'nome_immagine' con il nome desiderato

            // Aggiungi l'elemento <a> al DOM
            document.body.appendChild(downloadLink);

            // Simula un click sull'elemento <a> per avviare il download
            downloadLink.click();

            // Rimuovi l'elemento <a> dal DOM
            document.body.removeChild(downloadLink);

            // Rilascia l'URL oggetto creato per il blob
            window.URL.revokeObjectURL(url);
        }
    });
}