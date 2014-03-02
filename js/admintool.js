var WEBSOCKET_URL = "wss://dcs-mission-planner.herokuapp.com/websocket/";

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
	$("#step1").show();
	
	$("#file-input").change(function() {
		$("#step1").hide();
		set_status("hashing file...");
		var fr = new FileReader();
		fr.onload = function(evt) {
			var spark = new SparkMD5.ArrayBuffer();
			spark.append(fr.result);
			md5hash = spark.end();
			set_status("");
			$("#filename-h2").text(document.getElementById("file-input").files[0].name);
			$("#step2").show();
		}
		fr.readAsArrayBuffer(document.getElementById("file-input").files[0]);
	});
	
	$("#create-instance-button").click(function(evt) {
        if (evt.shiftKey) {
            WEBSOCKET_URL = "ws://localhost:5000/websocket/";
        }
		var file = document.getElementById("file-input").files[0];
		var filename = document.getElementById("file-input").files[0].name;
		set_status("reading file...");
		zipfs.importBlob(file, function() {
			set_status("extracting mission...");
			zipfs.find("mission").getText(function(luaCode) {
				set_status("processing mission...");
				luaCode = luaCode.replace(/[^\x00-\x7F]/g, "?"); // work around https://github.com/campadrenalin/weblua/issues/17
				Lua.exec(luaCode);
				Lua.exec("load_mission()");
				var data = JSON.parse(ipc.data);
				set_status("opening websocket...");
				var ws = new WebSocket(WEBSOCKET_URL);
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
					set_status("processing response...");
					var data = JSON.parse(msg.data);
					$("#instance_id-input").val(data.instance_id);
					$("#admin_pw-input").val(data.admin_pw);
					$("#instance-id-td").text(data.instance_id);
					$("#blue-pw-td").text(data.blue_pw);
					$("#red-pw-td").text(data.red_pw);
					$("#admin-pw-td").text(data.admin_pw);
					$("#instance_info").css("visibility", "visible");
					console.log(data);
					set_status("instance created.");
				}
			},
			null,
			true,
			"utf-8");
		});
	});
	
	
	$("#save-mission-button").click(function(evt) {
        if (evt.shiftKey) {
            WEBSOCKET_URL = "ws://localhost:5000/websocket/";
        }
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
					var ws = new WebSocket(WEBSOCKET_URL);
					ws.onopen = function() {
						set_status("requesting data from server...");
						var request = { request_id: 1,
										request: "save_mission",
										admin_pw: $("#admin_pw-input").val(),
										instance_id: $("#instance_id-input").val(),
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
        if (evt.shiftKey) {
            WEBSOCKET_URL = "ws://localhost:5000/websocket/";
        }
		var file = document.getElementById("state-input").files[0];
		var filename = document.getElementById("state-input").files[0].name;
		set_status("reading state...");
		var reader = new FileReader();
		reader.readAsText(file);
		reader.onload = function(e) {
			var text = reader.result;
				var ws = new WebSocket(WEBSOCKET_URL);
				ws.onopen = function() {
					set_status("uploading state...");
					var request = { request_id: 1,
									request: "set_mission_state",
									admin_pw: $("#admin_pw-input").val(),
									instance_id: $("#instance_id-input").val(),
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
