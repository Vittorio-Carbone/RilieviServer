import _https from "https";
import _url from "url";
import _fs from "fs";
import _express from "express";
import _dotenv from "dotenv";
import _cors from "cors";
import _fileUpload from "express-fileupload";
import _cloudinary, { UploadApiResponse } from 'cloudinary';
import _streamifier from "streamifier";
import _axios from "axios";
const _nodemailer = require("nodemailer");
import _bcrypt from "bcryptjs";
import _jwt from "jsonwebtoken";
import { google } from "googleapis";


// Lettura delle password e parametri fondamentali
_dotenv.config({ "path": ".env" });

// Configurazione Cloudinary
_cloudinary.v2.config({
    cloud_name: process.env.cloud_name,
    api_key: process.env.api_key,
    api_secret: process.env.api_secret
});

// Variabili relative a MongoDB ed Express
import { MongoClient, ObjectId } from "mongodb";
const DBNAME = process.env.DBNAME;
const connectionString: string = process.env.connectionStringAtlas;
const app = _express();

// Creazione ed avvio del server https, a questo server occorre passare le chiavi RSA (pubblica e privata)
// app è il router di Express, si occupa di tutta la gestione delle richieste https
const HTTPS_PORT: number = parseInt(process.env.HTTPS_PORT);
let paginaErrore;
const PRIVATE_KEY = _fs.readFileSync("./keys/privateKey.pem", "utf8");
const CERTIFICATE = _fs.readFileSync("./keys/certificate.crt", "utf8");
const ENCRYPTION_KEY = _fs.readFileSync("./keys/encryptionKey.txt", "utf8");
const CREDENTIALS = { "key": PRIVATE_KEY, "cert": CERTIFICATE };
const https_server = _https.createServer(CREDENTIALS, app);
// Il secondo parametro facoltativo ipAddress consente di mettere il server in ascolto su una delle interfacce della macchina, se non lo metto viene messo in ascolto su tutte le interfacce (3 --> loopback e 2 di rete)
https_server.listen(HTTPS_PORT, () => {
    init();
    console.log(`Server HTTPS in ascolto sulla porta ${HTTPS_PORT}`);
});

function init() {
    _fs.readFile("./static/error.html", function (err, data) {
        if (err) {
            paginaErrore = `<h1>Risorsa non trovata</h1>`;
        }
        else {
            paginaErrore = data.toString();
        }
    });
}

//********************************************************************************************//
// Routes middleware
//********************************************************************************************//

// 1. Request log
app.use("/", (req: any, res: any, next: any) => {
    console.log(`-----> ${req.method}: ${req.originalUrl}`);
    next();
});

// 2. Gestione delle risorse statiche
// .static() è un metodo di express che ha già implementata la firma di sopra. Se trova il file fa la send() altrimenti fa la next()
app.use("/", _express.static("./static"));

// 3. Lettura dei parametri POST di req["body"] (bodyParser)
// .json() intercetta solo i parametri passati in json nel body della http request
app.use("/", _express.json({ "limit": "50mb" }));
// .urlencoded() intercetta solo i parametri passati in urlencoded nel body della http request
app.use("/", _express.urlencoded({ "limit": "50mb", "extended": true }));

// 4. Aggancio dei parametri del FormData e dei parametri scalari passati dentro il FormData
// Dimensione massima del file = 10 MB
app.use("/", _fileUpload({ "limits": { "fileSize": (10 * 1024 * 1024) } }));

// 5. Log dei parametri GET, POST, PUT, PATCH, DELETE
app.use("/", (req: any, res: any, next: any) => {
    if (Object.keys(req["query"]).length > 0) {
        console.log(`       ${JSON.stringify(req["query"])}`);
    }
    if (Object.keys(req["body"]).length > 0) {
        console.log(`       ${JSON.stringify(req["body"])}`);
    }
    next();
});

// 6. Controllo degli accessi tramite CORS
// Procedura che lascia passare tutto, accetta tutte le richieste
const corsOptions = {
    origin: function (origin, callback) {
        return callback(null, true);
    },
    credentials: true
};
app.use("/", _cors(corsOptions));
/*
const whitelist = [
    "http://corneanugeorgealexandru-crudserver.onrender.com",	// porta 80 (default)
    "https://corneanugeorgealexandru-crudserver.onrender.com",	// porta 443 (default)
    "https://localhost:3000",
    "http://localhost:4200" // server angular
];
// Procedura che utilizza la whitelist, accetta solo le richieste presenti nella whitelist
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) // browser direct call
            return callback(null, true);
        if (whitelist.indexOf(origin) === -1) {
            var msg = `The CORS policy for this site does not allow access from the specified Origin.`
            return callback(new Error(msg), false);
        }
        else
            return callback(null, true);
    },
    credentials: true
};
app.use("/", _cors(corsOptions));
*/

// 7. Configurazione di nodemailer con utilizzo di username e password
/*
const auth = {
    "user": process.env.gmailUser,
    "pass": process.env.gmailPassword,
}
const transporter = _nodemailer.createTransport({
    "service": "gmail",
    "auth": auth
});
let message = _fs.readFileSync("./message.html", "utf8");
*/

// 8. Configurazione di nodemailer con utilizzo di oAuth2
const o_Auth2 = JSON.parse(process.env.oAuthCredential as any)
const OAuth2 = google.auth.OAuth2; // Oggetto OAuth2
const OAuth2Client = new OAuth2(
    o_Auth2["client_id"],
    o_Auth2["client_secret"]
);
OAuth2Client.setCredentials({
    refresh_token: o_Auth2.refresh_token,
});
let message = _fs.readFileSync("./message.html", "utf8");

// 9. Login
app.post("/api/login", async (req, res, next) => {
    console.log("LOGIN INIZIA")
    let username = req["body"].username;
    let pwd = req["body"].password;
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("periti");
    let regex = new RegExp(`^${username}$`, "i");
    let rq = collection.findOne({ "email": regex }, { "projection": { "email": 1, "password": 1 } });
    rq.then((dbUser) => {
        console.log(dbUser)
        if (!dbUser) {
            res.status(401).send("Username non valido");
        }
        else {
            _bcrypt.compare(pwd, dbUser.password, (err, success) => {
                if (err) {
                    res.status(500).send(`Bcrypt compare error: ${err.message}`);
                }
                else {
                    if (!success) {
                        res.status(401).send("Password non valida");
                    }
                    else {
                        let token = createToken(dbUser);
                        console.log(token);
                        res.setHeader("authorization", token);
                        // Fa si che la header authorization venga restituita al client
                        res.setHeader("access-control-expose-headers", "authorization");
                        rq.then((data) => { console.log(data); res.send(data) });
                    }
                }
            })
        }
    });
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});

// 10. Login con Google
app.post("/api/googleLogin", async (req: any, res: any, next: any) => {
    if (!req.headers["authorization"]) {
        res.status(403).send("Token mancante");
    }
    else {
        // Otteniamo il token completo
        let token = req.headers["authorization"];
        // Otteniamo il payload del token con una decodifica Base64
        let payload = _jwt.decode(token);
        let username = payload.email;
        console.log("USERNAME: " + username);
        const client = new MongoClient(connectionString);
        await client.connect();
        const collection = client.db(DBNAME).collection("periti");
        let regex = new RegExp(`^${username}$`, "i");
        console.log(regex.test("v.carbone.2225@vallauri.edu"));
        let rq = collection.findOne({ "email": regex }, { "projection": { "email": 1 } });
        rq.then((dbUser) => {
            if (!dbUser) {
                res.status(403).send("Username non autorizzato all'accesso");
            }
            else {
                let token = createToken(dbUser);
                console.log(token);
                res.setHeader("authorization", token);
                // Fa si che la header authorization venga restituita al client
                res.setHeader("access-control-expose-headers", "authorization");
                rq.then((data) => { console.log(data); res.send(data) });
            }
        });
        rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
        rq.finally(() => client.close());
    }
});


app.post("/api/nuovaPassword", async (req, res, next) => {
    // Genero un codice di 6 caratteri
    let password = Math.random().toString(36).substr(2, 6);

    let username = req["body"].username;
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("periti");
    let rq = collection.updateMany({ "email": username }, { "$set": { "password": _bcrypt.hashSync(password, 10), "newPass": true } });
    const transporter = _nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.AUTHUSER,
            pass: process.env.AUTHPASS
        }
    });


    let mailOptions = {
        from: process.env.AUTHUSER,
        to: "vittoriocarbone.vc.vc@gmail.com",
        subject: "Reimpostazione password",
        html: `
          
        
          <div class="content" style="padding: 20px;">
            <h2 style="font-size: 24px; margin-bottom: 10px;">Reimpostazione della password</h2>
        
            <p style="font-size: 16px; line-height: 1.5;">Ciao ${username},</p>
        
            <p style="font-size: 16px; line-height: 1.5;">Abbiamo ricevuto una richiesta di reimpostazione della password per il tuo account. Se non hai fatto questa richiesta, puoi ignorare questa email.</p>
        
            <p style="font-size: 16px; line-height: 1.5;">Altrimenti, la tua nuova password è:</p>
        
            <p style="font-size: 16px; line-height: 1.5; font-weight: bold; margin-bottom: 20px; border: 1px solid red; border-radius: 7px; text-align:center; padding: 10px; max-width: 250px">${password}</p>
        
            <p style="font-size: 16px; line-height: 1.5;">Ti consigliamo di cambiare la password al più presto possibile.</p>
            <p style="font-size: 16px; line-height: 1.5;">Effettua il login con questa password per cambiarla</p>
        
            <p style="font-size: 16px; line-height: 1.5;">Grazie.</p>
          </div>
        `
    }

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});


// 11. Controllo del token
app.use("/api/", (req: any, res: any, next: any) => {
    if (!req["body"].skipCheckToken) {
        if (!req.headers["authorization"]) {
            res.status(403).send("Token mancante");
        }
        else {
            let token = req.headers["authorization"];
            _jwt.verify(token, ENCRYPTION_KEY, (err, payload) => {
                if (err) {
                    res.status(403).send(`Token non valido: ${err}`);
                }
                else {
                    let newToken = createToken(payload);
                    console.log(newToken);
                    res.setHeader("authorization", newToken);
                    // Fa si che la header authorization venga restituita al client
                    res.setHeader("access-control-expose-headers", "authorization");
                    req["payload"] = payload;
                    next();
                }
            });
        }
    }
    else {
        next();
    }
});

function createToken(data) {
    let currentTimeSeconds = Math.floor(new Date().getTime() / 1000);
    let payload = {
        "_id": data._id,
        "username": data.username,
        // Se c'è iat mette iat altrimenti mette currentTimeSeconds
        "iat": data.iat || currentTimeSeconds,
        "exp": currentTimeSeconds + parseInt(process.env.TOKEN_DURATION)
    }
    let token = _jwt.sign(payload, ENCRYPTION_KEY);
    return token;
}

//********************************************************************************************//
// Routes finali di risposta al client
//********************************************************************************************//

// La .send() mette status 200 e fa il parsing. In caso di codice diverso da 200 la .send() non fa il parsing
// I parametri GET in Express sono restituiti in req["query"]
// I parametri POST, PATCH, PUT, DELETE in Express sono restituiti in req["body"]
// Se nella url ho /api/:parametro il valore del parametro passato lo troverò in req["params"].parametro
// Se uso un input:files il contenuto dei files li troverò in req["files"].nomeParametro
// nomeParametro contiene due campi principali: 
// nomeParametro.name contiene il nome del file scelto dal client
// nomeParametro.data contiene il contenuto binario del file
// _streamifier serve solo per aggiungere immagine binarie su Cloudinary
app.get("/api/user/:id", async (req, res, next) => {
    let id = new ObjectId(req["params"].id);
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("periti");
    let rq = collection.findOne({ "_id": id });
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});

app.get("/api/perizie", async (req, res, next) => {
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("perizie");
    let rq = collection.find().toArray();
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});
app.get("/api/periti", async (req, res, next) => {
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("periti");
    let rq = collection.find().toArray();
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});
app.get("/api/getPerito/:id", async (req, res, next) => {
    let id = new ObjectId(req["params"].id);
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("periti");
    let rq = collection.findOne({ "_id": id });
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});
app.patch("/api/modificaInfo/:id", async (req, res, next) => {
    let id = new ObjectId(req["params"].id);
    let json = req["body"].jsonInfo;
    console.log(json)
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("perizie");
    let rq = collection.updateOne({ "_id": new ObjectId(id) }, { "$set": json });
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});

app.post("/api/addOperator", async (req, res, next) => {
    let password = Math.random().toString(36).substr(2, 6);
    let json = req["body"].newOp;
    json.password = _bcrypt.hashSync(password, 10);
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("periti");
    let rq = collection.findOne({ "codOperatore": json.codOperatore });



    const transporter = _nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.AUTHUSER,
            pass: process.env.AUTHPASS
        }
    });


    let mailOptions = {
        from: process.env.AUTHUSER,
        to: "vittoriocarbone.vc.vc@gmail.com",
        subject: "Password",
        html: `
          
        
          <div class="content" style="padding: 20px;">
            <h2 style="font-size: 24px; margin-bottom: 10px;">Eccoti la tua password temporanea.</h2>
        
            <p style="font-size: 16px; line-height: 1.5;">Ciao ${json.nome} ${json.cognome},</p>
        
            <p style="font-size: 16px; line-height: 1.5;">Eccoti la tua nuova password è:</p>
        
            <p style="font-size: 16px; line-height: 1.5; font-weight: bold; margin-bottom: 20px; border: 1px solid red; border-radius: 7px; text-align:center; padding: 10px; max-width: 250px">${password}</p>
        
            <p style="font-size: 16px; line-height: 1.5;">Ti consigliamo di cambiare la password al più presto possibile.</p>
            <p style="font-size: 16px; line-height: 1.5;">Effettua il login con questa password per cambiarla!</p>
        
            <p style="font-size: 16px; line-height: 1.5;">Grazie.</p>
          </div>
        `
    }

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });






    rq.then(async function (data) {
        console.log(data);
        if (data) {
            res.status(409).send("Codice operatore già esistente");

        }
        else {
            const client = new MongoClient(connectionString);
            await client.connect();
            const collection = client.db(DBNAME).collection("periti");
            let rq2 = collection.insertOne(json);
            rq2.then((data) => res.send(data));
            rq2.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
            rq2.finally(() => client.close());
        }
    });
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});


app.post("/api/cambiaPassword", async (req, res, next) => {
    let id = new ObjectId(req["body"].id);
    let password = req["body"].currentPassword;
    let newPassword = req["body"].newPassword;
    console.log(id, password, newPassword)
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("periti");
    let rq = collection.findOne({ "_id": id });
    rq.then((data) => {
        _bcrypt.compare(password, data.password, async (err, success) => {
            if (err) {
                res.status(500).send(`Bcrypt compare error: ${err.message}`);
            }
            else {
                if (!success) {
                    res.status(401).send("Password non valida");
                }
                else {
                    const client = new MongoClient(connectionString);
                    await client.connect();
                    const collection = client.db(DBNAME).collection("periti");
                    let requ = collection.updateOne({ "_id": id }, { "$set": { "password": _bcrypt.hashSync(newPassword, 10), "newPass": false } });
                    requ.then((data) => res.send(data));
                    requ.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
                    requ.finally(() => client.close());
                }
            }
        })
    });
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});

app.post("/api/addBase64CloudinaryImage", (req, res, next) => {
    let codOp = req["body"].codOp;
    let imgBase64 = req["body"].imgBase64;
    console.log(codOp)
    _cloudinary.v2.uploader.upload(imgBase64, { "folder": "Es_03_Upload" })
        .catch((err) => {
            res.status(500).send(`Error while uploading file on Cloudinary: ${err}`);
        })
        .then(async function (response: UploadApiResponse) {
            const client = new MongoClient(connectionString);
            await client.connect();
            let collection = client.db(DBNAME).collection("periti");
            let rq = collection.findOne({ "codOperatore": codOp });
            console.log(response.secure_url)
            rq.then((data) => res.send({ "url": response.secure_url }));
            rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
            rq.finally(() => client.close());
        });
});

app.post("/api/addPerizia", async (req, res, next) => {
    let json = req["body"].newPerizia;
    console.log(json);
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("perizie");
    let rq = collection.findOne({ "codOperatore": json.codOperatore, "data": json.data, "ora": json.ora, "coordinate": json.coordinate });
    rq.then(async function (data) {
        console.log(data);
        if (data) {
            res.status(409).send("Perizia già esistente");

        }
        else {
            const client = new MongoClient(connectionString);
            await client.connect();
            const collection = client.db(DBNAME).collection("perizie");
            let rq2 = collection.insertOne(json);
            rq2.then((data) => res.send(data));
            rq2.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
            rq2.finally(() => client.close());
        }
    });
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});




app.post("/api/deleteOperator", async (req, res, next) => {
    let codOp = req["body"].codOp;
    let email = req["body"].email;
    console.log(codOp, email)
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("periti");
    let rq = collection.deleteOne({ "codOperatore": codOp, "email": email });
    rq.then(function (data) {
        console.log(data);
        if (data.deletedCount == 0) {
            res.status(404).send("Codice operatore non trovato");
        }
        else {
            res.send(data);
        }
    });
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});




app.post("/api/deletePerizia/:id", async (req, res, next) => {
    let id = new ObjectId(req["params"].id);
    console.log(id)
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("perizie");
    let rq = collection.deleteOne({ "_id": id });
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});








app.post("/api/addFotoPerizia/:id", async (req, res, next) => {
    let id = new ObjectId(req["params"].id);
    let imgs = req["body"].imgs;
    console.log(imgs)
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("perizie");
    let rq = collection.updateOne({ "_id": id }, { "$push": { "foto": { "$each": imgs } } });
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});

app.post("/api/modificaDescrizioneFoto/:id", async (req, res, next) => {
    let id = new ObjectId(req["params"].id);
    console.log(id)
    let descrizione = req["body"].descrizione;
    let img = req["body"].url;
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("perizie");
    let rq = collection.updateOne(
        { "_id": id, "foto.url": img },
        { "$set": { "foto.$.descrizioneFoto": descrizione } }
    );
    rq.then((data) => {
        const client = new MongoClient(connectionString);
        client.connect();
        const collection = client.db(DBNAME).collection("perizie");
        let requ = collection.findOne({ "_id": id });
        requ.then((data) => res.send(data));
        requ.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
        requ.finally(() => client.close());
    });
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});
app.get("/api/getPerizia/:id", async (req, res, next) => {
    let _id = new ObjectId(req["params"].id);
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("perizie");
    let rq = collection.findOne({ "_id": _id });
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});
app.get("/api/getPerizie/:cod", async (req, res, next) => {
    let cod = req["params"].cod;
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("perizie");
    let rq = collection.find({ "codOperatore": cod}).toArray();
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});
app.post("/api/deleteFotoPerizia/:id", async (req, res, next) => {
    let id = new ObjectId(req["params"].id);
    let img = req["body"].url;
    let descrizione = req["body"].descrizione;
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("perizie");
    let rq = collection.updateOne(
        { "_id": id },
        { "$pull": { "foto": { "url": img, "descrizioneFoto": descrizione } } }
    );
    rq.then(async (data) => {
        const client = new MongoClient(connectionString);
        await client.connect();
        const collection = client.db(DBNAME).collection("perizie");
        let requ = collection.findOne({ "_id": id });
        requ.then((data) => res.send(data));
        requ.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
        requ.finally(() => client.close());

    });
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});
//********************************************************************************************//
// Default route e gestione degli errori
//********************************************************************************************//

app.use("/", (req, res, next) => {
    res.status(404);
    if (req.originalUrl.startsWith("/api/")) {
        res.send(`Api non disponibile`);
    }
    else {
        res.send(paginaErrore);
    }
});

app.use("/", (err, req, res, next) => {
    console.log("************* SERVER ERROR ***************\n", err.stack);
    res.status(500).send(err.message);
});