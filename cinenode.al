Envoi nick & room
Ouverture de l'appage
	Connection server.js
	envoi user + room (un seul objet ?) // Pourquoi mettre le nom des room dans les user ?
	[FILMS] AMD
	Si 1 dans la room
		Aller chercher 15 films dans la BDD. // Passer par FatFree ? Ou mongo direct ?
		Les stocker sur node collection Films
	préparer l'envoi des extraits

	// DEFINIR LA FORMURE POUR MARQUER DES POINTS(real, titre, acteurs);
	[USERS] AMD

	Envoyer connecting user
	vérifier auth
	si auth bon
		Envoyer l'utilisateur dans sa room
		Envoyer tout les users de la room
	sinon
		Erreur casse toi connard

	Prévoir un décompte serveurside 
	Envoyer les données référents aux extraits
	quand 75 des users ont fini de chargé la vidéo, commencer un décompte pour leur dire de se préparer
	Débloquer l'input
	A chaque entrée de l'input, vérifier clientside quelques conneries (taille de l'entrée, si la requette a déjç été envoyée ... etc) pour éviter des surcharges de requetes
	coté serveur, vérifier la validitée de la requete 
	