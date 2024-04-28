"use strict"

$(document).ready(function () {
	let _username = $("#usr")
	let _password = $("#pwd")
	let _lblErrore = $("#lblErrore")
	let lblMail = $("#lblMail")
	_lblErrore.hide();
	lblMail.hide();


	$("#btnLogin").on("click", controllaLogin)

	$("#btnGoogle").on("click", function () {
		/*global google*/
		google.accounts.id.initialize({
			"client_id": oAuthId,
			"callback": function (response) {
				if (response.credential !== "") {
					let token = response.credential
					console.log("token:", token)
					localStorage.setItem("token", token)
					/* window.location.href = "index.html" oppure */
					let request = inviaRichiesta("POST", "/api/googleLogin");
					request.then(function (response) {
						let _id = response.data._id;
						window.location.href = `index.html?id=${_id}`
					});
					request.catch(errore);
				}
			}
		})
		google.accounts.id.renderButton(
			document.getElementById("googleDiv"), // qualunque tag DIV della pagina
			{
				"theme": "outline",
				"size": "large",
				"type": "standard",
				"text": "continue_with",
				"shape": "rectangular",
				"logo_alignment": "center"
			}
		);
		google.accounts.id.prompt();
	})

	$("#btnRecuperaPassword").on("click", function () {
		if (_username.val() == "") {
			_username.addClass("is-invalid");
			_username.prev().addClass("icona-rossa");
		} else {
			let rq = inviaRichiesta("POST", "/api/nuovaPassword", { "username": _username.val() });
			rq.then(function (response) {
				console.log(response.data);
				$("txtMail").text("Password inviata alla mail: " + $("#usr").val());
				lblMail.show();
				_lblErrore.hide();
			})
			rq.catch(errore);

		}

	})

	// il submit deve partire anche senza click 
	// con il solo tasto INVIO
	$(document).on('keydown', function (event) {
		if (event.keyCode == 13)
			controllaLogin();
	});


	function controllaLogin() {
		_username.removeClass("is-invalid");
		_username.prev().removeClass("icona-rossa");
		_password.removeClass("is-invalid");
		_password.prev().removeClass("icona-rossa");

		_lblErrore.hide();

		if (_username.val() == "") {
			_username.addClass("is-invalid");
			_username.prev().addClass("icona-rossa");
		}
		else if (_password.val() == "") {
			_password.addClass("is-invalid");
			_password.prev().addClass("icona-rossa");
		}
		else {
			let request = inviaRichiesta('POST', '/api/login',
				{
					"username": _username.val(),
					"password": _password.val()
				}
			);
			request.catch(function (err) {
				if (err.response.status == 401) {
					$("#lblMail").hide();
					_lblErrore.show();
					console.log(err.response.data);
				}
				else {
					errore(err);
				}
			});
			request.then((response) => {
				let _id = response.data._id;
				window.location.href = `index.html?id=${_id}`;
			})
		}
	}


	_lblErrore.children("button").on("click", function () {
		_lblErrore.hide();
	})
	lblMail.children("button").on("click", function () {
		lblMail.hide();
	})

});