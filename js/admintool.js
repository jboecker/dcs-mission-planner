var WEBSOCKET_URL = "wss://dcs-mission-planner.herokuapp.com/websocket/";
Lua.execute($("#json_lua").text())

zip.useWebWorkers = false;
ipc = {}
var fs = new zip.fs.FS();
var md5hash;

function set_status(text) {
	console.log("status: " + text);
	setTimeout(function() {
		$("#status").text(text);
		window.status = text;
	}, 1);
}

$(function() {
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
		var file = document.getElementById("file-input").files[0];
		var filename = document.getElementById("file-input").files[0].name;
		set_status("reading file...");
		fs.importBlob(file, function() {
			$("#status").text("extracting mission...");
			fs.find("mission").getText(function(luaCode) {
				$("#status").text("processing mission...");
				Lua.execute(luaCode);
				Lua.execute($("#load_mission_lua").text());
				var data = JSON.parse(ipc_unescape(ipc.data));
				$("#status").text("opening websocket...");
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
		var file = document.getElementById("file-input").files[0];
		var filename = document.getElementById("file-input").files[0].name;
		set_status("extracting mission...");
		fs.importBlob(file, function() {
			fs.find("mission").getText(function(luaCode) {
				Lua.execute(luaCode);
				set_status("loading mission...");
				
				fs.importBlob(file, function() {
					fs.remove(fs.find("mission"));
					
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
						$("#status").text("processing response (2/3)...");
						ipc.data = ipc_escape(JSON.stringify(data.data));
						Lua.execute($("#save_mission_lua").text());
						var mission_str = ipc_unescape(ipc.mission_str);
						
						$("#status").text("processing response (3/3)...");
						fs.root.addText("mission", mission_str);
						
						$("#status").text("opening download dialog.");
						fs.exportBlob(function(blob) {
							window.theblob = blob; // keep a reference
							if (window.navigator.msSaveBlob) {
								$("#status").text("showing download dialog.");
								window.navigator.msSaveBlob(blob, filename);
							} else {
								var blobURL = URL.createObjectURL(blob);
								$("#status").html('<a href="'+blobURL+'" download="'+filename+'" target="tab">Save Result</a>');
							}
						});
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
