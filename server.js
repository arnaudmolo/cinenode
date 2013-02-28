var http    =   require('http');
var _ = require('lodash/lodash'),
    Backbone = require('backbone');
var request = require('request');
var server = http.createServer();

var io = require('socket.io');

io = io.listen(server, {log: false});
//// Application Backbone ////

Backbone.sync = function(method, model, options){ // Réécrire le backbone.sync car aucune sync n'est nécéssaire
    options || (options = {});
    switch (method) {
        case 'create':
        console.log('create');
        break;

        case 'update':
        console.log('update');
        break;

        case 'delete':
        console.log('delete');
        break;

        case 'read':
        console.log('read');
        break;
    }
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
        completed: false,
    },
    idAttribute: '_id',
    initialize: function(){this.save({_id: _.uniqueId()})},     //Génère un ID unique pour chaque utilisateur
    toggle: function() {this.save({completed: !this.get('completed')})},
    addPoints: function(p){                     // Ajoute des points
        this.save({points: this.get('points') + p.points });
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
        };
        this.get('socket').emit('responseSubmit', response);
    },
    auth: function(){return true;},             // Vérifie l'authentification
    clean: function(){
        return {_id: this.id, name: this.attributes.name, points: this.get('points'), room: this.attributes.room}; //Retourne l'utilisateur sans ses données sensibles
    },
    disconnect: function(){                     // Déconnecte l'utilisateur
        this.socket.in(this.room).emit('disconnect', this.clean());
    },
    reset: function(){                          // Remet les classements de l'utilisateur à 0
        this.set('classementTitle', 0);
        this.set('classementDirector', 0);
        this.set('classementActors', 0);
    }
});

// Déclaration du model Show #Show
app.Show = Backbone.Model.extend({
    defaults: {
        title: {
            vf:String,
            vo:String,
        },
        actors: [],
        director: [],
        videos: [],
        classementTitle: 0,
        classementDirector: 0,
        classementActors: 0,
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
        console.log(this.get('videos').length);
        return this.get('videos')[Math.floor(Math.random()*this.get('videos').length)];
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
    reset: function(){                          // Reset tout les utilisateurs
        _.each(this.models, function(user){
            user.reset();
        });
    }
});

// Déclaration de la collection contenant les show #showList
var ShowList = Backbone.Collection.extend({
    model: app.Show,
    defaults: {
        type: String,
    },
    initialize: function(e){
        console.log('http://127.0.0.1/Cinequizz/movies/category/'+e);
        var model = this;
        console.log(this);
        request({                   // Get la page dédiée a cette application
            method: 'GET',
            uri: 'http://127.0.0.1/Cinequizz/movies/category/aventure',
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
                })
                show.actors = actors;
                show.director = directors;
                show.videos = videos;
                model.create(show);
            });
        });
    },
    getNextShow: function(){return this.shift();}   // Retourne le prochain show de la collection et le supprime
});

// Déclaration du model correspondant aux différentes chambres dans lesquels défient les utilisateurs #room
app.Room = Backbone.Model.extend({
    defaults: {
        name: String,
        users: {},      // Une room contient des utilisateurs
        shows: {},      // Une room contient différents films
        show: false,                // Défini le show qui est actuellement sujette au quizz
    },
    reboot: function(){             // Redémare la room
        io.sockets.in(this.get('room')).emit('disconnect')  // Kick les utilisateurs
        this.set('shows', new ShowList(this.get('id')))     // Régénère les show contenus dans la room
        this.set('show', false)     // Supprime show quizzé
    },
    start: function(){              // Initialise le jeu
        if (!this.get('show')) {    // Si le show ne contient rien [CAD = room pas encore initialisée]
            model = this;           // Pointeur pour le setTimeout
            setTimeout(function(){  // Attendre 2 secondes pout lancer le premier show
                console.log('TIMEOUT BEBE')
                model.nextShow()    // Lance la partie
            }, 2000);
        };
    },
    nextShow: function(){
        var next = this.get('shows').getNextShow() //   Récupère le prochain show de la showList
        console.log(this.get('shows').models)
        if (next) {                 // Si il reste un show a quizzer
            var model = this;       // Pointeur pour setTimeout
            console.log("ici", next)    // Affiche le prochain show pour le débuggage
            this.get('users').reset()   // Reset les classements des utilisateurs pour leur permettre de rejouer
            io.sockets.in(this.get('room')).emit('nextShow', {show: this.get('show'), url: next.chooseVideo()}) // Envoi le show qui va se terminer pour l'afficher sur le client et l'url du prochain extrait 
            this.set('show', next) // Change le show par le prochain
            setTimeout(function(){ // Attendre 20 secondes
                model.nextShow()   // Et tout recommencer
            }, 20000)
        }else{                     // Si pas de show, on reboot
            console.log('nomore')
            this.reboot()
        }
    }
});
// Déclaration de la collection contenant les rooms #roomList
var RoomList = Backbone.Collection.extend({
    model: app.Room,
    initialize: function(){
        this.create({id: 'aventure', users: new UserList(), shows: new ShowList('aventure')}) // Crée la room Aventure
        // this.create({id: 'comédie', users: new UserList(), shows: new ShowList('comédie')}) // Crée la room Aventure
        // this.create({id: 'drame', users: new UserList(), shows: new ShowList('drame')}) // Crée la room Aventure
        // this.create({id: 'thriller', users: new UserList(), shows: new ShowList('thriller')}) // Crée la room Aventure
    },
});

app.Rooms = new RoomList() // Initialise la liste des rooms

// Quand une personne se connecte au serveur
io.sockets.on('connection', function (socket) {
    var room,
        roomUsersList,
        roomShowsList,
        me = false;

    socket.on('addUser', function(user){
        user.socket = socket;
        switch (user.room){
            case 'aventure':
                room = app.Rooms.get('aventure');
                roomUsersList = room.get('users');
                me = roomUsersList.create(user);
                roomShowsList = room.get('shows');
            break;
            case 'scifi':
                room = app.Rooms.get('scifi');
                roomUsersList = room.get('users');
                me = roomUsersList.create(user);
                roomShowsList = room.get('shows');
            break;
            case 'comic':
                room = app.Rooms.get('comic');
                roomUsersList = room.get('users');
                me = roomUsersList.create(user);
                roomShowsList = room.get('shows');
            break;
        };
        room.start();
        myRoom = me.get('room');
        socket.join(myRoom);
        socket.in(myRoom).emit('sendShows', roomShowsList);
        socket.in(myRoom).emit('sendUsers', roomUsersList.sendAllUsers());
        socket.broadcast.in(myRoom).emit('newUser', me.clean());
        socket.in(myRoom).emit('error', me.clean());
    });
    socket.on('next', function(){room.nextShow()});
    socket.on('submit', function(prop){
        var response = {message:{title:{r:false},actors: {r:false},director:{r:false}},classement:{title:0,actors: 0,director:0}};

        app.compare = function(category, prop, bonus){
            var upperCat = capitaliseFirstLetter(category);
                _.each(room.get('show').get(category), function(string){
                if (levenshtein(string, prop)<=string.length/2) {    // Si la proposition du joueur est proche du titre du film
                    if (me.get('classement'+upperCat)==0) { // Si l'utilisateur n'as pas déjà répondu 
                        response.points = 5;
                        if (room.get('show').get('classement' + upperCat)<=0) { // Si l'utilisateur est le premier a répondre au titre
                            response.points = response.points + bonus;
                        };
                        room.get('show')['increment' + upperCat]();

                        me['set'+upperCat](room.get('show').get('classement'+upperCat));
                        response.classement[category] = room.get('show').get('classement'+upperCat);
                        response.message[category].r = true;
                        response.message[category].text = 'Tu as répondu en ' + response.classement[category];
                    }else{
                        response.message[category].r = false;
                        response.message[category].text = 'Déja repondu';
                    };
                };
            });
        };
        app.compare('title', prop, 3);
        app.compare('director', prop, 2);
        app.compare('actors', prop, 2)
        me.contact(response);
    });
    socket.on('disconnect', function () {
        socket.broadcast.emit('disconnectUser', me.id);
        roomUsersList.remove(me);
    });
});
// Notre serverlication ecoute sur le port 8080
server.listen(8080);
console.log('Live Chat server running at http://localhost:8080/');

function capitaliseFirstLetter(string){
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function levenshtein(a, b){
    var i, j, cost, d = new Array(); 
    if(a.length==0){return b.length}
    if(b.length==0 ){return a.length}
    for(i=0;i<=a.length;i++){
        d[i]=new Array();
        d[i][0]=i;
    }
    for( j = 0 ; j <= b.length ; j++ ){ d[0][j] = j; }
    for( i = 1 ; i <= a.length ; i++ ){
        for ( j = 1; j <= b.length ; j++ ){
            if ( a.charAt(i-1) == b.charAt(j-1)){cost = 0;}
            else{cost = 1;} 
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
                )
            }
        }
    }
    return d[ a.length ][ b.length ];
}