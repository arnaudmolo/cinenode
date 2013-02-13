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
        socket: {},
        completed: false
    },
    idAttribute: '_id',
    initialize: function(){this.save({_id: _.uniqueId()})},
    toggle: function() {this.save({completed: !this.get('completed')})},
    addPoints: function(p){
        this.save({points: this.get('points')+p});
        io.sockets.in(this.get('room')).emit('addPoints', this.clean());
    },
    auth: function(){return true;},
    clean: function(){
        return {_id: this.id, name: this.attributes.name, points: this.get('points'), room: this.attributes.room};
    },
    disconnect: function(){
        this.socket.in(this.room).emit('disconnect', this.clean());
    }
});
app.Show = Backbone.Model.extend({
    defaults: {
        title: 'Show',
        actors: [],
        realisator: [],
    },
});
var UserList = Backbone.Collection.extend({
    model: app.User,
    sendAllUsers: function(){
        var d = [];
        _.each(this.models, function(model){
            d.push(model.clean());
        });
        return d;
    },
});
var ShowList = Backbone.Collection.extend({
    model: app.Show,
    defaults: {
        type: String,
    },
    initialize: function(){
        var model = this;
        request({
            method: 'GET',
            uri: 'http://127.0.0.1/Cinequizz/api',
            multipart:[{
                    'content-type': 'application/json',
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
        function(error, response, body){
            var shows = JSON.parse(body);
            _.each(shows, function(show){
                model.create(show);
            });
        });
    }
});
app.Room = Backbone.Model.extend({
    defaults: {
        name: String,
        users: new UserList(),
        shows: new ShowList(),
        show: '',
    },
    start: function(){
        if (_.size(this.attributes.users.models)<=1) {
            this.attributes.show = this.attributes.shows.models[0];
        };
    },
    reboot: function(){
        _.each(this.attributes.users.models, function(user){
            user.disconnect();
        });
        this.attributes.shows = new ShowList();
    }
});

var RoomList = Backbone.Collection.extend({
    model: app.Room,
    initialize: function(){
        this.create({id: 'aventure', users: new UserList(), shows: new ShowList()});
        this.create({id: 'scifi', users: new UserList(), shows: new ShowList()});
        this.create({id: 'comic', users: new UserList(), shows: new ShowList()});
    },
});

// Déclarer les room que l'ont va utiliser
app.Rooms = new RoomList();
// Quand une personne se connecte au serveur

io.sockets.on('connection', function (socket) {
    var room;
    var roomUsersList;
    var roomShowsList;
    var me = false;
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
        myRoom = me.get('room');
        room.start();
        socket.join(myRoom);
        socket.in(myRoom).emit('sendShows', roomShowsList);
        socket.in(myRoom).emit('sendUsers', roomUsersList.sendAllUsers());
        socket.broadcast.in(myRoom).emit('newUser', me.clean());
        socket.in(myRoom).emit('error', me.clean());
    });
    socket.on('submit', function(prop){
        if (levenshtein(room.attributes.show.attributes.title, prop)<=2) {
            var p = 5;
            me.addPoints(p);
        }else{
            socket.emit('submitError');
        };
    });
    socket.on('disconnect', function () {
        socket.broadcast.emit('disconnectUser', me.id);
        roomUsersList.remove(me);
    });
});
// Notre serverlication ecoute sur le port 8080
server.listen(8080);
console.log('Live Chat server running at http://localhost:8080/');

//based on: http://en.wikibooks.org/wiki/Algorithm_implementation/Strings/Levenshtein_distance
//and:  http://en.wikipedia.org/wiki/Damerau%E2%80%93Levenshtein_distance
function levenshtein( a, b ){
    var i;
    var j;
    var cost;
    var d = new Array();
 
    if ( a.length == 0 )
    {
        return b.length;
    }
 
    if ( b.length == 0 )
    {
        return a.length;
    }
 
    for ( i = 0; i <= a.length; i++ )
    {
        d[ i ] = new Array();
        d[ i ][ 0 ] = i;
    }
 
    for ( j = 0; j <= b.length; j++ )
    {
        d[ 0 ][ j ] = j;
    }
 
    for ( i = 1; i <= a.length; i++ )
    {
        for ( j = 1; j <= b.length; j++ )
        {
            if ( a.charAt( i - 1 ) == b.charAt( j - 1 ) )
            {
                cost = 0;
            }
            else
            {
                cost = 1;
            }
 
            d[ i ][ j ] = Math.min( d[ i - 1 ][ j ] + 1, d[ i ][ j - 1 ] + 1, d[ i - 1 ][ j - 1 ] + cost );
            
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