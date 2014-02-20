mp = mp || {};

mp.API = function(){
	
    var that = this;
	
    this.websocket_url = mp.settings.websocket_url;
    this.websocket_message_callbacks = {};
    this.next_request_id_ = 1;
    this.websocket = null;
    
    this.login = function(args) {
        this.websocket = new WebSocket(this.websocket_url);
        this.websocket.onopen = function() {
            $("#status").text("downloading data...");
            that.request(
                {
                    request: 'login',
                    instance_id: args.instance_id,
                    coalition: args.coalition,
                    password: args.password,
                },
                args.on_success,
                args.on_error
            );
            setTimeout(that.check_for_activity, 2000);
        };
        this.websocket.onclose = function() {
            console.info("websocket closed.");
            alert("Connection lost. Please refresh the page and log in again.");
        };
        this.websocket.onmessage = function(evt) {
            msg = JSON.parse(evt.data);
            if (msg.request_id && that.websocket_message_callbacks[msg.request_id]) {
                var cb = that.websocket_message_callbacks[msg.request_id];
                that.websocket_message_callbacks[msg.request_id] = undefined;
                cb(msg);
            }
            if (msg.type && msg.type == "changeset") {
				mp.model.processChangeset(msg.changeset);
            }
        };
    }
    
    this.check_for_activity = function() {
        that.request({request: "ping"},
                     function(result) {
                         $(document).trigger("heartbeat");
                         if (that.websocket.readyState == WebSocket.OPEN) {
                             setTimeout(that.check_for_activity, 5000);
                         }
                     });
    }

    this.request = function(request_obj, success_callback, error_callback) {
        request_id = this.next_request_id_++;
        request_obj.request_id = request_id;
        this.websocket_message_callbacks[request_id] = function(result) {
            if (success_callback) {
                success_callback(result);
            } else {
                if (error_callback) error_callback(result);
            }
        };
        this.websocket.send(JSON.stringify(request_obj));
    }
	this.on_api_error = function(result) {
		console.error("API Error, result was: ", result);
	}
	
	this.on_xhr_error = function(result) {
		console.error("XHR Error, result was: ", result);
	}
    
	/*
	  Arguments:
	  
	  transaction: the transaction to send (overrides objects and deleted_object_ids)
	  
	  objects: array of new and updated objects
	  deleted_object_ids: array of object ids to be deleted
	 */
	this.start_transaction = function(args) {
		
		var transaction = {};
		if (args.transaction) {
			transaction = args.transaction;
		} else if (args.objects || args.deleted_object_ids) {
			if (args.deleted_object_ids) {
				transaction.deleted_object_ids = args.deleted_object_ids;
			} else {
				transaction.deleted_object_ids = [];
			}
			transaction.preconditions = {};
			transaction.updated_data = {};
			
			if (args.objects) {
				$.each(args.objects, function(_, obj) {
					transaction.updated_data[obj.id] = obj;
					if (obj.id in mp.model.objects) {
						transaction.preconditions[obj.id] = mp.model.objects[obj.id];
					}
				});
			}
			$.each(transaction.deleted_object_ids, function(_, id) {
				transaction.preconditions[id] = mp.model.objects[id];
			});
		} else {
			throw "start_transaction(): must specify either transaction or objects or deleted_object_ids!";
		}
		this.request(
            {request: "transaction",
             transaction: transaction
            },
			function(result) { // success callback
				if (result.transaction_applied) {
					mp.model.processChangeset(result.changeset);
					if (args.on_commit) args.on_commit(result);
				} else {
					if (args.on_rollback) args.on_rollback(result);
				}
			},
			function(result) { // error callback
				if (result.on_rollback) result.on_rollback(result);
            }
		);
	}
	
 };
