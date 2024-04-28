$(document).ready(function () {
    let _lblErrore = $("#lblErrore");
    _lblErrore.hide();
    let msg=$("#msgErr");
    let params = new URLSearchParams(window.location.search);
	let _id = params.get('id');


    $("#btnCambia").on("click", function () {
        let currentPassword = $("#currentPassword").val();
        let newPassword = $("#newPassword").val();
        if(currentPassword == "" || newPassword == ""){
            msg.text("Inserisci tutti i campi");
            _lblErrore.slideDown(400);
        }
        else if(currentPassword == newPassword){
            msg.text("La nuova password non può essere uguale a quella attuale");
            _lblErrore.slideDown(400);
        }
        else{
            _lblErrore.slideUp(400);
            let rq=inviaRichiesta('POST', '/api/cambiaPassword',  { "id": _id, "currentPassword": currentPassword, "newPassword": newPassword });
            rq.then(function(response){
                window.location.href = "login.html";
            })
            rq.catch(errore);
        }
    });

    _lblErrore.children("button").on("click", function () {
		_lblErrore.slideUp(400);
	})
});