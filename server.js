var http    =   require('http'),
    _ = require('lodash/lodash'),
    express = require('express'),
    Backbone = require('backbone'),
    request = require('request'),
    server = express.createServer(),
    Mongo = require('mongodb'),
    MongoClient = Mongo.MongoClient,
    BSON = Mongo.BSONPure,
    io = require('socket.io'),
    mongoUsers;

MongoClient.connect("mongodb://molo:projet_pumir@ds047217.mongolab.com:47217/af_pumir-dolly-pr4ne", function(err, db){
    if(err) { return console.dir(err); }
    mongoUsers = db.collection('users');
    mongoMovies = db.collection('movies');
   // mongoMovies.findOne();
});
io = io.listen(server, {log: false});

var listCategory = ['aventure', 'thriller', '1990s', '2000s', 'animation', 'drame'];

//// Application Backbone //// 

Backbone.sync = function(method, model, options){ // Réécrire le backbone.sync car aucune sync n'est nécéssaire
    switch (method) {case 'create':break;case 'update':break;case 'delete':break;case 'read':break;}
};
var app = {};

// Déclaration du model utilisateur #user
app.User = Backbone.Model.extend({
    defaults: {
        _id: '',
        name: 'User',
        points: 0,
        room: '',
        socket: {},
        classementTitle: 0,
        classementDirector: 0,
        classementActors: 0,
        auth: true
    },
    idAttribute: '_id',
    initialize: function(){
        if (this.get('_id')==='') {
            this.save({_id: _.uniqueId()});
            this.set('auth', false);
        }
    }, //Génère un ID unique pour chaque utilisateur
    addPoints: function(p){                     // Ajoute des points
        this.save({points: this.get('points') + p.points });
        this.collection.sort();
    },
    getName: function(){                        // Retourne le nom de l'utilisateur
        return this.get('name');
    },
    setTitle:function(nb){
        this.set('classementTitle', nb);        // Permet de mettre a jour le classement de l'utilisateur sur le title
    },
    setDirector:function(nb){
        this.set('classementDirector', nb);     // Permet de mettre a jour le classement de l'utilisateur sur les réalisateurs
    },
    setActors:function(nb){
        this.set('classementActors', nb);       // Permet de mettre a jour le classement de l'utilisateur sur les acteurs
    },
    contact: function(response){                // Envoi la réponse a l'utilisateur coté client
        if (response.message.title.r || response.message.director.r || response.message.actors.r) {
            this.addPoints({
                points: response.points, classement: {
                    title: response.classement.title,
                    director: response.classement.director,
                    actors: response.classement.actors
                }
            });
            io.sockets.in(this.get('room')).emit('addPoints', this.clean());
        }
        this.get('socket').emit('responseSubmit', response);
    },
    clean: function(){
        return {_id: this.id, name: this.attributes.name, points: this.get('points'), room: this.attributes.room}; //Retourne l'utilisateur sans ses données sensibles
    },
    disconnect: function(){                     // Déconnecte l'utilisateur
        this.get('socket').emit('disconnect');
    },
    reset: function(){                          // Remet les classements de l'utilisateur à 0
        this.set('classementTitle', 0);
        this.set('classementDirector', 0);
        this.set('classementActors', 0);
    },
    saveBdd: function(party){                   // Pour l'instant, party comporte : roomName, nbre_joueurs, position dans le classement
        if (this.get('auth')) {
            party.points = this.get('points');
            _id = new BSON.ObjectID(this.get('_id'));
            mongoUsers.findAndModify(
                {_id: _id},
                [['_id', 'asc']],
                {
                    $inc: {points: party.points, points_sem: party.points},
                    $pop: {parties: -1},
                    $push: {parties: party}
                },
                function(error, result){
                    if (result.bestGame<party.points) {
                        mongoUsers.findAndModify(
                            {_id: _id},
                            [['_id', 'asc']],
                            {
                                $set: {bestGame: party.points}
                            },
                            function(error, result){
                            }
                        );
                    }
                }
            );
        }
    }
});

// Déclaration du model Show #Show
app.Show = Backbone.Model.extend({
    defaults: {
        title: {
            vf:String,
            vo:String
        },
        actors: [],
        director: [],
        videos: [],
        classementTitle: 0,
        classementDirector: 0,
        classementActors: 0
    },
    incrementTitle:function(){                  // Chiffre le nombre de personnes ayant répondu au titre
        this.set('classementTitle', this.get('classementTitle') + 1);
    },
    incrementDirector:function(){               // Chiffre le nombre de personnes ayant répondu aux réals
        this.set('classementDirector', this.get('classementDirector') + 1);
    },
    incrementActors:function(){                 // Chiffre le nombre de personnes ayant répondu aux acteurs
        this.set('classementActors', this.get('classementActors') + 1);
    },
    chooseVideo: function(){                    // Renvoi un des extraits contenu dans Video 
        var d = this.get('videos')[Math.floor(Math.random()*this.get('videos').length)];
        if (d) {
            return d;
        }
        return 'http://h.fr.mediaplayer.allocine.fr/nmedia/18/82/69/35/19244272_ex2_m_004.mp4';
    }
});

// Déclaration de la collection contenant les utilisateurs #userList
var UserList = Backbone.Collection.extend({
    model: app.User,
    sendAllUsers: function(){                   //Renvoi tout les utilisateurs de manière a pourvoir les renvoyer a l'app sans données sensibles
        var d = [];
        _.each(this.models, function(model){
            d.push(model.clean());
        });
        return d;
    },
    comparator: function(user){
        return -user.get('points');
    },
    reset: function(){                          // Reset tout les utilisateurs
        _.each(this.models, function(user){
            user.reset();
        });
    },
    hasName: function(e){                       // Renvoi true si le nom est présent dans l'userlist
        var d = [];
        _.each(this.models, function(user){
            d.push(user.getName());
        });
        return _.contains(d, e);
    },
    saveBdd: function(roomName){
        col = this;
        _.each(this.models, function(user){
            user.saveBdd({room: roomName, nbre_joueurs: col.length, classement: 1});
        });
    }
});

// Déclaration de la collection contenant les show #showList
var ShowList = Backbone.Collection.extend({
    model: app.Show,
    defaults: {
        type: String
    },
    initialize: function(e, a){
        var model = this;
        request({                   // Get la page dédiée a cette application
            method: 'GET',
            uri: 'http://localhost/Cinequizz/movies/category/'+a.cat,
            multipart:[{
                    'content-type': 'application/json',
                    'charset': 'utf-8',
                    body: JSON.stringify({
                        foo: 'bar',
                        _attachments: {'message.txt':
                            {
                                follows: true,
                                length: 18,
                                'content_type': 'text/plain'
                            }
                        }
                    })
                },
                {body: 'I am an attachment'}
            ]
        },
        function(error, response, body){        // Quand la réponse du get arrive
            var show = {};
            var shows = JSON.parse(body);
            _.each(shows, function(showJson){
                var actors = Array();
                var directors = Array();
                var videos = Array();
                show.title = showJson.title;
                _.each(showJson.actors, function(actor){
                    actors.push(actor.name);
                });
                _.each(showJson.directors, function(director){
                    directors.push(director.name);
                });
                _.each(showJson.extracts, function(video){
                    videos.push(video.href);
                });
                show.actors = actors;
                show.director = directors;
                show.videos = videos;
                model.create(show);
            });
        });
    },
    getNextShow: function(){ // Retourne le prochain show de la collection et le supprime
        return this.shift();
    }
});

// Déclaration du model correspondant aux différentes chambres dans lesquels défient les utilisateurs #room
app.Room = Backbone.Model.extend({
    defaults: {
        name: String,
        users: {},              // Une room contient des utilisateurs
        shows: {},              // Une room contient différents films
        show: false,            // Défini le show qui est actuellement sujette au quizz
        nb: 0,                  // La position du show dans sa collection
        started: false
    },
    reboot: function(){             // Redémare la room
        this.get('users').saveBdd(this.get('id'));
        io.sockets.in(this.get('id')).emit('kick');   // Kick les utilisateurs
        // this.get('users').disconnect();
        this.set('users', new UserList());
        this.set('shows', new ShowList('', {cat:this.get('id')}));     // Régénère les show contenus dans la room
        this.set('show', false);     // Supprime show quizzé
        this.set('nb', 0);
        this.set('started', false);
    },
    start: function(){              // Initialise le jeu
        if (this.get('started')===false) {    // Si le show ne contient rien [CAD = room pas encore initialisée]
            this.set('started', true);
            model = this;           // Pointeur pour le setTimeout
            setTimeout(function(){  // Attendre 2 secondes pout lancer le premier show
                model.nextShow();   // Lance la partie
            }, 2000);
        }
    },
    nextShow: function(){
        var next = this.get('shows').getNextShow(); //   Récupère le prochain show de la showList
        var actual = this.get('show');
        console.log(next);
        if (next) {                 // Si il reste un show a quizzer
            this.set('nb', this.get('nb')+1);
            var model = this;       // Pointeur pour setTimeout
            this.get('users').reset();  // Reset les classements des utilisateurs pour leur permettre de rejouer
            io.sockets.in(this.get('id')).emit('nextShow', {show: actual, url: next.chooseVideo()});    // Envoi le show qui va se terminer pour l'afficher sur le client et l'url du prochain extrait 
            this.set('show', next);// Change le show par le prochain
            setTimeout(function(){ // Attendre 20 secondes
                model.nextShow();  // Et tout recommencer
            }, 20000);
        }else{                     // Si pas de show, on reboot
            console.log('nomore');
            this.reboot();
        }
    },
    hasUser: function(name){
        this.get('users').hasName(name);
    }
});
// Déclaration de la collection contenant les rooms #roomList
var RoomList = Backbone.Collection.extend({
    model: app.Room,
    initialize: function(){
        r = this;
        _.each(listCategory, function(a){
            r.create({id: a, users: new UserList(), shows: new ShowList('', {cat: a})}); // Crée la room Aventure
        });
        // this.create({id: 'aventure', users: new UserList(), shows: new ShowList('', {cat: 'aventure'})}) // Crée la room Commédie
        // this.create({id: 'thriller', users: new UserList(), shows: new ShowList('', {cat: 'thriller'})}) // Crée la room Commédie
        // this.create({id: 'thriller', users: new UserList(), shows: new ShowList('', {cat: 'thriller'})}) // Crée la room Thriller
    },
    hasUser: function(name){
        _.each(this.models, function(room){
            room.hasUser(name);
        });
    }
});

app.Rooms = new RoomList(); // Initialise la liste des rooms

// Quand une personne se connecte au serveur
io.sockets.on('connection', function (socket) {
    var room,
        roomUsersList,
        roomShowsList,
        d,
        me = false;

    socket.on('addUser', function(user){
        user.socket = socket;
        d = _.indexOf(listCategory, user.room);
        room = app.Rooms.get(listCategory[d]);
        roomUsersList = room.get('users');
        me = roomUsersList.create(user);
        roomShowsList = room.get('shows');

        room.start();                       // Initialise la room de l'utilisateur si celle ci n'est pas encore initialisée
        roomName = me.get('room');            // Récupération du nom de la room
        socket.join(roomName);                // Join l'user a la room socket.IO
        socket.in(roomName).emit('sendUsers', roomUsersList.sendAllUsers());  // envoi au nouveau connecté tout les utilisateurs déjà connectés de la room
        socket.broadcast.in(roomName).emit('newUser', me.clean());    // Envoi à toute la room le nouveau user (cleané)
    });
    socket.on('submit', function(prop){ // Reception de la submission de l'user
        var response = {message:{title:{r:false},actors: {r:false},director:{r:false}},classement:{title:0,actors: 0,director:0}, nb: room.get('nb')}; // initialisation de la réponse

        app.compare = function(category, prop, bonus){
            var upperCat = capitaliseFirstLetter(category);
            _.each(room.get('show').get(category), function(string){            // Pour le film actuellement séléctionné
                if (levenshtein(string, prop)<=string.length/2) {               // Si la proposition du joueur est proche du titre du show
                    if (me.get('classement'+upperCat) === 0) {                     // Si l'utilisateur n'as pas déjà répondu 
                        response.points = 5;                                    // Initialisation du nombre de points de base
                        if (room.get('show').get('classement' + upperCat)<=0) { // Si l'utilisateur est le premier a répondre au titre
                            response.points = response.points + bonus;          // Bonus de points pour le premier
                        }
                        room.get('show')['increment' + upperCat]();             // Incrémente le nombre de personnes ayant répondu au show
                        me['set'+upperCat](room.get('show').get('classement'+upperCat));    // Enregistre le classement dans l'utilisateur
                        response.classement[category] = room.get('show').get('classement'+upperCat); // Enregistre le classement pour la réponse
                        response.message[category].r = true;                    // L'utilisateur as eu une réponse valide
                        response.message[category].text = 'Tu as répondu en ' + response.classement[category];  // Message pour l'utilisateur
                        return;
                    }else if (response.message[category] === true){
                        response.message[category].r = false;                   // L'utilisateur as eu une réponse non valide
                        response.message[category].text = 'Déja repondu';       // Message pour l'utilisateur
                    }
                }
            });
        };
        app.compare('title', prop, 3);
        app.compare('director', prop, 2);   // Lance compare pour les 3 sujets du jeu
        app.compare('actors', prop, 2);
        me.contact(response);               // Envoi la réponse a l'utilisateur
    });
    socket.on('disconnect', function () {   // Quand l'user se déco
        try{
            socket.broadcast.emit('disconnectUser', me.id); // Dis a tout les autres que l'utilisateur se déco
            roomUsersList.remove(me);           // Enlève l'user de la liste des gens dans la room
        }catch(e){
            console.log('UNE ERREUR EST SURVENUE, C\'EST CHAUD');
        }
    });
});


server.get('/usernames/:username', function(req, res){ // Savoir si quelqu'un du même pseudo est déjà dans la room
    res.header("Access-Control-Allow-Origin", "*");
    if (app.Rooms.hasUser(req.params.username)) {
        res.send(true);
    }else{
        res.send(false);
    }
});

// Notre serverlication ecoute sur le port 8080
server.listen(8080);
console.log('Live Chat server running at http://localhost:8080/');



// Tips
function capitaliseFirstLetter(string){
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Calculateur de distance entre string
function levenshtein(a, b){
    var i,
        j,
        cost,
        d = [];
    if(a.length===0){return b.length;}
    if(b.length===0 ){return a.length;}
    for(i=0;i<=a.length;i++){
        d[i]=[];
        d[i][0]=i;
    }
    for( j = 0 ; j <= b.length ; j++ ){ d[0][j] = j; }
    for( i = 1 ; i <= a.length ; i++ ){
        for ( j = 1; j <= b.length ; j++ ){
            if ( a.charAt(i-1) == b.charAt(j-1)){cost = 0;}else{cost = 1;}
            d[i][j] = Math.min( d[i-1][j] + 1, d[i][j-1]+1, d[i-1][j-1] + cost );
            if(
                i > 1 &&
                j > 1 &&
                a.charAt(i - 1) == b.charAt(j-2) &&
                a.charAt(i-2) == b.charAt(j-1)
            ){
                d[i][j] = Math.min(
                    d[i][j],
                    d[i - 2][j - 2] + cost
                );
            }
        }
    }
    return d[ a.length ][ b.length ];
}
