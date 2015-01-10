/*
aChat Client Library for JavaScript by a0000778
*/

/*
項目						型態			預設值	說明
config.autoReconnect	boolean		true	斷線自衝重連
config.passwordHash		function	(必填)	密碼加密方法
config.server			string		(必填)	伺服器
*/
function aChatClient(config){
	if(!this.constructor.checkSupport())
		return false;
	config=config || {};
	this.action={};
	this.userId=null;
	this.authData=null;
	this.autoReconnect=('autoReconnect' in config)? config.autoReconnect:true;
	this.channel=null;
	this.connected=false;
	this.event={
		'error': [],
		//驗證結果系列
		'accountDisabled': [],//帳號被停用
		'authFail': [],//驗證失敗
		'authSuccess': [],//驗證成功
		'authTimeout': [],//驗證超時
		//頻道處理類
		'channelList': [],//頻道清單
		'channelSwitch': [],//頻道切換
		'channelUserList': [],//頻道在線清單
		//訊息處理類
		'chatNormal': [],//頻道聊天訊息
		'chatPrivate': [],//密頻聊天訊息
		//連線類
		'close': [],
		'connected': [],
		'ipBanned': [],
		'loseConnect': [],
		'notSupportProtocol': [],
		'reconnect': [],
		'repeatLogin': [],
		//伺服器訊息類
		'serverAlert': [],
		'serverClosing': [],
		'serverError': [],
		'serverKick': [],
		'serverLocked': [],
		'serverMaintenance': [],
		'serverOffline': [],
		'serverOverLoad': [],
		//使用者類
		'userGetProfile': [],
		'userEditProfile': []
	}
	this.link=null;
	this.passwordHash=config.passwordHash;
	this.server=config.server;
	
	var action,actionDefault=this.constructor.action;
	for(action in actionDefault){
		this.action[action]=actionDefault[action];
	}
}
aChatClient.action={
	'auth': function(data){
		if(data.status=='success' && /^\d$/.test(data.userId) && data.userId>0){
			this.userId=parseInt(data.userId,10);
			this.emit('authSuccess');
		}else{
			this.emit('authFail',data.status);
		}
	},
	'channel_list': function(data){
		if(Array.isArray(data.list)=='array')
			this.emit('channelList',data.list);
	},
	'channel_switch': function(data){
		if(typeof(data.status)=='string' && typeof(data.channelId)=='Number'){
			if(data.status=='success' || data.status=='force')
				this.channel=data.channelId;
			this.emit('channelSwitch',data.status,data.channelId);
		}
	},
	'channel_userList': function(data){
		if('status' in data)
			this.emit('channelUserList',data.status,data.list || []);
	},
	'chat_normal': function(data){
		if(typeof(data.fromUserId)=='number' && typeof(data.msg)=='string')
			_.emit('chatNormal',data.fromUserId,data.msg);
	},
	'chat_private': function(data){
		if('status' in data){
			this.emit('chatPrivate',data.status);
		}else if(typeof(data.fromUserId)=='number' && typeof(data.msg)=='string' && (data.toUserId===this.userId || data.fromUserId===this.userId))
			this.emit('chatPrivate',null,data.fromUserId,data.toUserId,data.msg);
	},
	'user_getProfile': function(data){
		if('status' in data)
			this.emit('userGetProfile',this.status,this.profile || {});
	},
	'user_editProfile': function(data){
		if('status' in data)
			this.emit('userEditProfile',this.status);
	}
}
aChatClient.checkSupport=function(){
	return ('WebSocket' in window);
}
aChatClient.prototype._check=function(callback){
	if(!this.connected){
		callback && callback('not connected');
		return false;
	}
	if(!this.userId){
		callback && callback('not authed');
		return false;
	}
	return true;
}
aChatClient.prototype._send=function(data){
	if(this.link){
		this.link.send(JSON.stringify(data));
		return true;
	}
	return false;
}
aChatClient.prototype.auth=function(username,password){
	if(username!==undefined && password!==undefined){
		this.authData={
			'username': username,
			'password': this.passwordHash(password)
		};
	}else if(!this.authData){
		_.emit('error',new Error('缺少驗證資料'));
		return;
	}
	if(this.link) this.connect();
	if(this.connected){
		this._send({
			'action': 'auth',
			'username': this.authData.username,
			'password': this.authData.password
		});
	}else{
		this.once('connected',function(){
			this._send({
				'action': 'auth',
				'username': this.authData.username,
				'password': this.authData.password
			});
		});
	}
}
aChatClient.prototype.channelList=function(callback){
	if(!this._check(callback)) return;
	this._send({'action': 'channel_list'});
	callback && this.once('channelList',callback);
}
aChatClient.prototype.channelSwitch=function(channelId,callback){
	if(!this._check(callback)) return;
	if(!/^\d+$/.test(channelId)){
		callback('channelId format error');
		return;
	}
	this._send({
		'action': 'channel_switch',
		'channelId': parseInt(channelId,10)
	});
	callback && this.once('channelSwitch',callback);
}
aChatClient.prototype.channelUserList=function(channelId,callback){
	var cmd={'action': 'channelUserList'};
	if(!callback){
		callback=channelId;
		channelId=undefined;
	}else if(/^\d+$/.test(channelId) && channelId>0){
		cmd.channelId=channelId;
	}else return;
	if(!this._check(callback)) return;
	this._send(cmd);
	callback && this.once('channelUserList',callback);
}
aChatClient.prototype.chatSend=function(type,toUserId,msg,callback){
	if(!this._check(callback) || msg===undefined) return;
	msg=msg.toString();
	if(msg.length===0) return;
	if(type=='normal'){
		this._send({
			'action': 'chat_normal',
			'msg': msg
		});
		callback && this.once('chatNormal',callback);
	}else if(type=='private' && /^\d+$/.test(toUserId) && toUserId>0){
		this._send({
			'action': 'chat_private',
			'toUserId': parseInt(toUserId,10),
			'msg': msg
		});
		callback && this.once('chatPrivate',callback);
	}
}
aChatClient.prototype.connect=function(){
	var _=this;
	this.link=new WebSocket(this.server,'chatv1');
	this.link
		.on('close',function(ev){
			_.link=null;
			_.userId=null;
			switch(ev.code){
				case 1000: _.emit('logout'); break;
				case 1001: _.emit('serverClosing'); break;
				case 1008: _.emit('ipBanned'); break;
				case 4000: _.emit('serverMaintenance'); break;
				case 4001: _.emit('serverLocked'); break;
				case 4002: _.emit('serverOverLoad'); break;
				case 4003: _.emit('serverError'); break;
				case 4100: _.emit('authTimeout'); break;
				case 4101: _.emit('accountDisabled'); break;
				case 4102: _.emit('authFail'); break;
				case 4103: _.emit('repeatLogin'); break;
				case 4104: _.emit('serverKick'); break;
			}
			_.emit('close',code);
			
			if(ev.code===undefined){
				_.emit('loseConnect');
				if(_.autoReconnect && _.authData){
					_.connect().auth();
					_.emit('reconnect');
				}
			}else{
				_.channel=null;
				_.authData=null;
			}
		})
		.on('error',function(error){
			_.emit('error',error);
		})
		.on('message',function(data){
			try{
				data=JSON.parse(data);
			}catch(e){
				return;
			}
			if(typeof(data.action)==='string' && _.action.has(data.action)){
				_.action[data.action].call(_,data);
			}
		})
		.on('open',function(){
			_.connected=true;
			_.emit('connected');
		})
	;
}
aChatClient.prototype.emit=function(evName){//evName,arg1,arg2...
	if(this.event.hasOwnProperty(evName)){
		var args=Array.prototype.slice.call(arguments,1);
		this.event[evName].forEach(function(func){
			func.apply(this,args);
		},this);
	}
}
aChatClient.prototype.logout=function(){
	if(!this._check()) return;
	this._send({
		'action': 'user_logout'
	});
}
aChatClient.prototype.on=function(evName,func){
	if(!this.event.hasOwnProperty(evName))
		this.event[evName].push(func);
	return this;
}
aChatClient.prototype.once=function(evName,func){
	if(!this.event.hasOwnProperty(evName)){
		var _=this;
		var autoRemove=function(){
			_.removeListener(evName,autoRemove);
			func.apply(_,arguments);
		}
		this.on(evName,autoRemove);
	}
	return this;
}
aChatClient.prototype.profile=function(profileData,callback){
	if(!callback){
		callback=profileData;
		profileData=undefined;
	}
	if(!this._check(callback)) return;
	if(typeof(profileData)=='object'){
		if(typeof(profileData.password)=='string' && profileData.password.length>=32){
			var sendData={'action': 'user_editProfile'};
			for(var field in profileData){
				if(field=='action'){
					this.emit('error',new Error('profile 不支援 action 欄位'));
					return;
				}
				sendData[field]=profileData[field];
			}
			this._send(sendData);
			callback && this.once('userEditProfile',callback);
		}else{
			this.emit('error',new Error('修改資料需要 password 欄位'));
		}
	}else{
		this._send({'action': 'user_getProfile'});
		callback && this.once('userGetProfile',callback);
	}
}
aChatClient.prototype.removeListener=function(evName,func){
	var index,event=this.event;
	if(!event.hasOwnProperty(evName) && (index=this.event[evName].indexOf(func))!==-1)
		event[evName].splice(index,1);
	return this;
}