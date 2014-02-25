mp = mp || {};

LAYER_ID_AIRPORTS = 0;
LAYER_ID_UNITS = 1;
LAYER_ID_ANNOTATIONS = 2;
LAYER_ID_INACTIVE_ROUTES = 3;
LAYER_ID_ACTIVE_ROUTE_SEGMENTS = 4;
LAYER_ID_ACTIVE_WAYPOINTS = 5;

LAYER_ID_MAX = 5;

function formatLonLats(lonLat) {
//	lonLat.transform(map.getProjection(), "EPSG:4326");
	var lat = lonLat.lat;
	var long = lonLat.lon;
	var ns = OpenLayers.Util.getFormattedLonLat(lat);
	var ew = OpenLayers.Util.getFormattedLonLat(long,'lon');
	return ns + ', ' + ew + ' (' + (Math.round(lat * 10000) / 10000) + ', ' + (Math.round(long * 10000) / 10000) + ')';
}


mp.MapView = function(map_type) {
	var that = this;
	var vectorLayers;
	var features_by_object_id = {};
	this.map = null;

	init();

	function init() {
		// create map
		createMap(map_type);
		
		mp.debug.map = map;
		mp.debug.vectorLayers = vectorLayers;
		
		// draw objects
		$.each(mp.model.objects, function(_, obj) {
			redrawObject(obj);
		});

	}
	
	this.getMap = function() {
		return map;
	}
	
	function createMapFromBaseLayer(base_layer, map_arguments) {

		map = new OpenLayers.Map(OpenLayers.Util.extend({
			div:'map',
			center: new OpenLayers.LonLat(lon = 42.045493, lat = 42.240306).transform('EPSG:4326', 'EPSG:900913'),
			zoom: 8,
			//transitionEffect: null,
			zoomMethod: null,
			layers: [
				
				base_layer


			],
		}, map_arguments));
		var rExtent = new OpenLayers.Bounds(35, 40, 48, 46.5).transform('EPSG:4326', map.getProjection());
		map.setOptions({ restrictedExtent: rExtent });
		
		vectorLayers = [];
		vectorLayers.push(new OpenLayers.Layer.Vector("Airport Information by kosmos224", {
			strategies: [new OpenLayers.Strategy.Fixed()],
			protocol: new OpenLayers.Protocol.HTTP({
				url: "http://dcs-mission-planner.herokuapp.com/airports.kml",
				format: new OpenLayers.Format.KML({
					extractStyles: true,
					extractAttributes: true,
					maxDepth: 2,
				})
			}),
			renderers: ["Canvas"],
			projection: "EPSG:4326",
			styleMap: new OpenLayers.StyleMap({
			}),
		}));

		vectorLayers.push(new OpenLayers.Layer.Vector("Unit Display", {
			renderers: ["Canvas"],
			projection: "EPSG:4326",
			styleMap: new OpenLayers.StyleMap({
				"UNIT_AIRDEFENCE": new OpenLayers.Style(OpenLayers.Util.applyDefaults({
					externalGraphic: 'unitsymbols/AIRDEFENCE.svg',
					graphicWidth: 34,
					graphicHeight: 20,
					fillOpacity: 1,
				}, OpenLayers.Feature.Vector.style["default"])),
				"UNIT_ARMOR": new OpenLayers.Style(OpenLayers.Util.applyDefaults({
					externalGraphic: 'unitsymbols/ARMOR.svg',
					graphicWidth: 34,
					graphicHeight: 20,
					fillOpacity: 1,
				}, OpenLayers.Feature.Vector.style["default"])),
				'bullseye': new OpenLayers.Style(OpenLayers.Util.applyDefaults({
					externalGraphic: 'unitsymbols/bullseye_${coalition}.svg',
					graphicWidth: 35,
					graphicHeight: 35,
					fillOpacity: 1,
				}, OpenLayers.Feature.Vector.style["default"])),
			}),
		}));

		for (i=0; i<2; i++) {
			vectorLayers.push(new OpenLayers.Layer.Vector("Bottom Vector Layer", {
				renderers: ["Canvas"],
				projection: "EPSG:4326",
				styleMap: new OpenLayers.StyleMap({
					"waypoint": new OpenLayers.Style(OpenLayers.Util.applyDefaults({
						fillColor: "magenta",
						strokeColor: "magenta",
						strokeWidth: 1,
						graphicName: "square",
						rotation: 45,
						pointRadius: 2,
						fillOpacity: 1,
					}, OpenLayers.Feature.Vector.style["default"])),
					"waypoint_hover": new OpenLayers.Style(OpenLayers.Util.applyDefaults({
						fillColor: "blue",
						strokeColor: "blue",
						strokeWidth: 1,
						graphicName: "square",
						rotation: 45,
						pointRadius: 2,
						fillOpacity: 1,
					}, OpenLayers.Feature.Vector.style["default"])),
					"route_segment": new OpenLayers.Style(OpenLayers.Util.applyDefaults({
						strokeColor: "magenta",
						strokeWidth: 2,
						strokeOpacity: 1,
					}, OpenLayers.Feature.Vector.style["select"])),
					"route_segment_hover": new OpenLayers.Style(OpenLayers.Util.applyDefaults({
						strokeColor: "blue",
						strokeWidth: 2,
						strokeOpacity: 1,
					}, OpenLayers.Feature.Vector.style["select"])),
					"annotation": new OpenLayers.Style(OpenLayers.Util.applyDefaults({
						strokeColor: "red",
						fillColor: "red",
						strokeWidth: 2,
						strokeOpacity: .5,
						fillOpacity: .1,
					}, OpenLayers.Feature.Vector.style["select"])),
				}),
			}));
		}

		for (i=0; i<2; i++) {
			vectorLayers.push(new OpenLayers.Layer.Vector("Top Vector Layer", {
				renderers: ["Canvas"],
				projection: "EPSG:4326",
				styleMap: new OpenLayers.StyleMap({
					"waypoint": new OpenLayers.Style(OpenLayers.Util.applyDefaults({
						fillColor: "blue",
						strokeColor: "black",
						strokeWidth: 3,
						graphicName: "circle",
						rotation: 45,
						pointRadius: 7
					}, OpenLayers.Feature.Vector.style["default"])),
					"waypoint_hover": new OpenLayers.Style(OpenLayers.Util.applyDefaults({
						fillColor: "red",
						strokeColor: "red",
						strokeWidth: 3,
						graphicName: "circle",
						rotation: 45,
						pointRadius: 10
					}, OpenLayers.Feature.Vector.style["select"])),
					"route_segment": new OpenLayers.Style(OpenLayers.Util.applyDefaults({
						strokeColor: "blue",
						strokeWidth: 4,
						strokeOpacity: .7,
					}, OpenLayers.Feature.Vector.style["select"])),
					"route_segment_hover": new OpenLayers.Style(OpenLayers.Util.applyDefaults({
						strokeColor: "red",
						strokeWidth: 4,
						strokeOpacity: 1,
					}, OpenLayers.Feature.Vector.style["select"])),
					"processing": new OpenLayers.Style(OpenLayers.Util.applyDefaults({
						fillColor: "red",
						strokeColor: "red",
						strokeWidth: 3,
						graphicName: "square",
						rotation: 45,
						pointRadius: 5
					}, OpenLayers.Feature.Vector.style["default"])),
				}),
			}));
		}

		map.addLayers(vectorLayers);
		


		controls = {}
		
		controls.mousepos = new OpenLayers.Control.MousePosition( {id: "ll_mouse", formatOutput: function(ll) { return formatLonLats(ll.transform(map.getProjection(), 'EPSG:4326')); }} );
		map.addControl(controls.mousepos);
		
		//controls.scaleline = new OpenLayers.Control.ScaleLine();
		//map.addControl(controls.scaleline);
		
		this.inputHandler = new mp.MapView.InputHandler({
			map: map,
			vectorLayers: vectorLayers,
			mapView: this,
		});
		
	}
	
	this.getInputHandler = function() {
		return inputHandler;
	}


	
	function tad_getTileURL(bounds) {
		bounds = this.adjustBounds(bounds);
	        var res = this.getServerResolution();
		
	        var x = Math.round((bounds.left - this.tileOrigin.lon) / (res * this.tileSize.w));
	        var y = Math.round((bounds.bottom - this.tileOrigin.lat) / (res * this.tileSize.h));
	        var z = this.getServerZoom();
		
		if (this.mapBounds.intersectsBounds( bounds ) && z >= this.mapMinZoom && z <= this.mapMaxZoom) {
			// console.log( this.url + z + "/" + x + "/" + y + "." + this.type);
			return this.url + z + "/" + x + "/" + y + "." + this.type;
                } else {
			return "";
                }
	}


	function createMap(name) {
		switch(name) {
		case 'tad':
			createMapFromBaseLayer(
				new OpenLayers.Layer.TMS(
					'A-10 TAD 1:500000',
					'DCS theater/',
					{
						type: 'png',
						getURL: tad_getTileURL,
						'projection':'EPSG:4326',
						serverResolutions: [0.703125/1, 0.703125/2, 0.703125/4, 0.703125/8, 0.703125/16, 0.703125/32, 0.703125/64, 0.703125/128, 0.703125/256, 0.703125/512],
						units: 'degrees',
						mapBounds: new OpenLayers.Bounds( 37.0, 41.0, 46.0, 45.5), // for get_URL function
						mapMinZoom: 0,
						mapMaxZoom: 9,
					}
				)
			);
			break;

		case 'tad_sm':
			createMapFromBaseLayer(
				new OpenLayers.Layer.TMS(
					'A-10 TAD 1:500000 (Spherical Mercator)',
					'DCSTSM/',
					{
						type: 'png',
						getURL: tad_getTileURL,
						alpha: true,
						projection: new OpenLayers.Projection("EPSG:900913"),
						serverResolutions: [156543.0339/1, 156543.0339/2, 156543.0339/4, 156543.0339/8, 156543.0339/16, 156543.0339/32, 156543.0339/64, 156543.0339/128, 156543.0339/256, 156543.0339/512,  156543.0339/1024],
						mapBounds: new OpenLayers.Bounds( 37.0, 41.0003565974, 45.9995714377, 45.5).transform("EPSG:4326", "EPSG:900913"),
						mapMinZoom: 0,
						mapMaxZoom: 10,
					}
				),
				{ 	                maxExtent: new OpenLayers.Bounds(-20037508, -20037508, 20037508, 20037508.34) }
			);
			break;

		case 'dcs':
			createMapFromBaseLayer(
				new OpenLayers.Layer.TMS(
					'DCS: World',
					'dcs-map/DCS-EPSG4326/',
					{
						type: 'png',
						getURL: tad_getTileURL,
						'projection':'EPSG:4326',
						serverResolutions: [0.703125/1, 0.703125/2, 0.703125/4, 0.703125/8, 0.703125/16, 0.703125/32, 0.703125/64, 0.703125/128, 0.703125/256, 0.703125/512, 0.703125/1024, 0.703125/2048, 0.703125/4096, 0.703125/8192],
						units: 'degrees',
						mapBounds: new OpenLayers.Bounds( 37.0, 41.0, 46.0, 45.5), // for get_URL function
						mapMinZoom: 4,
						mapMaxZoom: 13,
					}
				)
			);
			break;

			
		case 'osm':
			createMapFromBaseLayer(
				new OpenLayers.Layer.OSM(
					{
						numZoomLevels: 20,
					}
				)
			);
			break;
			
		case 'google':
			createMapFromBaseLayer(
				new OpenLayers.Layer.Google(
					"Google Maps",
					{
						numZoomLevels: 20,
					})
			);
			break;
			
		case 'google_terrain':
			createMapFromBaseLayer(
				new OpenLayers.Layer.Google(
					"Google Maps",
					{
						type: google.maps.MapTypeId.TERRAIN,
						numZoomLevels: 20,
					})
			);
			break;
			
		case 'google_sat':
			createMapFromBaseLayer(
				new OpenLayers.Layer.Google(
					"Google Maps",
					{
						type: google.maps.MapTypeId.SATELLITE,
						numZoomLevels: 20,
					})
			);
			break;
			
		case 'google_hybrid':
			createMapFromBaseLayer(
				new OpenLayers.Layer.Google(
					"Google Maps",
					{
						type: google.maps.MapTypeId.HYBRID,
						numZoomLevels: 20,
					})
			);
			break;
		}

	}
        
	function updateSelectedFeatureGroupId(e, old_sel_id, new_sel_id) {
		$.each(mp.model.objects, function(_, obj) {
			if (obj.type === "CLIENT_ACFT_WAYPOINT") {
				if (obj.route_id === old_sel_id || obj.route_id === new_sel_id) {
					redrawObject(obj);
				}
			}
		});
	}
	$(document).on("update_selected_feature_group_id", updateSelectedFeatureGroupId);
	
	/* remove the features that display this object if neccessary,
	   then redraw it */
	function redrawObject(obj) {
		var i;
		if (features_by_object_id[obj.id]) {
			var featureList = features_by_object_id[obj.id];
			for (i=0; i<featureList.length; i++) {
				if (featureList[i].layer) featureList[i].layer.removeFeatures([featureList[i]]);
			}
		}
		if (obj.type === "CLIENT_ACFT_WAYPOINT") redrawClientAcftWaypoint(obj);
		if (obj.type === "LINEARRING_ANNOTATION") redrawLinearRingAnnotation(obj);
		if (obj.type === "UNIT") redrawUnit(obj);
		if (obj.type === "BULLSEYE") redrawBullseye(obj);
	}
	
	function redrawBullseye(obj) {
		var feature = new OpenLayers.Feature.Vector(
			new OpenLayers.Geometry.Point(obj.lon, obj.lat).transform("EPSG:4326", this.map.getProjection()),
			{
				'type': 'bullseye',
				'coalition': obj.coalition
			}
		);
		feature.renderIntent = "bullseye";
		
		features_by_object_id[obj.id] = [feature];
		vectorLayers[LAYER_ID_UNITS].addFeatures([feature]);
		vectorLayers[LAYER_ID_UNITS].redraw();
	}
	
	function redrawUnit(obj) {
		var feature = new OpenLayers.Feature.Vector();
		feature.geometry = new OpenLayers.Geometry.Point(obj.lon, obj.lat).transform('EPSG:4326', this.map.getProjection());
		
		features_by_object_id[obj.id] = [feature];
		feature.renderIntent = "UNIT_"+obj.unittype;
		feature.data.object_id = obj.id;
		
		vectorLayers[LAYER_ID_UNITS].addFeatures([feature]);
		vectorLayers[LAYER_ID_UNITS].redraw();
		
	}
	
	function redrawLinearRingAnnotation(obj) {
		var i;
		
		var feature = new OpenLayers.Feature.Vector();
		var linearRing = new OpenLayers.Geometry.LinearRing();
		for (i=0; i<obj.points.length; ++i) {
			var point = new OpenLayers.Geometry.Point(obj.points[i].lon, obj.points[i].lat).transform('EPSG:4326', this.map.getProjection());
			linearRing.addComponent(point);
		}
		feature.geometry = new OpenLayers.Geometry.Polygon([linearRing]);
		features_by_object_id[obj.id] = [feature];
		feature.renderIntent = "annotation";
		feature.data.type = "annotation";
		feature.data.object_id = obj.id;
		vectorLayers[LAYER_ID_ANNOTATIONS].addFeatures([feature]);
		vectorLayers[LAYER_ID_ANNOTATIONS].redraw();
	}
	
	function redrawClientAcftWaypoint(obj) {
		var i;
		var new_features = [];
		var wpt_feature = new OpenLayers.Feature.Vector(
			new OpenLayers.Geometry.Point(obj.lon, obj.lat).transform('EPSG:4326', map.getProjection()),
			{
				'type':'waypoint',
				'object_id':obj.id,
			}
		);
		wpt_feature.renderIntent = "waypoint";
		new_features.push(wpt_feature);

		if (obj.next_waypoint_id) {
			var next_wpt = mp.model.objects[obj.next_waypoint_id];
			var line_feature = new OpenLayers.Feature.Vector(
				new OpenLayers.Geometry.LineString([
					new OpenLayers.Geometry.Point(obj.lon, obj.lat).transform('EPSG:4326', map.getProjection()),
					new OpenLayers.Geometry.Point(next_wpt.lon, next_wpt.lat).transform('EPSG:4326', map.getProjection()),
				]),
				{
					'type':'route_segment',
					'object_id':obj.id,
				}
			);
			line_feature.renderIntent = "route_segment";
			new_features.push(line_feature);
		}

		features_by_object_id[obj.id] = new_features;
		if (mp.model.selected_feature_group_id == obj.route_id) {
			for (i=0; i<new_features.length; i++) {
				if (new_features[i].data.type == "waypoint") {
					vectorLayers[LAYER_ID_ACTIVE_WAYPOINTS].addFeatures([new_features[i]]);
				} else {
					vectorLayers[LAYER_ID_ACTIVE_ROUTE_SEGMENTS].addFeatures([new_features[i]]);
				}	
			}

		} else {
			vectorLayers[LAYER_ID_INACTIVE_ROUTES].addFeatures(new_features);
		}

	}

	function on_new_object(e, obj) {
		redrawObject(obj);
	}
	$(document).on("new_object", on_new_object);

	function on_update_object(e, obj) {
		redrawObject(obj);
	}
	$(document).on("update_object", on_update_object);
	
	function on_delete_object(e, obj) {
		if (features_by_object_id[obj.id]) {
			var featureList = features_by_object_id[obj.id];
			for (i=0; i<featureList.length; i++) {
				if (featureList[i].layer) featureList[i].layer.removeFeatures([featureList[i]]);
			}
		}
	}
	$(document).on("delete_object", on_delete_object);
	
	this.destroy = function() {
		$(document).off("new_object", on_new_object);
		$(document).off("update_object", on_update_object);
		$(document).off("delete_object", on_delete_object);
		$(document).off("update_selected_feature_group_id", updateSelectedFeatureGroupId);

		map.destroy();
	}

}


mp.MapView.InputHandler = OpenLayers.Class({
	lastMousePosition: null,
	hoveredFeature: null,
	activeFeature: null,
	logEvents: false,
	logStateTransitions: false,
	logStateInput: false,
	pixelTolerance: 4,
	stateMachine: {
		"idle": {
			featureEnter: function(args) {
				this.activeFeature = args.feature;
				this.activeFeature.renderIntent = this.activeFeature.data.type+"_hover";
				this.activeFeature.layer.redraw();
				$(this.map.div).css("cursor", "crosshair");
				this.doStateTransition("hover_feature");
			},
			leftup: function(args) {
				this.defaultLeftUpAction(args);
			},
			rightup: function(args) {
				this.mapRightclickPopup(args.mousePosition);
				return false;
			},
		},
		"hover_feature": {
			featureOut: function(args) {
				this.activeFeature.renderIntent = this.activeFeature.data.type;
				if (this.activeFeature.layer) this.activeFeature.layer.redraw();
				this.doStateTransition("idle");
				$(this.map.div).css("cursor", "default");
			},
			leftdown: function(args) {
				this.doStateTransition("mousedown_feature");
				return false;
			},
		},
		"mousedown_feature": {
			leftup: function(args) {
				var obj = mp.model.objects[this.activeFeature.data.object_id];

				if (obj.type == "CLIENT_ACFT_WAYPOINT" && obj.route_id != mp.model.selected_feature_group_id) {
					// clicked on an inactive route (on the bottom layer)
					mp.model.setSelectedFeatureGroupId(obj.route_id);
					this.doStateTransition("hover_feature");
					return false;
				}
				
				if (obj.type == "CLIENT_ACFT_WAYPOINT" && obj.route_id == mp.model.selected_feature_group_id && this.activeFeature.data.type == "waypoint") {
					this.clickWaypointPopup(this.activeFeature, args.mousePosition);
					this.doStateTransition("hover_feature");
					return false;
				}

				if (obj.type == "CLIENT_ACFT_WAYPOINT" && obj.route_id == mp.model.selected_feature_group_id && this.activeFeature.data.type == "route_segment") {
					this.clickRouteSegmentPopup(this.activeFeature, args.mousePosition);
					this.doStateTransition("hover_feature");
					return false;
				}
				
				this.doStateTransition("hover_feature");
			},
			move: function(args) {
				this.doStateTransition("drag_feature");
				return false;
			},
		},
		"drag_feature": {
			leftup: function(args) {
				if (this.activeFeature.data.type == "waypoint") {
					this.dragWaypointPopup(this.activeFeature, args.mousePosition);
				} else if (this.activeFeature.data.type == "route_segment") {
					this.dragRouteSegmentPopup(this.activeFeature, args.mousePosition);
				}
				this.doStateTransition("hover_feature");
				this.doStateMachineInput("featureOut", { feature: this.activeFeature });
				this.doStateTransition("idle");
				return false;
			},
		},
		"draw_circle": {
			enter: function(args) {
				this.drawState = {
				};
			},
			leave: function(args) {
				if (args.new_state == "draw_circle_mousedown") return;
				this.drawState = undefined;
			},
			rightdown: function(args) {
				console.log("c");
				this.drawState.origin_900913 = new OpenLayers.Geometry.Point(args.mapCoords.lon, args.mapCoords.lat).transform(this.map.getProjection(), 'EPSG:900913');
				this.drawState.feature = new OpenLayers.Feature.Vector();
				this.vectorLayers[LAYER_ID_ANNOTATIONS].addFeatures([this.drawState.feature]);

				this.drawState.radius = this.drawState.origin_900913.distanceTo(new OpenLayers.Geometry.Point(args.mapCoords.lon, args.mapCoords.lat).transform(this.map.getProjection(), 'EPSG:900913'));
				this.drawState.feature.geometry = OpenLayers.Geometry.Polygon.createRegularPolygon(
					this.drawState.origin_900913, this.drawState.radius, 24, 0
				).transform("EPSG:900913", this.map.getProjection());
				this.drawState.feature.layer.drawFeature(this.drawState.feature);
				this.vectorLayers[LAYER_ID_ANNOTATIONS].redraw();
				
				this.doStateTransition("draw_circle_mousedown");
			},
			leftup: function(args) {
				var feature = this.vectorLayers[LAYER_ID_ANNOTATIONS].getFeatureFromEvent(args.event);
				if (feature) {
					this.clickAnnotationPopup(feature, args.mousePosition);
				} else {
					this.defaultLeftUpAction(args);
				}
			},
		},
		"draw_circle_mousedown": {
			move: function(args) {
					this.drawState.radius = this.drawState.origin_900913.distanceTo(new OpenLayers.Geometry.Point(args.mapCoords.lon, args.mapCoords.lat).transform(this.map.getProjection(), 'EPSG:900913'));
					this.drawState.feature.geometry = OpenLayers.Geometry.Polygon.createRegularPolygon(
						this.drawState.origin_900913, this.drawState.radius, 24, 0
					).transform("EPSG:900913", this.map.getProjection());
					this.drawState.feature.layer.drawFeature(this.drawState.feature);
					this.vectorLayers[LAYER_ID_ANNOTATIONS].redraw();
			},
			rightup: function(args) {
				var i;
				var feature = this.drawState.feature;
				var linearRing = feature.geometry.components[0];
				var new_obj = {
					id: mp.model.newId(),
					type: "LINEARRING_ANNOTATION",
					points: [],
				}
				for (i=0; i<linearRing.components.length; i++) {
					var p = linearRing.components[i];
					var lonlat = new OpenLayers.LonLat(p.x, p.y).transform(this.map.getProjection(), 'EPSG:4326');
					new_obj.points.push({lon: lonlat.lon, lat: lonlat.lat});
				}
				
				mp.api.start_transaction({
					objects: [new_obj],
					on_commit: $.proxy(function(r) {
						this.vectorLayers[LAYER_ID_ANNOTATIONS].removeFeatures([feature]);
					}, this),
					on_rollback: $.proxy(function(r) {
						this.vectorLayers[LAYER_ID_ANNOTATIONS].removeFeatures([feature]);
					}, this),
				});

				this.doStateTransition("draw_circle");
			},
		},
	},
	
	initialize: function(options) {
		OpenLayers.Util.extend(this, options);
	
		this.eventListeners = {
			"mousemove": this.mousemove,
			"mouseup": this.mouseup,
			scope: this
		};
		this.map.events.on(this.eventListeners);
		this.map.events.registerPriority("mousedown", this, this.mousedown);

		// see http://spatialnotes.blogspot.de/2010/11/capturing-right-click-events-in.html
		this.map.div.oncontextmenu = function(e){
			e = e?e:window.event;
			if (e.preventDefault) e.preventDefault(); // For non-IE browsers.
			else return false; // For IE browsers.
		};


	},
	
	destroy: function() {
		this.map.un(this.eventListeners);
		this.map.events.unregister("mousedown", this, this.mousedown);
	},
	
	mousemove: function(e) {
		if (this.logEvents) console.log("MOVE EVENT: ", e);
		
		var ret = true;
		var prevHF = this.hoveredFeature;
		var newHF = this.getHoveredFeatureFromEvent(e);
		if (!(newHF == prevHF)) {
			if (prevHF && newHF == null) { // hoveredFeature: someValue -> null
				this.hoveredFeature = null;
				if (!this.doStateMachineInput("featureOut", {feature: prevHF})) ret = false;
			} else if (prevHF == null && newHF) { // hoveredFeature: null -> someValue
				this.hoveredFeature = newHF;
				if (!this.doStateMachineInput("featureEnter", {feature: newHF})) ret = false;
			} else { // hoveredFeature: someValue -> someOtherValue
				
				this.hoveredFeature = null;
				if (!this.doStateMachineInput("featureOut", {feature: prevHF})) ret = false;
				
				this.hoveredFeature = newHF;
				if (this.doStateMachineInput("featureEnter", {feature: newHF})) ret = false;
				
			}
		}

		var mousePosition = new OpenLayers.Pixel(e.xy.x, e.xy.y);
		var mapCoords = this.map.getLonLatFromViewPortPx(mousePosition);
		var mapLonLat = this.map.getLonLatFromViewPortPx(mousePosition).transform(this.map.getProjection(), 'EPSG:4326');
		
		if (this.lastMousePosition == null || (this.lastMousePosition.distanceTo(mousePosition) > this.pixelTolerance)) {
			if (!this.doStateMachineInput("move", {'mousePosition': mousePosition, 'mapCoords': mapCoords, 'mapLonLat': mapLonLat, 'event':e})) ret = false;
			this.lastMousePosition = mousePosition;

		}
		
		return ret;
	},
	
	mousedown: function(e) {
		var eventname = {0: "leftdown", 1:"middledown", 2:"rightdown"}[e.button];
		var mousePosition = new OpenLayers.Pixel(e.xy.x, e.xy.y);
		var mapCoords = this.map.getLonLatFromViewPortPx(mousePosition);
		var mapLonLat = this.map.getLonLatFromViewPortPx(mousePosition).transform(this.map.getProjection(), 'EPSG:4326');
		return this.doStateMachineInput(eventname, {'mousePosition': mousePosition, 'mapCoords': mapCoords, 'mapLonLat': mapLonLat, 'event':e});
	},
	
	mouseup: function(e) {
		var eventname = {0: "leftup", 1:"middleup", 2:"rightup"}[e.button];
		var mousePosition = new OpenLayers.Pixel(e.xy.x, e.xy.y);
		var mapCoords = this.map.getLonLatFromViewPortPx(mousePosition);
		var mapLonLat = this.map.getLonLatFromViewPortPx(mousePosition).transform(this.map.getProjection(), 'EPSG:4326');
		return this.doStateMachineInput(eventname, {'mousePosition': mousePosition, 'mapCoords': mapCoords, 'mapLonLat': mapLonLat, 'event':e});
	},
	
	doStateMachineInput: function(transition_name, args) {
		
		var state = this.stateMachine[mp.model.ui_state];
		if (state[transition_name]) {
			if (this.logStateInput) console.log("STATE MACHINE INPUT", mp.model.ui_state, transition_name, args);
			return $.proxy(state[transition_name], this)(args);
		} else {
			return true;
		}
	},
	
	doStateTransition: function(new_state, args) {
		if (this.logStateTransitions) console.log("STATE CHANGE: "+mp.model.ui_state+" -> "+new_state);
		if (!args) args = {};
		var old_state = mp.model.ui_state;
		OpenLayers.Util.extend(args, {'old_state': old_state, 'new_state': new_state});
		
		this.doStateMachineInput("leave", args);
		mp.model.ui_state = new_state;
		
		this.doStateMachineInput("enter", args);
	},
	
	getHoveredFeatureFromEvent: function(e) {
		var f, i;
		for (i=LAYER_ID_ACTIVE_WAYPOINTS; i>=LAYER_ID_INACTIVE_ROUTES; --i) {
			var f = this.vectorLayers[i].getFeatureFromEvent(e);
			if (f) return f;
		}
		return null;
	},

	/*
	  By default, LMB shows airport information and cancels popups
	 */
	defaultLeftUpAction: function(args) {
		$("#contextmenu_popup").remove();
		
		var feature = this.vectorLayers[LAYER_ID_AIRPORTS].getFeatureFromEvent(args.event);
		if (feature) {
			this.clickAirportPopup(feature, args.mousePosition);
		}
	},

	clickAirportPopup: function(feature, xy) {

		var popup_coords = this.map.getLonLatFromViewPortPx(new OpenLayers.Pixel(xy.x + 5, xy.y + 5));
		var lonlat = this.map.getLonLatFromViewPortPx(xy).transform(this.map.getProjection(), 'EPSG:4326');
		
		$("#contextmenu_popup").remove();
		var popup = new OpenLayers.Popup(
			"contextmenu_popup", 
			popup_coords,
			null,//new OpenLayers.Size(200, 200),
			'<div id="ctxmenu_content"></div>',
			false
		);
		popup.closeOnMove = true;
		map.addPopup(popup);
		var menu = $("#ctxmenu_content");
		var ll_string = OpenLayers.Util.getFormattedLonLat(lonlat.lat, 'lat', 'dm');
		ll_string += '  '+OpenLayers.Util.getFormattedLonLat(lonlat.lon, 'lon', 'dm');
		$(menu).append($("<b>").text(feature.data.name));
		$(menu).append($("<div>").html(feature.data.description));
		popup.updateSize();
	},

	
	dragRouteSegmentPopup: function(feature, xy) {

		var popup_coords = this.map.getLonLatFromViewPortPx(new OpenLayers.Pixel(xy.x + 5, xy.y + 5));
		var lonlat = this.map.getLonLatFromViewPortPx(xy).transform(this.map.getProjection(), 'EPSG:4326');
		
		$("#contextmenu_popup").remove();
		var popup = new OpenLayers.Popup(
			"contextmenu_popup", 
			popup_coords,
			new OpenLayers.Size(200, 100),
			'<div id="ctxmenu_content"></div>',
			false
		);
		popup.closeOnMove = true;
		map.addPopup(popup);
		var menu = $("#ctxmenu_content");
		var ll_string = OpenLayers.Util.getFormattedLonLat(lonlat.lat, 'lat', 'dm');
		ll_string += '  '+OpenLayers.Util.getFormattedLonLat(lonlat.lon, 'lon', 'dm');
		$(menu).append($('<span class="contextmenu_ll">').text(ll_string));
		$(menu).append($("<br>"));
		$(menu).append($('<span><a href="#" id="ctx_insert_waypoint">Insert Waypoint</a></span>'));
		popup.updateSize();
		
		$("#ctx_insert_waypoint").click(function() {
			var wpt_a = mp.model.objects[feature.data.object_id];
			var wpt_b = mp.model.objects[wpt_a.next_waypoint_id];
			
			var wpt_a_copy = JSON.parse(JSON.stringify(wpt_a));
			
			var new_wpt = {
				id: mp.model.newId(),
				type: "CLIENT_ACFT_WAYPOINT",
				route_id: wpt_a.route_id,
				lon: lonlat.lon,
				lat: lonlat.lat,
				next_waypoint_id: wpt_b.id,
				alt: wpt_a.alt,
				alt_type: wpt_a.alt_type,
                visibility: wpt_a.visibility,
				name: "",
			}
			wpt_a_copy.next_waypoint_id = new_wpt.id;
			
			$("#ctxmenu_content").html("Contacting Server...");
			mp.api.start_transaction({
				objects: [wpt_a_copy, new_wpt, wpt_b],
				on_commit: function(result) {
					popup.hide();
				},
				on_rollback: function(result) {
					$("#ctxmenu_content").html("failed (conflicting edit).");
				}
			});
			
		});

	},
	


	dragWaypointPopup: function(feature, xy) {

		var popup_coords = this.map.getLonLatFromViewPortPx(new OpenLayers.Pixel(xy.x + 5, xy.y + 5));
		var lonlat = this.map.getLonLatFromViewPortPx(xy).transform(this.map.getProjection(), 'EPSG:4326');

		var wpt = mp.model.objects[feature.data.object_id];
		var prev_wpt = mp.model.getPreviousWaypoint(wpt);
		if (!prev_wpt) return; // cannot move first waypoint!
		
		$("#contextmenu_popup").remove();
		var popup = new OpenLayers.Popup(
			"contextmenu_popup", 
			popup_coords,
			new OpenLayers.Size(200, 100),
			'<div id="ctxmenu_content"></div>',
			false
		);
		popup.closeOnMove = true;
		map.addPopup(popup);
		var menu = $("#ctxmenu_content");
		var ll_string = OpenLayers.Util.getFormattedLonLat(lonlat.lat, 'lat', 'dm');
		ll_string += '  '+OpenLayers.Util.getFormattedLonLat(lonlat.lon, 'lon', 'dm');
		$(menu).append($('<span class="contextmenu_ll">').text(ll_string));
		$(menu).append($("<br>"));
		$(menu).append($('<span><a href="#" id="ctx_move_waypoint">Move Waypoint</a></span>'));
		popup.updateSize();
		
		$("#ctx_move_waypoint").click(function() {
			var wpt = mp.model.objects[feature.data.object_id];
			var prev_wpt = mp.model.getPreviousWaypoint(wpt);
			
			var wpt_copy = JSON.parse(JSON.stringify(wpt));
			
			wpt_copy.lon = lonlat.lon;
			wpt_copy.lat = lonlat.lat;
						
			$("#ctxmenu_content").html("Contacting Server...");
			mp.api.start_transaction({
				objects: [wpt_copy, prev_wpt],
				on_commit: function(result) {
					popup.hide();
				},
				on_rollback: function(result) {
					$("#ctxmenu_content").html("failed (conflicting edit).");
				}
			});
			
		});

	},
	



	clickWaypointPopup: function(feature, xy) {

		var popup_coords = this.map.getLonLatFromViewPortPx(new OpenLayers.Pixel(xy.x + 5, xy.y + 5));
		var lonlat = this.map.getLonLatFromViewPortPx(xy).transform(this.map.getProjection(), 'EPSG:4326');

		var wpt = mp.model.objects[feature.data.object_id];
		var prev_wpt = mp.model.getPreviousWaypoint(wpt);
		if (!prev_wpt) return; // cannot delete first waypoint!
		
		
		$("#contextmenu_popup").remove();
		var popup = new OpenLayers.Popup(
			"contextmenu_popup", 
			popup_coords,
			new OpenLayers.Size(200, 100),
			'<div id="ctxmenu_content"></div>',
			false
		);
		popup.closeOnMove = true;
		map.addPopup(popup);
		var menu = $("#ctxmenu_content");
		var ll_string = OpenLayers.Util.getFormattedLonLat(lonlat.lat, 'lat', 'dm');
		ll_string += '  '+OpenLayers.Util.getFormattedLonLat(lonlat.lon, 'lon', 'dm');
		$(menu).append($('<span class="contextmenu_ll">').text(ll_string));
		$(menu).append($("<br>"));
		$(menu).append($('<span><a href="#" id="ctx_delete_waypoint">Delete Waypoint #'+mp.model.getWaypointPosition(wpt).toString()+'</a></span>'));
		popup.updateSize();
		
		$("#ctx_delete_waypoint").click(function() {
			var prev_wpt_copy = JSON.parse(JSON.stringify(prev_wpt));
			prev_wpt_copy.next_waypoint_id = wpt.next_waypoint_id;
			
			$("#ctxmenu_content").html("Contacting Server...");
			mp.api.start_transaction({
				deleted_object_ids: [wpt.id],
				objects: [prev_wpt_copy],
				on_commit: function(result) {
					popup.hide();
				},
				on_rollback: function(result) {
					$("#ctxmenu_content").html("failed (conflicting edit).");
				}
			});
			
		});

	},
	

	clickRouteSegmentPopup: function(feature, xy) {

		var popup_coords = this.map.getLonLatFromViewPortPx(new OpenLayers.Pixel(xy.x + 5, xy.y + 5));
		var lonlat = this.map.getLonLatFromViewPortPx(xy).transform(this.map.getProjection(), 'EPSG:4326');
		
		$("#contextmenu_popup").remove();
		var popup = new OpenLayers.Popup(
			"contextmenu_popup", 
			popup_coords,
			new OpenLayers.Size(200, 100),
			'<div id="ctxmenu_content"></div>',
			false
		);
		popup.closeOnMove = true;
		map.addPopup(popup);
		var menu = $("#ctxmenu_content");
		var ll_string = OpenLayers.Util.getFormattedLonLat(lonlat.lat, 'lat', 'dm');
		ll_string += '  '+OpenLayers.Util.getFormattedLonLat(lonlat.lon, 'lon', 'dm');
		$(menu).append($('<span class="contextmenu_ll">').text(ll_string));
		$(menu).append($("<br>"));
		$(menu).append($('<span><a href="#" id="ctx_insert_waypoint">Insert Waypoint</a></span>'));
		popup.updateSize();
		
		$("#ctx_insert_waypoint").click(function() {
			var wpt_a = mp.model.objects[feature.data.object_id];
			var wpt_b = mp.model.objects[wpt_a.next_waypoint_id];
			
			var wpt_a_copy = JSON.parse(JSON.stringify(wpt_a));
			
			var new_wpt = {
				id: mp.model.newId(),
				type: "CLIENT_ACFT_WAYPOINT",
				route_id: wpt_a.route_id,
				lon: lonlat.lon,
				lat: lonlat.lat,
				next_waypoint_id: wpt_b.id,
				alt: wpt_a.alt,
				alt_type: wpt_a.alt_type,
                visibility: wpt_a.visibility,
				name: "",
			}
			wpt_a_copy.next_waypoint_id = new_wpt.id;
			
			$("#ctxmenu_content").html("Contacting Server...");
			mp.api.start_transaction({
				objects: [wpt_a_copy, new_wpt, wpt_b],
				on_commit: function(result) {
					popup.hide();
				},
				on_rollback: function(result) {
					$("#ctxmenu_content").html("failed (conflicting edit).");
				}
			});
			
		});
		
	},

	mapRightclickPopup: function(xy) {
		var popup_coords = this.map.getLonLatFromViewPortPx(new OpenLayers.Pixel(xy.x + 5, xy.y + 5));
		var lonlat = this.map.getLonLatFromViewPortPx(xy).transform(this.map.getProjection(), 'EPSG:4326');
		
		$("#contextmenu_popup").remove();
		var popup = new OpenLayers.Popup(
			"contextmenu_popup", 
			popup_coords,
			new OpenLayers.Size(200, 100),
			'<div id="ctxmenu_content"></div>',
			false
		);
		popup.closeOnMove = true;
		map.addPopup(popup);
		var menu = $("#ctxmenu_content");
		var ll_string = OpenLayers.Util.getFormattedLonLat(lonlat.lat, 'lat', 'dm');
		ll_string += '  '+OpenLayers.Util.getFormattedLonLat(lonlat.lon, 'lon', 'dm');
		$(menu).append($('<span class="contextmenu_ll">').text(ll_string));
		$(menu).append($("<br>"));
		$(menu).append($('<span><a href="#" id="ctx_add_waypoint">Add Waypoint</a></span>'));
		popup.updateSize();
		
		$("#ctx_add_waypoint").click(function() {
			$("#ctxmenu_content").html("<span>Contacting Server...</span>");
			var num_waypoints = 1
			var last_wpt = mp.model.objects[mp.model.objects[mp.model.selected_feature_group_id].first_waypoint_id];
			while (last_wpt.next_waypoint_id) {
				last_wpt = mp.model.objects[last_wpt.next_waypoint_id];
				num_waypoints++;
			}
			
			var new_wpt = {
				id: mp.model.newId(),
				type: "CLIENT_ACFT_WAYPOINT",
				route_id: last_wpt.route_id,
				lon: lonlat.lon,
				lat: lonlat.lat,
				next_waypoint_id: "",
				alt: last_wpt.alt,
				alt_type: last_wpt.alt_type,
                visibility: last_wpt.visibility,
				name: "",
			}
			
			var last_wpt_copy = JSON.parse(JSON.stringify(last_wpt));
			last_wpt_copy.next_waypoint_id = new_wpt.id;
			
			mp.api.start_transaction({
				objects: [last_wpt_copy, new_wpt],
				on_commit: function(result) {
					popup.hide();
				},
				on_rollback: function(result) {
					$("#ctxmenu_content").html("failed (conflicting edit).");
				}
			});
		});

	},

	clickAnnotationPopup: function(feature, xy) {

		var popup_coords = this.map.getLonLatFromViewPortPx(new OpenLayers.Pixel(xy.x + 5, xy.y + 5));
		var lonlat = this.map.getLonLatFromViewPortPx(xy).transform(this.map.getProjection(), 'EPSG:4326');
		
		$("#contextmenu_popup").remove();
		var popup = new OpenLayers.Popup(
			"contextmenu_popup", 
			popup_coords,
			new OpenLayers.Size(200, 100),
			'<div id="ctxmenu_content"></div>',
			false
		);
		popup.closeOnMove = true;
		map.addPopup(popup);
		var menu = $("#ctxmenu_content");
		var ll_string = OpenLayers.Util.getFormattedLonLat(lonlat.lat, 'lat', 'dm');
		ll_string += '  '+OpenLayers.Util.getFormattedLonLat(lonlat.lon, 'lon', 'dm');
		$(menu).append($('<span class="contextmenu_ll">').text(ll_string));
		$(menu).append($("<br>"));
		$(menu).append($('<span><a href="#" id="ctx_delete_annotation">Delete Annotation</a></span>'));
		popup.updateSize();
		
		$("#ctx_delete_annotation").click(function() {
			$("#ctxmenu_content").html("Contacting Server...");
			mp.api.start_transaction({
				deleted_object_ids: [feature.data.object_id],
				on_commit: function(result) {
					popup.hide();
				},
				on_rollback: function(result) {
					$("#ctxmenu_content").html("failed (conflicting edit).");
				}
			});
			
		});

	},


});


