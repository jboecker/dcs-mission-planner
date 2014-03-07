var DEFAULT_SERVER = "http://dcs-mission-planner.combined-ops-group.com:8080";
var USE_SSL = false; // whether to use ws: / http: or wss: / https: schemes
var ADMIN_URI = null;
var WEBSOCKET_URI = null;

var ipc = {}
zip.useWebWorkers = false;
var zipfs = new zip.fs.FS();
var md5hash;

function set_status(text) {
	console.log("status: " + text);
	setTimeout(function() {
		$("#status").text(text);
		window.status = text;
	}, 1);
}

$(function() {
	$("#server-input").val(DEFAULT_SERVER);
	
	Lua.initialize();
	load_table_show();
	Lua.inject(function(k, v) { ipc[k] = v; return []; }, "ipc_set");
	Lua.inject(function(k) { return [ipc[k]];}, "ipc_get");
	Lua.inject(function(s) { console.log(s); return []; }, "js_log");

	Lua.exec($("#dump_lua").text())
	Lua.exec($("#json_lua").text())
	Lua.exec($("#load_mission_lua").text());
	Lua.exec($("#save_mission_lua").text());

	$("#noscript").hide();
	$("#task_choice").show();
	
	$("#create_instance_choice").click(function() {
		$("#task_choice").hide();
		$("#create_input_step1").show();
	});
	
	$("#file-input").change(function() {
		var server_uri = URI($("#server-input").val());
		USE_SSL = !!(server_uri.scheme() == "https");
		WEBSOCKET_URI = new URI().host(server_uri.host()).scheme(USE_SSL ? "wss" : "ws");
		WEBSOCKET_URI.path("/websocket/");
		
		$("#create_input_step1").hide();
		set_status("hashing file...");
		var fr = new FileReader();
		fr.onload = function(evt) {
			var spark = new SparkMD5.ArrayBuffer();
			spark.append(fr.result);
			md5hash = spark.end();
			set_status("");
			$(".filename-h2").text(document.getElementById("file-input").files[0].name);
			create_instance();
		}
		fr.readAsArrayBuffer(document.getElementById("file-input").files[0]);
	});
	function create_instance() {
		var file = document.getElementById("file-input").files[0];
		var filename = document.getElementById("file-input").files[0].name;
		set_status("reading file...");
		zipfs.importBlob(file, function() {
			set_status("extracting mission...");
			zipfs.find("mission").getText(function(luaCode) {
				set_status("processing mission...");
				Lua.exec(luaCode);
				Lua.exec("load_mission()");
				var data = JSON.parse(ipc.data);
				set_status("opening websocket...");
				var ws = new WebSocket(WEBSOCKET_URI.toString());
				ws.onopen = function() {
					set_status("uploading data...");
					var request = { request_id: 1,
									request: "create_instance",
									filename: filename,
									md5hash: md5hash,
									data: data,
									no_passwords: $("#no_passwords-input").is(":checked"),
									};
					ws.send(JSON.stringify(request));
				}
				ws.onmessage = function(msg) {
					ws.close();
					
					set_status("processing response...");
					var data = JSON.parse(msg.data);
					var u = new URI().scheme(USE_SSL ? "https" : "http").host(new URI($("#server-input").val()).host()).path("/").query({"instance_id": data.instance_id});
					u.username("admin").password(data.admin_pw);
					$("#admin-url-input").val(u.toString());
					$("#connect_existing_form").submit();
					
					set_status("instance created.");
				}
			},
			null,
			true,
			"utf-8");
		});
	}
	
	
	$("#existing_instance_choice").click(function() {
		$("#task_choice").hide();
		$("#connect_existing_step1").show();
		$("#admin-url-input").focus();
	});
	$("#connect_existing_form").submit(function(e) {
		e.preventDefault();
		$("#save-file-input-td").append($("#file-input").remove());
		
		$("#connect_existing_step1").hide();
		ADMIN_URI = new URI($("#admin-url-input").val());
		USE_SSL = !!(ADMIN_URI.scheme() == "https");
		WEBSOCKET_URI = new URI();
		WEBSOCKET_URI.scheme(USE_SSL ? "wss" : "ws").host(ADMIN_URI.host()).path("/websocket/");
		
		set_status("opening websocket...");
		var ws = new WebSocket(WEBSOCKET_URI.toString());
		ws.onopen = function() {
			set_status("requesting instance info...");
			var request = { request_id: 1,
							request: "instance_info",
							instance_id: ADMIN_URI.query(true).instance_id,
							admin_pw: ADMIN_URI.password()
						};
			ws.send(JSON.stringify(request));
		};
		ws.onmessage = function(msg) {
			var data = JSON.parse(msg.data);
			if (!data.success) {
				alert("Error: "+data.error_msg);
				return;
			}
			
			var u = new URI().scheme(USE_SSL ? "https" : "http").host(ADMIN_URI.host()).path("/").query({"instance_id": data.instance_id});
			
			u.username("admin").password(data.admin_pw);
			$("#admin-url").text(u.toString());
			$("#admin-url").attr("href", u.toString());
			
			u.username("red").password(data.red_pw);
			$("#red-url").text(u.toString());
			$("#red-url").attr("href", u.toString());
			
			u.username("blue").password(data.blue_pw);
			$("#blue-url").text(u.toString());
			$("#blue-url").attr("href", u.toString());
			
			$("#instance-id-td").text(data.instance_id);
			
			$("#connect_existing_step2").show();
			set_status("");
		}
	});
	
	$("#red-url, #blue-url, #admin-url").click(function(e) {
		alert("Right-click the link and copy the URL to your clipboard!");
		return false;
	});
	
	$("#save-mission-button").click(function(evt) {
		var file = document.getElementById("file-input").files[0];
		var filename = document.getElementById("file-input").files[0].name;
		set_status("extracting mission...");
		zipfs.importBlob(file, function() {
			zipfs.find("mission").getText(function(luaCode) {
				set_status("loading mission...");
				Lua.exec(luaCode);
				
				zipfs.importBlob(file, function() {
					zipfs.remove(zipfs.find("mission"));
					
					set_status("opening websocket...");
					var ws = new WebSocket(WEBSOCKET_URI.toString());
					ws.onopen = function() {
						set_status("requesting data from server...");
						var request = { request_id: 1,
										request: "save_mission",
										admin_pw: ADMIN_URI.password(),
										instance_id: ADMIN_URI.query(true).instance_id,
									};
						ws.send(JSON.stringify(request));
					}
					ws.onmessage = function(msg) {
						set_status("processing response [parsing message]...");
						var data = JSON.parse(msg.data);
						if (!data.success) {
							alert("Error: "+data.error_msg);
							return;
						}
						if (data.md5hash != md5hash) {
							alert('Instance "'+$("#instance_id-input").val()+'" was created from another mission file, which was named "'+data.filename+'".\nSaving the waypoint data using a different mission as a template may or may not work.');
						}
						set_status("processing response [updaing mission data]...");
						ipc.data = JSON.stringify(data.data);
						Lua.exec("save_mission()");
						set_status("processing response [serializing mission data]...");
						setTimeout(function() {
							Lua.exec("ipc_set('mission_str', 'mission = ' .. DUMP.tostring(mission, 'mission'))")
							var mission_str = ipc.mission_str;
							
							setTimeout(function() {
								set_status("processing response [compressing mission file]...");
								zipfs.root.addText("mission", mission_str);
								
								set_status("opening download dialog.");
								zipfs.exportBlob(function(blob) {
									window.theblob = blob; // keep a reference
									if (window.navigator.msSaveBlob) {
										set_status("showing download dialog.");
										window.navigator.msSaveBlob(blob, filename);
									} else {
										var blobURL = URL.createObjectURL(blob);
										$("#status").html('<a href="'+blobURL+'" download="'+filename+'" target="tab">Save Result</a>');
									}
								});
							}, 20);
						}, 20);
					}
				});
					
			},
			null,
			true,
			"utf-8");
		});
	});
	
	$("#upload_mission_state_button").click(function(evt) {
		var file = document.getElementById("state-input").files[0];
		var filename = document.getElementById("state-input").files[0].name;
		set_status("reading state...");
		var reader = new FileReader();
		reader.readAsText(file);
		reader.onload = function(e) {
			var text = reader.result;
				var ws = new WebSocket(WEBSOCKET_URI.toString());
				ws.onopen = function() {
					set_status("uploading state...");
					var request = { request_id: 1,
									request: "set_mission_state",
									admin_pw: ADMIN_URI.password(),
									instance_id: ADMIN_URI.query(true).instance_id,
									missionState: JSON.parse(text),
									};
					ws.send(JSON.stringify(request));
				}
				ws.onmessage = function(e) {
					var msg = JSON.parse(e.data);
					set_status("processing response...");
					if (!msg.success) {
						set_status("error");
						alert("Error: "+msg.error_msg);
					} else {
						set_status("uploaded mission state.");
					}
				}
		}
	});
	
});
