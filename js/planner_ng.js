mp = mp || {};
mp.settings = {};
mp.settings.websocket_url = "";

$.support.cors = true;
$(function() {
	$("#noscript").hide();
	$("#connect_controls").show();
	$("#connect_url_input").focus();
    
	if (mp.MAPPACK_VERSION && mp.MAPPACK_VERSION == 1) {
		mp.settings.default_map = 'dcs';
	} else {
		$("#dcs_world_map_option").remove();
		mp.settings.default_map = 'osm';
        $("#dcs_map_info").show();
	}
	
	
	function abort_connect(reason) {
		$("#control_wrapper").hide();
		$("#intro").show();
		$("#connect_controls").show();
		alert(reason);
		return;
	}
    function connect(instance_id, coalition, password) {
        if (mp.api) {
            if (mp.api.websocket) {
                mp.api.websocket.onclose = undefined;
                mp.api.websocket.close();
            }
        }
		
		$("#intro").hide();
		$("#connect_controls").hide();
		$("#control_wrapper").show();
		$("#connect_status").text("establishing connection...");
		
        mp.api = new mp.API();
        mp.api.login({
            instance_id: instance_id,
            coalition: coalition,
            password: password,
            on_error: function(result) {
				return abort_connect("Could not connect: "+result.error_msg);
            },
            on_success: function(result) {
				if (!result.success) {
					return abort_connect("Could not connect: "+result.error_msg);
				}
				$("#connect_status").text("drawing map...");
				$("#map").show();
				mp.model = new mp.Model(result.id_prefix, result.data);
				
				var routes_found = false;
				var routes = [];
				$.each(mp.model.objects, function(_, obj) {
					if (obj.type == "CLIENT_ACFT_ROUTE") {
						routes.push([obj.id, '['+obj.unittype+'] '+obj.group_name]);
						routes_found = true;
					}
				});
				routes.sort(function(a, b) {
					if (a[1] < b[1]) {
						return -1;
					} else if (a[1] > b[1]) {
						return 1;
					} else {
						return 0;
					}
				});
				for (var i=0; i<routes.length; i++) {
					var id_name_array = routes[i];
					$("#activeroute").append($("<option>").attr("value", id_name_array[0]).text(id_name_array[1]));
					$("#copyroute_from").append($("<option>").attr("value", id_name_array[0]).text(id_name_array[1]));
				}
				
				if (!routes_found) {
					return abort_connect("Error: The "+coalition+" side has no routes to edit.");
				}
				
				mp.ui = {}
				mp.ui.state = "idle"
				
				mp.mapview = new mp.MapView(mp.settings.default_map);
				$("#baselayer").val(mp.settings.default_map);
				update_map_opacity_slider_visibility(mp.settings.default_map);
				$("#map_opacity_slider").change();
				$("#activeroute").change();
				var rE = mp.mapview.getMap().restrictedExtent;
				mp.mapview.getMap().setCenter(new OpenLayers.LonLat(rE.left + (rE.right - rE.left)/2, rE.bottom + (rE.top - rE.bottom)/2));
				
				
				$("#briefing_content").html("");
                
				$("#briefing_content").append($("<h1>Mission Description</h1>"));
				$("#briefing_content").append($("<pre>").text(result.data.descriptionText));
                
				$("#briefing_content").append($("<h1>Blue Task</h1>"));
				$("#briefing_content").append($("<pre>").text(result.data.blueTask));
                
				$("#briefing_content").append($("<h1>Red Task</h1>"));
				$("#briefing_content").append($("<pre>").text(result.data.redTask));
				
				$("#connect_status").text("Instance: "+instance_id);
				$("#controls").show();
            },
        });
    }
    
	$("#connect_form").submit(function(e) {
		e.preventDefault();
		var u = new URI($("#connect_url_input").val());
		var ws_uri = new URI();
		ws_uri.scheme(u.scheme() == "https" ? "wss" : "ws").host(u.host()).path("/websocket/");
		mp.settings.websocket_url = ws_uri.toString();
		mp.settings.server_base_url = (new URI()).scheme(u.scheme()).host(u.host()).path("/").toString();
		
		connect(u.query(true).instance_id, u.username(), u.password());
	});

    $(document).on("heartbeat", function() {
		var ind = $("#update_indicator")[0];
		ind.style.visibility = (ind.style.visibility == "hidden") ? "visible" : "hidden";
    });

	$("#map_opacity_slider").change(function() {
		var new_opacity = parseInt($("#map_opacity_slider").val()) / 100;
		mp.mapview.getMap().layers[0].setOpacity(new_opacity);
	});
	
	function update_map_opacity_slider_visibility(baselayer_name) {
		if (baselayer_name == "dcs" || baselayer_name == "tad" || baselayer_name == "tad_sm") {
			$("#map_opacity_slider").show();
			$("#map_opacity_slider").change();
		} else {
			$("#map_opacity_slider").hide();
		}
	}
	$("#baselayer").change(function() {
		var baselayer_name = $("#baselayer").val();
        var old_state = mp.mapview.state;
		
		var center = mp.mapview.getMap().getCenter().transform(map.getProjection(), "EPSG:4326");
		var old_zoom = mp.mapview.getMap().zoom;
		
		mp.mapview.destroy();
		mp.mapview = new mp.MapView(baselayer_name);
		
		center.transform("EPSG:4326", mp.mapview.getMap().getProjection());
		if (baselayer_name == 'dcs' && old_zoom > 15) old_zoom = 15;
		mp.mapview.getMap().setCenter(center, old_zoom);
		update_map_opacity_slider_visibility(baselayer_name);
	});

	$("#activeroute").change(function() {
		if (mp.model) mp.model.setSelectedFeatureGroupId($("#activeroute").val());
	});
	$(document).on("update_selected_feature_group_id", function(e, old_id, new_id) {
		var obj = mp.model.objects[new_id];
		$("#activeroute").val(new_id);
		$("#livery").empty();
		var has_selected = false;
		if (mp.model.liveries && mp.model.liveries[obj.unittype]) {
			var livery_list = mp.model.liveries[obj.unittype];
			$.each(livery_list, function(_, liv) {
				console.log(liv);
				var option = $("<option>").text(liv).attr("value", liv);
				if (liv.toLowerCase() == obj.livery_id.toLowerCase()) {
					option.attr("selected", true);
					has_selected = true;
				}
				$("#livery").append(option);
			});
		}
		if (!has_selected) {
			$("#livery").append($("<option>").text(obj.livery_id).attr("value", obj.livery_id).attr("selected", true));
		}
	});
	$("#livery").change(function(e) {
		var obj = mp.model.objects[$("#activeroute").val()];
		var new_livery = $("#livery").val();
		$("#livery").val(obj.livery_id);
		
		var obj_copy = JSON.parse(JSON.stringify(obj));
		obj_copy.livery_id = new_livery;
		mp.api.start_transaction({
			objects: [obj_copy]
		});
	});
	$(document).on("update_object", function(e, obj) {
		if (obj.type == "CLIENT_ACFT_ROUTE" && $("#activeroute").val() == obj.id) {
			$("#livery").val(obj.livery_id);
		}
	});
	
	$("#center_on_wp0_button").click(function() {
		var route_object = mp.model.objects[$("#activeroute").val()];
		var wpt = mp.model.objects[route_object.first_waypoint_id];
		
		mp.mapview.getMap().setCenter(new OpenLayers.LonLat(lon=wpt.lon, lat=wpt.lat).transform("EPSG:4326", mp.mapview.getMap().getProjection()));
	});
	
	function on_editmode_changed() {
		$("div.editmode").removeClass("active_editmode");
		if ($("#editmode_routes").is(":checked")) {
			$("#editmode_routes_controls").addClass("active_editmode");
            // route edit mode is the default, so this will be called during initialization
            // when the mapview does not exist yet; hence the if (mp.mapview) is required here.
			if (mp.mapview) mp.mapview.getInputHandler().doStateTransition("idle");
		}
		if ($("#editmode_annotations").is(":checked")) {
			$("#editmode_annotations_controls").addClass("active_editmode");
            $("#annotationtype").removeAttr("disabled");
            $("#annotationtype").change();
		} else {
            $("#annotationtype").attr("disabled", true);
        }
	};
	$("input[name=editmode]:radio").change(on_editmode_changed);
    on_editmode_changed();
	
    $("#annotationtype").change(function() {
		mp.mapview.getInputHandler().doStateTransition($("#annotationtype").val());
    });

	$("div.editmode").click(function() {
		$("input[name=editmode]:radio", this).prop("checked", true);
		$("input[name=editmode]:radio", this).change();
	});

	$("#copyroute_set_from_to_active").click(function() {
		$("#copyroute_from").val($("#activeroute").val());
		$("#copyroute_from").change();
	});
	$("#copyroute_button").click(function() {
		var from_id = $("#copyroute_from").val();
		var to_id = mp.model.selected_feature_group_id;
		
		if (from_id == to_id) {
			alert("Copying a route to itself is pretty meaningless, don't you think?");
			return;
		}
		
		var from_route = mp.model.objects[from_id];
		var to_route = mp.model.objects[to_id];
		
		if (!confirm("Replace the active route ("+to_route.group_name+") with the route for "+from_route.group_name+"?")) return;
		
		var deleted_object_ids = [];
		var new_waypoints = [];
		
		// we will delete all of the target route's old waypoints (except the first)
		var old_wpt = mp.model.objects[to_route.first_waypoint_id];
		
		var first_wpt_copy = JSON.parse(JSON.stringify(old_wpt));
		first_wpt_copy.next_waypoint_id = "";
		new_waypoints.push(first_wpt_copy);

		while (true) {
			if (!old_wpt.next_waypoint_id) break;
			old_wpt = mp.model.objects[old_wpt.next_waypoint_id];
			deleted_object_ids.push(old_wpt.id);
		}
		
		
		// copy the route
		var new_wpt = mp.model.objects[from_route.first_waypoint_id];
		var prev_wpt_copy = first_wpt_copy;
		while (true) {
			if (!new_wpt.next_waypoint_id) break;
			new_wpt = mp.model.objects[new_wpt.next_waypoint_id];
			var wpt_copy = JSON.parse(JSON.stringify(new_wpt));
			wpt_copy.id = mp.model.newId();
			wpt_copy.route_id = to_route.id;
			prev_wpt_copy.next_waypoint_id = wpt_copy.id;
			
			new_waypoints.push(wpt_copy);
			prev_wpt_copy = wpt_copy;
		}

		mp.api.start_transaction({
			deleted_object_ids: deleted_object_ids,
			objects: new_waypoints,
			on_commit: function() {
				alert("Route copied.");
			},
			on_rollback: function() {
				alert("Could not copy route (conflicting edits). Try again.");
			}
		});
	});
	
	$("#toggle_briefing").click(function() {
		$("#briefing").toggle();
	});
	
	function updateRouteDisplay() {
		function makeWaypointTR(obj, n) {
			var alt, alt_ft;
			
			var tr = $("<tr>");

			tr.append($("<td>").text(n));
			
			var name = $('<a href="#">').text(obj.name ? obj.name : "(no name)");
			tr.append($("<td>").append(name));
			
			var alt_type = $('<a href="#">').text(obj.alt_type);
			tr.append($("<td>").append(alt_type));
			
			try {
				alt_ft = (Math.round(obj.alt * 3.2808399)).toString()+" ft";
			} catch (e) {
				alt_ft = 0;
			}
			var alt = $('<a href="#">').text(alt_ft);
			tr.append($("<td>").append(alt));
			
			var pan_to = $('<a href="#">&gt;&gt;&lt;&lt;</a>');
			tr.append($("<td>").append(pan_to));
			
			$(name).click(function() {
				var old_text = $(this).text();
				var new_name = prompt("New Name:");
				var wpt_copy = JSON.parse(JSON.stringify(obj));
				wpt_copy.name = new_name;
				mp.api.start_transaction({
					objects: [wpt_copy],
					on_rollback: function() {
						$(this).text(old_text);
					}
				});
			});

			$(alt_type).click(function() {
				var old_text = $(this).text();
				var new_alt_type = (obj.alt_type == "BARO") ? "RADIO" : "BARO";
				var wpt_copy = JSON.parse(JSON.stringify(obj));
				wpt_copy.alt_type = new_alt_type;
				mp.api.start_transaction({
					objects: [wpt_copy],
					on_rollback: function() {
						$(this).text(old_text);
					}
				});
			});

			$(alt).click(function() {
				var old_text = $(this).text();
				var new_alt = parseInt(prompt("New Altitude: ")) / 3.2808399;
				if (!new_alt) new_alt = 0; // ensure we do not pass NaN to the server
				var wpt_copy = JSON.parse(JSON.stringify(obj));
				wpt_copy.alt = new_alt;
				mp.api.start_transaction({
					objects: [wpt_copy],
					on_rollback: function() {
						$(this).text(old_text);
					}
				});
			});
			
			$(pan_to).click(function() {
				mp.mapview.getMap().panTo(new OpenLayers.LonLat(obj.lon, obj.lat).transform("EPSG:4326", mp.mapview.getMap().getProjection()));
			});
			
			return tr;
		}
		
		var routeDisplay = $("<table>");
		
		var route = mp.model.objects[mp.model.selected_feature_group_id];
		var wpt = mp.model.objects[route.first_waypoint_id];
		wpt = wpt.next_waypoint_id ? mp.model.objects[wpt.next_waypoint_id] : null; // skip start position
		
		var n = 1;
		while (wpt) {
			$(routeDisplay).append(makeWaypointTR(wpt, n++));
			wpt = mp.model.objects[wpt.next_waypoint_id];
		}
		
		$("#objectinfo").html("");
		$("#objectinfo").append(routeDisplay);
	}
	$(document).on("update_object", function(e, obj) {
		if (obj.type == "CLIENT_ACFT_WAYPOINT") {
			updateRouteDisplay();
		}
	});
	$(document).on("update_selected_feature_group_id", updateRouteDisplay);
});
