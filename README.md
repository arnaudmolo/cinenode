CineNode (NodeJS)
=========
Serveur pour le site de jeu de rapidité et culture générale sur le Cinéma,
Lien vers le PHP :
https://github.com/dolly-prane/Cinequizz

Pour rajouter une room à la création, il suffit de rajouter son nom au tableau listCategory ligne 21.

Les objets précédés de '#' sont des objets Backbone. Les Models sont appelés par leurs noms avec leur première lettre en majuscule, et les collections par le nom de leur model suivi de List.

Les objets présents :
 * #User :
   * Attributs :
		 * _id,
		 * name,
		 * points,
		 * room,
         * classementTitle,
         * classementDirector,
         * classementActors,
         * auth,
         * socket
     * Methodes :
    	 * geters / seters de points & classements
    	 * Contact : permet d'envoyer les réponses des submits au client de l'utilisateur connecté grace au socket
    	 * Clean : Renvoi une version clean des users pour classement (supression des _id ... & co)
    	 * Disconect : déconnecte l'utilisateur coté client et serveur
    	 * reset : remet les places à 0
    	 * saveBdd : Sauvegarde dans la base de donnée les données pour classements

#UserList :
	 * Methodes :
		* sendAllUsers : renvoi tout les utilisateurs cleanés
		* comparator : trie la collection
		* reset : reset tout les users
		* hasName : si un utilisateur de la room as le nom demandé renvoi true 
		* saveBdd : sauvegarde les users connectés

#Show
	 * Attributs :
	     * title,
	         * vf,
	         * vo,
	     * actors,
	     * director,
	     * videos,
	     * classementTitle,
	     * classementDirector,
	     * classementActors,
	 * Methodes :
		 * seters pour classement
		 * chooseVideo : renvoi un extrait 



Chaque utilisateur est généré dans sa #Room à la connexion par socketIO, communiqueras la room dans laquelle il s'est connecté, ainsi que son Id si il est connecté.

En fonction de ces informations, il  
