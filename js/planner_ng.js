mp = mp || {};
mp.settings = {};
mp.settings.websocket_url = "wss://dcs-mission-planner.herokuapp.com/websocket/";
mp.settings.download_url = "https://dcs-mission-planner.herokuapp.com/download/";

$.support.cors = true;
$(function() {
	$("#noscript").hide();
	$("#connect_controls").show();
    
    function connect(instance_id, coalition, password) {
        if (mp.api) {
            if (mp.api.websocket) {
                mp.api.websocket.onclose = undefined;
                mp.api.websocket.close();
            }
        }
        mp.api = new mp.API();
        mp.api.login({
            instance_id: instance_id,
            coalition: coalition,
            password: password,
            on_error: function(result) {
                alert("Could not connect: "+result.error_msg);
            },
            on_success: function(result) {
                $("#intro").hide();

				$("#map").show();
				mp.model = new mp.Model(result.id_prefix, result.data);
				
				$.each(mp.model.objects, function(_, obj) {
					if (obj.type == "CLIENT_ACFT_ROUTE") {
						$("#activeroute").append($("<option>").attr("value", obj.id).text(obj.group_name));
						$("#copyroute_from").append($("<option>").attr("value", obj.id).text(obj.group_name));
					}
				});
				
				mp.ui = {}
				mp.ui.state = "idle"
				
				mp.mapview = new mp.MapView('osm');
				$("#baselayer").val("osm");
				$("#map_opacity_slider").hide();
				$("#map_opacity_slider").change();
				$("#activeroute").change();
				var rE = mp.mapview.getMap().restrictedExtent;
				mp.mapview.getMap().setCenter(new OpenLayers.LonLat(rE.left + (rE.right - rE.left)/2, rE.bottom + (rE.top - rE.bottom)/2));
				
				$("#connect_controls").hide();
				$("#connect_status").text("Instance: "+$("#connect_instance_id").val());
				$("#intro").hide();
				$("#controls").show();
                
				$("#briefing_content").html("");
                
				$("#briefing_content").append($("<h1>Mission Description</h1>"));
				$("#briefing_content").append($("<pre>").text(result.data.descriptionText));
                
				$("#briefing_content").append($("<h1>Blue Task</h1>"));
				$("#briefing_content").append($("<pre>").text(result.data.blueTask));
                
				$("#briefing_content").append($("<h1>Red Task</h1>"));
				$("#briefing_content").append($("<pre>").text(result.data.redTask));

            },
        });
    }
    
    $("#connect_red_button").click(function(e) {
        if (e.shiftKey) {
            mp.settings.websocket_url = "ws://localhost:5000/websocket/";
        }
        connect($("#connect_instance_id").val(), "red", $("#connect_password").val());
    });
    
    $("#connect_blue_button").click(function(e) {
        if (e.shiftKey) {
            mp.settings.websocket_url = "ws://localhost:5000/websocket/";
        }
        console.log(e);
        connect($("#connect_instance_id").val(), "blue", $("#connect_password").val());
    });

    $(document).on("heartbeat", function() {
		var ind = $("#update_indicator")[0];
		ind.style.visibility = (ind.style.visibility == "hidden") ? "visible" : "hidden";
    });

	$("#map_opacity_slider").change(function() {
		var new_opacity = parseInt($("#map_opacity_slider").val()) / 100;
		mp.mapview.getMap().layers[0].setOpacity(new_opacity);
	});
	
	$("#baselayer").change(function() {
		var baselayer_name = $("#baselayer").val();
		
		var center = mp.mapview.getMap().getCenter().transform(map.getProjection(), "EPSG:4326");
		var old_zoom = mp.mapview.getMap().zoom;
		
		mp.mapview.destroy();
		mp.mapview = new mp.MapView(baselayer_name);
		
		center.transform("EPSG:4326", mp.mapview.getMap().getProjection());
		mp.mapview.getMap().setCenter(center, old_zoom);
		if (baselayer_name == "tad" || baselayer_name == "tad_sm") {
			$("#map_opacity_slider").show();
			$("#map_opacity_slider").change();
		} else {
			$("#map_opacity_slider").hide();
		}
		
	});

	$("#activeroute").change(function() {
		if (mp.model) mp.model.setSelectedFeatureGroupId($("#activeroute").val());
	});
	$(document).on("update_selected_feature_group_id", function(e, old_id, new_id) {
		$("#activeroute").val(new_id);
	});
	
	$("#center_on_wp0_button").click(function() {
		var route_object = mp.model.objects[$("#activeroute").val()];
		var wpt = mp.model.objects[route_object.first_waypoint_id];
		
		mp.mapview.getMap().setCenter(new OpenLayers.LonLat(lon=wpt.lon, lat=wpt.lat).transform("EPSG:4326", mp.mapview.getMap().getProjection()));
	});
	
	$("input[name=editmode]:radio").change(function() {
		$("div.editmode").removeClass("active_editmode");
		if ($("#editmode_routes").is(":checked")) {
			$("#editmode_routes_controls").addClass("active_editmode");
			if (mp.mapview) mp.mapview.getInputHandler().doStateTransition("idle");
		}
		if ($("#editmode_annotations").is(":checked")) {
			$("#editmode_annotations_controls").addClass("active_editmode");
			if (mp.mapview) mp.mapview.getInputHandler().doStateTransition("draw_circle");
		}
	});
	$("input[name=editmode]:radio").change();
	
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
