mp = mp || {};

mp.Model = function(id_prefix, initial_data) {
	var that = this;
	
	this.timeout = 500;
	this.ui_state = "idle";
	
	function init() {
		that.local_id_prefix = id_prefix;
		that.objects = {};
		that.data_version = 0;
		that.selected_feature_group_id = "";
		
		var last_local_id = 0;
		that.newId = function() {
			last_local_id++;
			return that.local_id_prefix+last_local_id.toString();
		}
		
		var pseudo_tx = {
			preconditions: {},
			updated_data: initial_data.objects,
			version_after: initial_data.version,
			deleted_object_ids: []
		};
		that.data_version = initial_data.version - 1;
		that.processChangeset(pseudo_tx);
	}
	
	this.setSelectedFeatureGroupId = function(new_id) {
		var old_id = that.selected_feature_group_id;
		that.selected_feature_group_id = new_id;
		$(document).trigger("update_selected_feature_group_id", [old_id, new_id]);
	}
	
	this.processChangeset = function(changeset) {
		if (that.data_version != changeset.version_after - 1) return;
		
		$.each(changeset.deleted_object_ids, function(_, id) {
			var obj = that.objects[id];
			if (!obj) {
				console.warn("changeset trying to delete non-existent object id: ", id);
			} else {
			    $(document).trigger("delete_object", obj);
			    delete that.objects[id];
            }
		});
		var updated_ids = [];
		var new_ids = [];
		$.each(changeset.updated_data, function(id, obj) {
			if (obj.id in that.objects) {
				updated_ids.push(obj.id);
			} else {
				new_ids.push(obj.id);
			}
			that.objects[obj.id] = obj;
		});
		
		for (i=0; i<updated_ids.length; i++) {
			var obj = that.objects[updated_ids[i]];
			$(document).trigger("update_object", obj);
		}
		for (i=0; i<new_ids.length; i++) {
			var obj = that.objects[new_ids[i]];
			$(document).trigger("new_object", obj);
		}
		
		that.data_version = changeset.version_after;
	}
	
	this.checkForDataUpdates = function() {
		mp.api.request("/missionplanner/data/get_changesets/", {since_version: that.data_version}, function(result) {
			
			$.each(result.changesets, function(_, cset) {
				that.processChangeset(cset);
			});
			
			setTimeout(that.checkForDataUpdates, (mp.model.timeout || 500));
		});
	}
	
	this.getPreviousWaypoint = function(obj) {
		if (typeof obj == "string") obj = that.objects[obj];
		
		var route = that.objects[obj.route_id];
		var wpt = that.objects[route.first_waypoint_id];
		
		while (wpt.next_waypoint_id != obj.id) {
			if (wpt.next_waypoint_id == "") return null;
			wpt = that.objects[wpt.next_waypoint_id];
		}
		
		return wpt;
	}
	

	this.getWaypointPosition = function(obj) {
		if (typeof obj == "string") obj = that.objects[obj];
		
		var route = that.objects[obj.route_id];
		var wpt = that.objects[route.first_waypoint_id];
		var n = 0;
		
		while (wpt.id != obj.id) {
			if (wpt.next_waypoint_id == "") return null;
			n += 1;
			wpt = that.objects[wpt.next_waypoint_id];
		}
		return n;
	}
	

	init();
}
