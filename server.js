var http    =   require('http');
var fs      =   require('fs');
var url     =   require('url');
var _ = require('lodash/lodash.underscore'),
    Backbone = require('backbone');
// Creation du serveur
var server = http.createServer();

// Variables globales
// Ces variables resteront durant toute la vie du seveur pour et sont commune pour chaque client (node server.js)
// liste des messages de la forme { pseudo : 'Mon pseudo', message : 'Mon message' }
//// Application Backbone ////

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
    initialize: function(){
        this.save({
            _id: _.uniqueId()
        })
    },
    toggle: function() {
        this.save({
            completed: !this.get('completed')
        });
    },
    addPoints: function(p){
        this.save({
            points: this.get('points')+p
        })
    },
    auth: function(){
        var result = app.Users.search(this.get('name'));
        if (result) {

        };
        return true;
    }
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
    nextOrder: function() {
        if ( !this.length ) {
            return 1;
        }
        return this.last().get('order') + 1;
    },
    comparator: function( user ) {
        return user.get('order');
    },
    sendAllUsers: function(){
        var all = [];
        _.each(this.models, function(e){
            all[e.id] = {id: e.id, name: e.name, points: e.points};
        });
        return this.models;
    },
    search: function(letters){
        // var result;
        // if (letters=="") return this;
        // _.each(this.models, function(model){
        //     result = model.get('name')==letters;
        // });
        return true;
    }
});
app.Users = new UserList();

var ShowList = Backbone.Collection.extend({
    model: app.Show,
    nextOrder: function() {
        if ( !this.length ) {
            return 1;
        }
        return this.last().get('order') + 1;
    },
    comparator: function( show ) {
        return show.get('order');
    }
});
app.Shows = new ShowList();

//// SOCKET.IO ////

var io = require('socket.io');

// Socket io ecoute maintenant notre serverlication !
io = io.listen(server);

// Quand une personne se connecte au serveur

io.sockets.on('connection', function (socket) {
    var me = false;
    socket.on('addUser', function(user){
        if (app.Users.search(user.name)) {
            me = app.Users.create(user);
            socket.emit('sendUsers', app.Users.sendAllUsers());
            socket.broadcast.emit('newUser', me);
        }else{
            socket.emit('error', me);
        };
    });
    socket.on('disconnect', function () {
        socket.broadcast.emit('disconnectUser', me.id);
        app.Users.remove(me);
    });
});

///////////////////

// Notre serverlication ecoute sur le port 8080
server.listen(8080);
console.log('Live Chat server running at http://localhost:8080/');