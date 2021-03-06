var EventLink = {

	init(){

		MapMan.events = new EventManager();
		MapMan.ObjectPool = new ObjectPool(this.game);
		MapMan.ObjectFactory = new ObjectFactory(this.game);
		MapMan.Scenes = new SceneMaster(Game);
		MapMan.Assets = new AssetManager(Game);
		MapMan.Tools = new ToolBox(Game);
		MapMan.Definitions = new DefinitionMaster(Game);
		MapMan.PhaserGroup = new Phaser.Group(this.game);

		MapMan.Settings = {

			settingsMap: {
					backgroundColor: (color) => { Game.stage.backgroundColor = color; },
					gridSize: (size) => { 
						MapMan.Tools.Grid.setSize(size);
						MapMan.Tools.Select.Scale.setHandleSnapSize(size); 
					},
					gridColor: (hexString) => { MapMan.Tools.Grid.setColor(parseInt(hexString.replace('#', '0x', 16))); },
					frameWidth: (width) => {}, //TBD
					frameHeight: (height) => {} //TBD
			},

			set: function(settings){
				for (var key in settings){
					if (settings[key] !== undefined){
						this.settingsMap[key](settings[key]);
					}
				}
			}

		}

		MapMan.globalReset = function(){
			this.events.trigger('globalReset');
		}

	},

	render(){

		var x = Math.floor((this.game.input.mousePointer.x + this.game.camera.x) * MapMan.Tools.Zoom.correctionFactor);
		var y = Math.floor((this.game.input.mousePointer.y + this.game.camera.y) * MapMan.Tools.Zoom.correctionFactor);

		this.game.debug.text('X: ' + x + ' Y: ' + y, 32, 32);
		this.game.debug.text('Scale Factor:' + MapMan.Tools.Zoom.scaleFactor, 32, 62);

	},

	create: function(){

		this.initEventLink();
		this.initDefaultScene();

	},

	initEventLink(){

		//Editor Components
		this.projectManager = new ProjectManager(this.game);
		this.stageManager = new StageManager(this.game);

		//UI Components
		this.layerView = new MapManView.LayerView();
		this.assetView = new MapManView.AssetView(document.getElementById('freewall'));
		this.toolbarView = new MapManView.ToolbarView();
		//this.paramView = new MapManView.ParamView();
		this.tabView = new MapManView.TabView('property-tabs');

		this.paramView = document.getElementById('object-param-list');
		this.propertyView = document.getElementById('prop-grid');
		this.assetPreview = document.getElementById('texture-preview');

		//Events
		this.addForms();
		this.addTabEvents();
		this.addMapManEvents();
		this.addLayerEvents();
		this.addObjectTabEvents();
		this.addSelectionEvents();
		this.addAssetViewEvents();
		this.addToolbarEvents();
		this.addMenuBarEvents();
		this.addKeyMapEvents();
	},

	initDefaultScene(){

		MapMan.Scenes.createScene();
		this.layerView.addLayer() //Will trigger layerAdded event - see layerEvents
		
	},

	addMapManEvents: function(){

		MapMan.events.on('globalReset', () => {

			//TO DO

		});

	},

	addForms(){

		//Object info in Object tab
		this.objectForm = new MapManView.FormView([{
											name: 'name',
											id: 'object-name',
											refresh: (wrapper) => { return wrapper.name; },
											onChange: (name) => {
												var wrapper = MapMan.Tools.Select.getSelection();

												if (wrapper){
													wrapper.setName(name);
													this.layerView.setObjectName(wrapper.id, name);
												}

											}
										},
										{
											name: 'type',
											id: 'object-type',
											refresh: (wrapper) => { return wrapper.definition.name }
										},
										{
											name: 'textureKey',
											id: 'texture-key',
											refresh: (wrapper) => { return wrapper.display.key }
										},
										{
											name: 'texturePreview',
											id: 'texture-preview',
											assign: 'style.backgroundImage',
											refresh: (wrapper) => { 
												return wrapper.imagePath ? 'url("' + wrapper.imagePath +'")' : "url()"; 
											}
										}
									]);


		this.preferenceForm = new MapManView.FormView([{
												name: 'backgroundColor',
												id: 'editor-color-pref',
											},
											{
												name: 'gridSize',
												id: 'grid-size-pref',
											},
											{
												name: 'gridColor',
												id: 'grid-color-pref',
											},
											{
												name: 'frameWidth',
												id: 'frame-width-pref',
											},
											{
												name: 'frameHeight',
												id: 'frame-height-pref',
											}
										]);

	},

	//Almost every tab displays information related to the current selection
	//Instead of mass updating each tab every time an object-modifying event 
	//occurs (which can be costly, performance-wise), the TabView informs only 
	//the active tab that it should update its display.
	addTabEvents(){

		var worldTab = {
			selectionChanged: () => {},
			selectionEdited: () => {},
		};

		var objectTab = {

			refresh: (wrapper) => {
				this.paramView.clear();

				if (wrapper) {
					this.paramView.addAll(wrapper.getParams());
					this.objectForm.refresh(wrapper);
				}

			},

			selectionChanged: (wrapper) => {
				this.paramView.clear();
				this.paramView.addAll(wrapper.getParams());
				this.objectForm.refresh(wrapper);
			},
			selectionEdited: (wrapper) => {
				this.paramView.setAll(wrapper.getParams());
			},
			unselect: () => {
				this.paramView.clear();
				this.objectForm.clear();
			}
		};
			
		var propertiesTab = {
			refresh: (wrapper) => {
				this.propertyView.clear();

				if (wrapper){
					this.propertyView.addAll(wrapper.getTracked());
				}
				
			},
			selectionChanged: (wrapper) => {
				this.propertyView.clear();
				this.propertyView.addAll(wrapper.getTracked());
			},
			selectionEdited: (wrapper) => {
				this.propertyView.setAll(wrapper.getTracked());
			},
			unselect: () => {
				this.propertyView.clear();
			}
		};

		this.tabView.addTab('world', worldTab);
		this.tabView.addTab('object', objectTab);
		this.tabView.addTab('properties', propertiesTab);
		this.tabView.setActive('world');

		this.tabView.events.on('tabSwitched', (activeTab) => {

			var wrapper = MapMan.Tools.Select.getSelection();

			this.tabView.triggerActive('refresh', wrapper);

		});

	},

	addObjectTabEvents(){

		/* 
		 * EVENT: A node is dragged from the AssetView and dropped onto the AssetPreview element
		 * RESPONSE: If the node represents an image file, it is loaded as a texture and applied to the selected object
		 * the object tab is then refreshed to reflect the change
		 */
		this.assetPreview.events.on('nodeDropped', id => {

			var node = this.assetView.getNode(id);

			if ([".gif", ".jpeg", ".jpg", ".png"].includes(node.data.ext)){

				var wrapper = MapMan.Tools.Select.getSelection();

				MapMan.Assets.load(node.data.path, (imageKey) => {

					if (wrapper){

						wrapper.display.loadTexture(imageKey);
						wrapper.imagePath = node.data.path;

						this.tabView.triggerActive('refresh', wrapper);
					}
					
				});

			}

		});

		this.paramView.events.on('parameterLinkToggled', (name) => {
			var wrapper = MapMan.Tools.Select.getSelection();

			if (wrapper){
				wrapper.toggleParamLink(name);

				this.paramView.clear();
				this.paramView.addAll(wrapper.getParams());
			}

		});

		this.paramView.events.on('parameterEdited', (name, value) => {
			var wrapper = MapMan.Tools.Select.getSelection();

			if (wrapper){
				wrapper.setParamValue(name, value);
			}

		});

	},

	addLayerEvents: function(){

		/* 
		 * EVENT: A layer is added in the LayerView
		 * RESPONSE: MapMan.Scenes points to the stage with the id passed from the event
		 * ALSO TRIGGERS: 'layerSwitched'
		 */
		this.layerView.events.on('layerAdded', (id) => {
			MapMan.Scenes.Active.addLayer(id);
			this.layerView.selectLayer(id);
		});

		/* 
		 * EVENT: Triggered when a layer node other than the active layer is selected
		 * RESPONSE: Active layer is changed
		 */
		this.layerView.events.on('layerSwitched', (layerId) => {
			MapMan.Tools.Select.unselect();
			MapMan.Scenes.Active.setActiveLayer(layerId);
		});

		/* 
		 * EVENT: Triggered when an object node is selected
		 * RESPONSE: Active layer is changed
		 * NOTE: May also trigger 'layerSwitched' event if the node is not a child of the active layer
		 */
		this.layerView.events.on('objectSelected', wrapperId => {
			MapMan.Tools.Select.unselect();
			MapMan.Tools.Select.select(MapMan.Scenes.Active.getWrapper(wrapperId));
		});


		/* 
		 * EVENT: The 'Delete Layer' button is pressed
		 * RESPONSE: Selected/Active layer and all objects within are deleted, this cannot be undone
		 * ALSO TRIGGERS: 'layerSwitched' (defaults to top layer in the stack)
		 */
		this.layerView.events.on('layerDeleted', (id) => {
			MapMan.Scenes.Active.deleteActiveLayer();
		});

		/* 
		 * EVENT: A layer is moved, triggered even if the layer is left in its original position
		 * RETURN: An array of layer ids in descending order
		 * RESPONSE: Each layer is brought to top, starting with the last element of the array and ending with the first
		 */
		this.layerView.events.on('layerMoved', (layerIds) => {
			MapMan.Scenes.Active.setLayerOrder(layerIds.reverse(), true);
		});

		/* 
		 * EVENT: Triggered when the 'visible' icon is toggled off in the layer view
		 * RESPONSE: All objects in the hidden layer are deactivated, but can still be selected via the layerview nodes
		 */
		this.layerView.events.on('layerHidden', (id) => {
			MapMan.Tools.Select.unselect();
			MapMan.Scenes.Active.hideLayer(id);
		});

		/* 
		 * EVENT: Triggered when the 'visible' icon is toggled on in the layer view
		 * RESPONSE: Reactivates a layer's objects
		 */
		this.layerView.events.on('layerUnhidden', (id) => {
			MapMan.Scenes.Active.unhideLayer(id);
		});

		this.layerView.events.on('layerNameEdited', (id, name) => {
			MapMan.Scenes.Active.setLayerName(id, name);
		});

	},

	addSelectionEvents: function(){

		MapMan.Tools.Select.events.on('selectionChanged', (wrapper) => {

			var wrapper = MapMan.Tools.Select.getSelection();

			if (wrapper){
				this.tabView.triggerActive('selectionChanged', wrapper);
				this.layerView.selectObject(wrapper.id);
			}

		});

		MapMan.Tools.Select.events.on('selectionEdited', (wrapper) => {
			var wrapper = MapMan.Tools.Select.getSelection()

			if (wrapper){
				this.tabView.triggerActive('selectionEdited', wrapper);
			}

		});

		MapMan.Tools.Select.events.on('unselect', () => {
			this.tabView.triggerActive('unselect');
		});

	},


	objectCreateHandler(x, y, meta){
		var definition = meta.definition ? meta.definition : MapMan.Definitions.getActive();
		var imageKey = meta.imageKey ? meta.imageKey : 'mapman-default';
		var imagePath = meta.imagePath ? meta.imagePath : 'resources/images/mapman-default.png';

		var newObj = MapMan.ObjectFactory.create(definition, imageKey);
					 MapMan.ObjectPool.add(newObj);

			newObj.imagePath = imagePath;

		this.layerView.addObject(newObj); //Add the object to the layer view
		this.stageManager.addToStage(x, y, newObj); //Add the object to the stage

		MapMan.PhaserGroup.add(newObj.display);
		MapMan.Tools.UILayers.restackTop(); //Restacks elements that should be above the game objects

		MapMan.Scenes.Active.add(newObj); //Add the new object to the active scene pool
		MapMan.Scenes.Active.setLayerOrder(this.layerView.getLayerOrder().reverse(), true); //Refresh the layer order

		return newObj;
	},

	addAssetViewEvents: function(){
/* 
		 * EVENT: Image dropped onto canvas from AssetView
		 * RESPONSE: Image is loaded if not already in cache, new Wrapper object is created
		 */
		this.assetView.events.on('assetDropped', (data, clientX, clientY) => {

			var pos = MapMan.Tools.Zoom.positionScaled((clientX - 50) + this.game.camera.x, (clientY - 25) + this.game.camera.y);

			if (data){

				if (data.ext === '.json'){

					this.projectManager.loadJSON(data.path).then( json => {
						switch (json.MapManType){
							case 'definition':

								this.objectCreateHandler(pos.x, pos.y, {
									definition: json,
									imageKey: 'mapman-default',
									imagePath: 'resources/images/mapman-default.png'
								});

								break;
							case 'prefab':
									
								break;

							case 'scene':
									
								break;

							console.log("TO DO: Account for prefab json on assetDropped event");
							console.log("TO DO: Account for scene json on assetDropped event");
							console.log("TO DO: Account for sprite atlas json on assetDropped event");
						}
					});

				} else {

					//If the asset dropped was not a json, it was probably an image file
					//Create new object of whatever type is currently active (default is sprite) with this image as its texture
					MapMan.Assets.load(data.path, (imageKey) => {

						this.objectCreateHandler(pos.x, pos.y, {
							definition: MapMan.Definitions.getActive(),
							imageKey: imageKey,
							imagePath: data.path
						});

					});

				}

			}

		});


		this.propertyView.events.on('propertyEntered', (name) => {

			var selection = MapMan.Tools.Select.getSelection();

			if (selection){

				var propData = selection.trackProperty(name);	//May be returned as an array if the property entered is actually a spread of multiple properties

				if (propData){
					if (propData instanceof Array){

						propData.forEach((prop) => {
							this.propertyView.add(prop.name, prop.value, prop.meta);
						});

					} else {

						this.propertyView.add(propData.name, propData.value, propData.meta);

					}
		
				}

			}

		});

		this.propertyView.events.on('propertyEdited', (name, value) => {

			console.log(name + " - " + value);

			var selection = MapMan.Tools.Select.getSelection();

			if (selection){
				selection.toDisplay(name, value);
			}
				
		});

		this.propertyView.events.on('propertyRemoved', (name) => {

			var selection = MapMan.Tools.Select.getSelection();

			if (selection){
				selection.untrack(name);
			}

		});

		/* 
		 * EVENT: A project.json file is found in the drag-and-dropped directory
		 * RESPONSE: Load the project settings
		 */
		this.assetView.events.on('projectDropped', (rootDir) => {

			this.projectManager.loadProject(rootDir);

			//TO DO: More stuff?

		});

	},

	addToolbarEvents: function(){

		this.toolbarView.btn('returnToOrigin', 'btn-origin');
		this.toolbarView.toggleBtn('grid', 'btn-grid');
		this.toolbarView.toggleBtn('frame', 'btn-frame');
		this.toolbarView.radioGroup('selectTool', 	[{
														name: 'Scale', 
														selector: 'btn-scale'
													},
													{
														name: 'Rotate',
														selector: 'btn-rotate'
													}]);

		this.toolbarView.events.on('selectToolToggled', (tool, active) => {
			MapMan.Tools.Select.setActiveTool(MapMan.Tools.Select[tool]);
		});

		/* 
		 * EVENT: Grid tool button is pressed
		 * RESPONSE: Draw or undraw grid and make objects snap to gridlines
		 */
		this.toolbarView.events.on('gridToggled', function(){
			MapMan.Tools.Grid.toggleGrid();
		}.bind(this));

		/* 
		 * EVENT: Frame tool button is pressed
		 * RESPONSE: Draw or undraw game frame
		 */
		this.toolbarView.events.on('frameToggled', function(){
			MapMan.Tools.Frames.toggleFrames();
		}.bind(this));


		/* 
		 * EVENT: Return-to-origin button is clicked
		 * RESPONSE: Move the camera back to the origin
		 */
		this.toolbarView.events.on('returnToOriginClicked', function(){
			MapMan.Tools.Zoom.resetZoom();
			this.game.camera.setPosition(0,0);
		}.bind(this));

		/*
		this.toolbarView.events.on('scaleToggled', function(){
			MapMan.Tools.Select.setActiveTool(MapMan.Tools.Select.Scale);
		}.bind(this));
		*/

	},

	addMenuBarEvents: function(){

		var File = {

					newProject: document.getElementById('file-new'),
					openProject: document.getElementById('file-open'),
					save: document.getElementById('file-save'),
					saveAs: document.getElementById('file-saveAs'),
					publish: document.getElementById('file-publish'),

					}

		var Edit = {

					undo: document.getElementById('edit-undo'),
					copy: document.getElementById('edit-copy'),
					paste: document.getElementById('edit-paste'),
					duplicate: document.getElementById('edit-duplicate'),
					preferences: document.getElementById('edit-preferences'),

					}


		/* 
		 * EVENT: "New Project" is clicked from menu bar
		 * RESPONSE: Create a new project directory and open the new project
		 */
		File.newProject.addEventListener('click', (event) => {

			this.projectManager.newProject( path => {
				if (path){

					this.assetView.reset();
					this.assetView.createRoot(path);
					this.projectManager.loadProject(path);


				} else {

					console.log("Something has gone terribly wrong...");

				}

			});

		});

		/* 
		 * EVENT: "Open Project" is clicked from menu bar
		 * RESPONSE: Prompts user to select project directory and then loads the project
		 */
		File.openProject.addEventListener('click', (event) => {	

			this.projectManager.openProject((rootDir) => {

				this.assetView.reset();
				this.assetView.createRoot(rootDir);
				this.projectManager.loadProject(rootDir);

			});
			
		});

		/* 
		 * EVENT: "Preferences" is clicked from menu bar
		 * RESPONSE: Preference modal menu is opened
		 */
		Edit.preferences.addEventListener('click', (event) => {	

			$( '#preference-menu' ).dialog({
				modal: true,
				width: 600,
				height: 300,
				resizable: false,
				buttons: {
					Apply: () => {
						$('#preference-menu').dialog('close');

						MapMan.Settings.set(this.preferenceForm.bundle());

					}
				}
			});
			
		});



	},

	addKeyMapEvents: function() {

/*  --------------------------------------------------------------------------------------------------
	|                                             DEV SHORTCUTS                                      |
	--------------------------------------------------------------------------------------------------	*/	

		//RELOAD
		Mousetrap.bind(['ctrl+r'], function(e) {
			remote.getCurrentWindow().reload();
		}.bind(this));

		//OPEN DEV TOOLS
		Mousetrap.bind(['ctrl+shift+i'], function(e) {
			remote.getCurrentWindow().openDevTools();
		}.bind(this));

		//
		this.testId = 0;
		Mousetrap.bind(['ctrl+q'], function(e) {
			this.layerView.addObject('testId'+this.testId++);
		}.bind(this));



/*  --------------------------------------------------------------------------------------------------
	|                                             MENU SHORTCUTS                                     |
	--------------------------------------------------------------------------------------------------	*/		

		//DELETE CURRENT SELECTION
		Mousetrap.bind(['del'], function(e) {

			var wrapper = MapMan.Tools.Select.getSelection();
			var wrapperGroup = MapMan.Tools.Select.getGroupSelection();

			if (wrapper){

				wrapper.delete();

				//Register action so it can be undone
				MapMan.Scenes.Active.action({
					type: 'Delete Object',
					undo: () => {
						wrapper.undelete();
						this.layerView.addObject(wrapper);
					}
				});

				this.layerView.removeObject(wrapper);

			} else if (wrapperGroup) {

				wrapperGroup.forEach((wrapper) => {
					wrapper.delete();
				});

				MapMan.Scenes.Active.action({
					type: 'Delete Group',
					undo: () => {
						wrapperGroup.forEach((wrapper) => {
							wrapper.undelete();
						});

						this.layerView.addObjects(wrapperGroup);

					}
				});

				this.layerView.removeObjects(wrapperGroup);
			}

			MapMan.Tools.Select.unselect();
			this.game.debug.reset();

		}.bind(this));

		//
		Mousetrap.bind(['ctrl+z'], function(e) {
			MapMan.Scenes.Active.undo();
		}.bind(this));



/*  --------------------------------------------------------------------------------------------------
	|                                             NAV SHORTCUTS                                      |
	--------------------------------------------------------------------------------------------------	*/	

		//DIRECTIONAL CONTROLS
		Mousetrap.bind(['up'], function(e) {

			this.game.world.pivot.y -= 32;
			//this.game.camera.y -= 32 *  MapMan.Tools.Zoom.scaleFactor * 2; //* MapMan.Tools.Zoom.scaleFactor;
	

			//this.game.camera.y -= MapMan.Tools.Grid.gridY * MapMan.Tools.Zoom.scaleFactor;

		}.bind(this));

		Mousetrap.bind(['down'], function(e) {

			this.game.world.pivot.y += 32;

			//this.game.camera.y -= -1 * MapMan.Tools.Grid.gridY * MapMan.Tools.Zoom.scaleFactor;

		}.bind(this));

		Mousetrap.bind(['left'], function(e) {

			this.game.world.pivot.x += 32;

			//this.game.camera.x -= MapMan.Tools.Grid.gridX * MapMan.Tools.Zoom.scaleFactor;

		}.bind(this));

		Mousetrap.bind(['right'], function(e) {

			this.game.world.pivot.x -= 32;

			//this.game.camera.x -= -1 * MapMan.Tools.Grid.gridX * MapMan.Tools.Zoom.scaleFactor;

		}.bind(this));


		//RETURN TO ORIGIN
		Mousetrap.bind(['ctrl+o'], function(e) {

			MapMan.Tools.Zoom.resetZoom();

		}.bind(this));

	}




}
