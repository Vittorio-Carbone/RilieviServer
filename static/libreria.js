"use strict";

const _URL = ""
// Se vuota viene assegnata in automatico l'origine da cui è stata scaricata la pagina

// Configurazione degli interceptors di axios
axios.interceptors.request.use((config) => {
	let token = localStorage.getItem("token");
	if (token) {
		console.log(`Token sent: ${token}`);
		config.headers["authorization"] = token;
	}
	return config;
});

axios.interceptors.response.use((response) => {
	let token = response.headers["authorization"];
	console.log(`Token received: ${token}`);
	localStorage.setItem("token", token);
	return response;
});

function inviaRichiesta(method, url, parameters = {}) {
	let config = {
		"baseURL": _URL,
		"url": url,
		"method": method.toUpperCase(),
		"headers": {
			"Accept": "application/json",
		},
		"timeout": 15000,
		"responseType": "json",
	}

	if (parameters instanceof FormData) {
		config.headers["Content-Type"] = 'multipart/form-data;'
		config["data"] = parameters     // Accept FormData, File, Blob
	}
	else if (method.toUpperCase() == "GET") {
		config.headers["Content-Type"] = 'application/x-www-form-urlencoded;charset=utf-8'
		config["params"] = parameters
	}
	else {
		config.headers["Content-Type"] = 'application/json; charset=utf-8'
		config["data"] = parameters
	}
	return axios(config)
}

function errore(err) {
	if (!err.response)
		alert("Connection Refused or Server timeout");
	else if (err.response.status == 200)
		alert("Formato dei dati non corretto : " + err.response.data);
	else if (err.response.status == 403) {
		window.location.href = "login.html"
	}
	else {
		alert("Server Error: " + err.response.status + " - " + err.response.data);
	}
}

const URL_MAPS = "https://maps.googleapis.com/maps/api"
const MAP_KEY = "AIzaSyBZKYgxbiyRE7DknUpnRP2QHCBVjvLgH7g"
function caricaGoogleMaps(){
	let promise =  new Promise(function(resolve, reject){
		var script = document.createElement('script');
		script.type = 'text/javascript';
		script.src = URL_MAPS + '/js?v=3&key=' + MAP_KEY;
		document.body.appendChild(script);
		script.onload = resolve; 
		script.onerror = reject; 
		script.onerror = function (){
			throw new Error("Errore caricamento GoogleMaps")
		} 
	})
	return promise
}
