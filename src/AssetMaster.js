class AssetManager {
	constructor(game){
		this.game = game;

		this.images = {};
		this.atlases = {};
	}

//-----------------------------------------------ASSET POOLING------------------------------------------------------

	getImagePath(key){
		return this.images[key].path;
	}


//-----------------------------------------------ASSET LOADING------------------------------------------------------

	load(assetPath, callback){

		var split = assetPath.split(path.sep);
		var extension = split[split.length - 1].split('.').pop();
		var filename = split[split.length - 1].split('.')[0];

		switch(extension){
			case 'png':
			case 'gif':
			case 'jpeg':
			case 'jpg':
					if (this.game.cache.checkImageKey(filename)){

						callback.call(null, filename);
						
					} else {

						this.loadImage(filename, assetPath, callback);
						this.images[filename] = {key: filename, path: assetPath};

					}
				break;
			case 'json':
				//TO DO: Load JSON, ask user what to load it as
				break;
		}
	}

	loadImage(key, path, callback){
		
		this.game.load.onLoadComplete.addOnce(function(){

			if (callback){
				callback.call(null, key);
			}

		}, this);

		this.game.load.image(key, path);
		this.game.load.start();
		

	}

	//Resets any display object using the image and then removes it from the cache
	//Then loads the new image and 
	swapLoadImage(key, path, callback){
		this.unloadImage(key);

		this.game.load.onLoadComplete.addOnce(function(){
		
			//Reset on swapped object textures to the new image
			var objects = Objects.Pool.getAllAsArray();
			for (var i = 0; i < objects.length; i++){
				console.log(objects[i]);
				if (objects[i].display.key == '__missing'){

					objects[i].display.loadTexture(key, 0);

				}

			}

			if (callback){
				callback.call(null, key);
			}

		}, this);

		this.game.load.image(key, path);
		this.game.load.start();

		Assets.Pool.addImage(key);
	}

	unloadImage(key){
		Assets.Pool.removeImage(key);	//Remove from asset pool
		
		//Reset objects that are using this texture
		var objects = Objects.Pool.getAllAsArray();
		for (var i = 0; i < objects.length; i++){

			if (objects[i].display.key == key){

				objects[i].display.loadTexture('__missing', 0);

			}

		}

		this.game.cache.removeImage(key, true);	//Remove from cache
	}

}
