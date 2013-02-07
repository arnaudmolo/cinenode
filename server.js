var http    =   require('http');
var fs      =   require('fs');
var url     =   require('url');
var _ = require('lodash/lodash.underscore'),
    Backbone = require('backbone');
// Creation du serveur
var request = require('request');
var server = http.createServer();

var io = require('socket.io');

// Socket io ecoute maintenant notre serverlication !
io = io.listen(server);
// Variables globales
// Ces variables resteront durant toute la vie du seveur pour et sont commune pour chaque client (node server.js)
// liste des messages de la forme { pseudo : 'Mon pseudo', message : 'Mon message' }
//// Application Backbone ////
var options = {
  host: '127.0.0.1',
  port: 80,
  path: '/Cinequizz/api/lol'
};

Backbone.sync = function(method, model, options){
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
app.User = Backbone.Model.extend({
    defaults: {
        _id: _.uniqueId(),
        name: 'User',
        points: 0,
        room: '',
        completed: false
    },
    idAttribute: '_id',
    initialize: function(){this.save({_id: _.uniqueId()})},
    toggle: function() {this.save({completed: !this.get('completed')})},
    addPoints: function(p){this.save({points: this.get('points')+p})},
    auth: function(){return true;}
});
app.Show = Backbone.Model.extend({
    defaults: {
        name: 'Show',
        actors: {},
        realisator: {},
    },
});
var UserList = Backbone.Collection.extend({
    model: app.User,
    sendAllUsers: function(){return this.models},
});

var ShowList = Backbone.Collection.extend({
    model: app.Show,
});

app.Room = Backbone.Model.extend({
    defaults: {
        name: String,
        users: new UserList(),
        shows: new ShowList(),
    }
});

var RoomList = Backbone.Collection.extend({
    model: app.Room
});

var ShowList = Backbone.Collection.extend({
    model: app.Show,
    defaults: {
        type: String,
    },
    initialize: function(){
        var model = this;
        request(
            { method: 'GET',
            uri: 'http://127.0.0.1/Cinequizz/api/lol',
            multipart: 
              [ { 'content-type': 'application/json',
              body: JSON.stringify(
                {foo: 'bar', _attachments: {'message.txt': {follows: true, length: 18, 'content_type': 'text/plain' }}})},
              { body: 'I am an attachment' }
              ] 
            },
        function(error, response, body){
            var shows = JSON.parse(body);
            _.each(shows, function(show){
                model.create(show);
            });
        });
    }
});
// Déclarer les room que l'ont va utiliser
app.Rooms = new RoomList();
app.Rooms.create({id: 'aventure', users: new UserList(), shows: new ShowList()});
app.Rooms.create({id: 'scifi', users: new UserList(), shows: new ShowList()});
app.Rooms.create({id: 'comic', users: new UserList(), shows: new ShowList()});

console.log(app.Rooms.get('aventure'));


// Quand une personne se connecte au serveur

io.sockets.on('connection', function (socket) {
    var roomUsersList;
    var roomShowsList;
    var room;
    var me = false;
    socket.on('addUser', function(user){
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
        }
        console.log('ouiouioui___________________');
        socket.in(me.get('room')).emit('sendShows', roomShowsList);
        socket.join(me.get('room'));
        socket.in(me.get('room')).emit('sendUsers', roomUsersList.sendAllUsers());
        socket.broadcast.in(me.get('room')).emit('newUser', me);
        socket.in(me.get('room')).emit('error', me);
    });
    socket.on('submit', function(prop){
        console.log(prop);
    });
    socket.on('disconnect', function () {
        socket.broadcast.emit('disconnectUser', me.id);
        roomUsersList.remove(me);
    });
});
// Notre serverlication ecoute sur le port 8080
server.listen(8080);
console.log('Live Chat server running at http://localhost:8080/');